from fastapi import FastAPI, BackgroundTasks, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from contextlib import asynccontextmanager
from bson import ObjectId

# Local imports
from database import seed_database, db
from models import Company, Customer, LeadStatus, CallLog
from vapi import trigger_outbound_call
from agent import app_graph

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed database
    await seed_database()
    yield
    # Shutdown

app = FastAPI(title="Voice AI Orchestrator API", lifespan=lifespan)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for the prototype
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/companies")
async def get_companies():
    companies = await db.companies.find().to_list(100)
    for c in companies:
        c["_id"] = str(c["_id"])
    return {"companies": companies}

@app.get("/api/customers/{company_id}")
async def get_customers(company_id: str):
    customers = await db.customers.find({"company_id": company_id}).to_list(100)
    for c in customers:
        c["_id"] = str(c["_id"])
    return {"customers": customers}

@app.post("/api/campaign/trigger")
async def trigger_campaign(payload: dict, background_tasks: BackgroundTasks):
    company_id = payload.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="company_id is required")
        
    company = await db.companies.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    # Find PENDING customers
    pending_customers = await db.customers.find({
        "company_id": company_id,
        "status": LeadStatus.PENDING.value
    }).to_list(100)
    
    if not pending_customers:
        return {"message": "No pending leads found for this company."}
        
    for customer in pending_customers:
        # Trigger outbound call in background to not block the response
        background_tasks.add_task(trigger_single_call, customer, company)
        
    return {
        "message": f"Successfully triggered campaign for {len(pending_customers)} leads.",
        "triggered_count": len(pending_customers)
    }

async def trigger_single_call(customer: dict, company: dict):
    try:
        # Update status to CALL_INITIATED immediately
        await db.customers.update_one(
            {"_id": customer["_id"]},
            {"$set": {"status": LeadStatus.CALL_INITIATED.value}}
        )
        await trigger_outbound_call(customer, company)
    except Exception as e:
        print(f"Failed to trigger call for {customer['name']}: {e}")
        # Rollback status or set to FAILED
        await db.customers.update_one(
            {"_id": customer["_id"]},
            {"$set": {"status": LeadStatus.FAILED.value}}
        )

@app.post("/api/webhooks/vapi")
async def vapi_webhook(request: Request, background_tasks: BackgroundTasks):
    payload = await request.json()
    
    # We only care about end-of-call-report
    message = payload.get("message", {})
    if message.get("type") == "end-of-call-report":
        call_data = message.get("call", {})
        metadata = call_data.get("assistant", {}).get("metadata", {}) or call_data.get("metadata", {})
        
        # Vapi might put metadata under different keys depending on how it was passed.
        # Fallback to empty dict if missing.
        
        customer_id = metadata.get("customer_id")
        if not customer_id:
            print("Webhook received but no customer_id found in metadata.")
            return JSONResponse({"status": "ignored", "reason": "no customer_id"})
            
        transcript = message.get("transcript", "")
        summary = message.get("summary", "")
        call_id = call_data.get("id", "unknown")
        
        # Log the call
        await db.call_logs.insert_one({
            "customer_id": customer_id,
            "vapi_call_id": call_id,
            "transcript": transcript,
            "summary": summary,
            "outcome": "PENDING_EVALUATION"
        })
        
        # Run LangGraph evaluation in background
        background_tasks.add_task(run_agentic_evaluation, customer_id, transcript, summary)
        
    return JSONResponse({"status": "success"})

async def run_agentic_evaluation(customer_id: str, transcript: str, summary: str):
    print(f"Running LangGraph evaluation for customer {customer_id}")
    initial_state = {
        "customer_id": customer_id,
        "transcript": transcript,
        "summary": summary,
        "status_outcome": LeadStatus.NEEDS_REVIEW,
        "reasoning": ""
    }
    
    try:
        final_state = await app_graph.ainvoke(initial_state)
        print(f"Evaluation finished: {final_state['status_outcome']}")
    except Exception as e:
        print(f"Agent evaluation failed: {e}")
        await db.customers.update_one(
            {"_id": ObjectId(customer_id)},
            {"$set": {"status": LeadStatus.NEEDS_REVIEW.value}}
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
