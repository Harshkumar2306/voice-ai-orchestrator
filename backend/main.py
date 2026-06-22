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
    """Run the enhanced 4-node LangGraph pipeline for lead evaluation."""
    print(f"Running LangGraph evaluation for customer {customer_id}")
    initial_state = {
        "customer_id": customer_id,
        "transcript": transcript,
        "summary": summary,
        "status_outcome": LeadStatus.NEEDS_REVIEW,
        "reasoning": "",
        "confidence_score": 0.0,
        "sentiment": "NEUTRAL",
    }
    
    try:
        final_state = await app_graph.ainvoke(initial_state)
        print(
            f"Evaluation finished: {final_state['status_outcome']} "
            f"(confidence={final_state.get('confidence_score', 'N/A')}, "
            f"sentiment={final_state.get('sentiment', 'N/A')})"
        )
    except Exception as e:
        print(f"Agent evaluation failed: {e}")
        await db.customers.update_one(
            {"_id": ObjectId(customer_id)},
            {"$set": {"status": LeadStatus.NEEDS_REVIEW.value}}
        )


# ---------------------------------------------------------------------------
# New Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/call-logs/{company_id}")
async def get_call_logs(company_id: str):
    """Return all call logs for customers belonging to this company.

    Joins each call log with the customer record to include the customer's
    name, phone number, and email alongside the log data.
    """
    # First, find all customer IDs belonging to this company
    customers = await db.customers.find(
        {"company_id": company_id}
    ).to_list(500)

    if not customers:
        return {"call_logs": [], "total": 0}

    # Build a lookup map: customer_id (str) → customer info
    customer_map = {}
    for c in customers:
        cid = str(c["_id"])
        customer_map[cid] = {
            "customer_name": c.get("name", "Unknown"),
            "phone_number": c.get("phone_number", ""),
            "email": c.get("email", ""),
        }

    customer_ids = list(customer_map.keys())

    # Fetch call logs for those customers
    call_logs = await db.call_logs.find(
        {"customer_id": {"$in": customer_ids}}
    ).to_list(1000)

    enriched_logs = []
    for log in call_logs:
        log["_id"] = str(log["_id"])
        cid = log.get("customer_id", "")
        cust_info = customer_map.get(cid, {})
        log["customer_name"] = cust_info.get("customer_name", "Unknown")
        log["phone_number"] = cust_info.get("phone_number", "")
        log["email"] = cust_info.get("email", "")
        enriched_logs.append(log)

    return {"call_logs": enriched_logs, "total": len(enriched_logs)}


@app.get("/api/analytics/{company_id}")
async def get_analytics(company_id: str):
    """Return aggregate analytics for a given company.

    Metrics:
        - total_leads: total number of customers for this company
        - qualified_count: leads marked QUALIFIED
        - not_interested_count: leads marked NOT_INTERESTED
        - pending_count: leads still PENDING
        - failed_count: leads marked FAILED
        - needs_review_count: leads flagged NEEDS_REVIEW
        - conversion_rate: qualified / total_leads (percentage)
    """
    customers = await db.customers.find(
        {"company_id": company_id}
    ).to_list(500)

    total_leads = len(customers)

    # Count by status
    qualified_count = sum(
        1 for c in customers if c.get("status") == LeadStatus.QUALIFIED.value
    )
    not_interested_count = sum(
        1 for c in customers if c.get("status") == LeadStatus.NOT_INTERESTED.value
    )
    pending_count = sum(
        1 for c in customers if c.get("status") == LeadStatus.PENDING.value
    )
    failed_count = sum(
        1 for c in customers if c.get("status") == LeadStatus.FAILED.value
    )
    needs_review_count = sum(
        1 for c in customers if c.get("status") == LeadStatus.NEEDS_REVIEW.value
    )

    conversion_rate = (
        round((qualified_count / total_leads) * 100, 2)
        if total_leads > 0
        else 0.0
    )

    return {
        "company_id": company_id,
        "total_leads": total_leads,
        "qualified_count": qualified_count,
        "not_interested_count": not_interested_count,
        "pending_count": pending_count,
        "failed_count": failed_count,
        "needs_review_count": needs_review_count,
        "conversion_rate": conversion_rate,
    }


@app.get("/api/health")
async def health_check():
    """Simple health-check endpoint for uptime monitors and load balancers."""
    return {
        "status": "healthy",
        "service": "Voice AI Orchestrator",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
