from fastapi import FastAPI, BackgroundTasks, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from contextlib import asynccontextmanager
from bson import ObjectId

# Local imports
from database import seed_database, db
from models import Company, Customer, LeadStatus, CallLog, User, CustomerCreate
from vapi import trigger_outbound_call
from agent import app_graph
from auth import get_password_hash, verify_password, create_access_token, decode_access_token
from pydantic import BaseModel

import secrets
import string
from datetime import datetime

# ---------------------------------------------------------------------------
# WebSocket Connection Manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Failed to send websocket message: {e}")

manager = ConnectionManager()

async def create_notification(title: str, message: str, notif_type: str = "info"):
    # Send notification to all admin users for now
    users = await db.users.find().to_list(100)
    now_str = datetime.utcnow().isoformat() + "Z"
    for u in users:
        await db.notifications.insert_one({
            "user_id": str(u["_id"]),
            "title": title,
            "message": message,
            "type": notif_type,
            "is_read": False,
            "created_at": now_str
        })

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed database
    await seed_database()
    
    # Override John Doe's number with the user's real number for testing
    await db.customers.update_one(
        {"name": "John Doe"},
        {"$set": {"phone_number": "+916299961413"}}
    )
    
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

@app.post("/api/customers")
async def add_customer(req: CustomerCreate):
    new_customer = {
        "company_id": req.company_id,
        "name": req.name,
        "email": req.email,
        "phone_number": req.phone_number,
        "status": LeadStatus.PENDING.value,
        "created_at": datetime.utcnow()
    }
    result = await db.customers.insert_one(new_customer)
    new_customer["_id"] = str(result.inserted_id)
    return new_customer

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
        
    await create_notification(
        title="Campaign Started",
        message=f"Started outbound campaign for {company.get('name', 'Company')} ({len(pending_customers)} leads).",
        notif_type="info"
    )
        
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
        
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        customer_name = customer.get("name", "Unknown") if customer else "Unknown"
        status = final_state['status_outcome']
        
        if status == LeadStatus.NEEDS_REVIEW:
            notif_type = "warning"
        elif status == LeadStatus.QUALIFIED:
            notif_type = "success"
        elif status == LeadStatus.FAILED:
            notif_type = "error"
        else:
            notif_type = "info"
            
        await create_notification(
            title="Lead Evaluated",
            message=f"Lead {customer_name} was evaluated as {status.value}.",
            notif_type=notif_type
        )
        
        # Broadcast the real-time update to all connected React clients
        await manager.broadcast({
            "type": "lead_updated",
            "customer_id": customer_id,
            "status": status.value,
            "company_id": str(customer.get("company_id")) if customer else None
        })
        
    except Exception as e:
        print(f"Agent evaluation failed: {e}")
        await db.customers.update_one(
            {"_id": ObjectId(customer_id)},
            {"$set": {"status": LeadStatus.NEEDS_REVIEW.value}}
        )
        # Broadcast failure update
        await manager.broadcast({
            "type": "lead_updated",
            "customer_id": customer_id,
            "status": LeadStatus.NEEDS_REVIEW.value
        })


# ---------------------------------------------------------------------------
# Authentication Endpoints
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ResetPasswordRequest(BaseModel):
    email: str

@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    user = await db.users.find_one({"email": req.email})
    if not user:
        raise HTTPException(status_code=404, detail="Email not found in our system")
        
    # Generate temporary password
    alphabet = string.ascii_letters + string.digits
    temp_password = ''.join(secrets.choice(alphabet) for i in range(8))
    
    # Update hash
    new_hash = get_password_hash(temp_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    # In a real app we'd email this. For prototype we return it.
    return {"message": "Password reset successful", "temporary_password": temp_password}

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    # Check if user exists
    existing_user = await db.users.find_one({"email": req.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_data = {
        "full_name": req.full_name,
        "email": req.email,
        "password_hash": get_password_hash(req.password),
        "role": "Admin",
        "settings": {
            "email_alerts": False,
            "auto_polling": True,
            "dark_mode": False
        }
    }
    result = await db.users.insert_one(user_data)
    
    # Generate token
    access_token = create_access_token(data={"sub": req.email, "id": str(result.inserted_id)})
    return {"access_token": access_token, "token_type": "bearer", "user": {"full_name": req.full_name, "email": req.email, "role": "Admin", "settings": user_data["settings"]}}

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    access_token = create_access_token(data={"sub": user["email"], "id": str(user["_id"])})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user.get("role", "Admin"),
            "settings": user.get("settings", {"email_alerts": False, "auto_polling": True, "dark_mode": False})
        }
    }

from fastapi import Depends
@app.get("/api/auth/me")
async def get_me(token_payload: dict = Depends(decode_access_token)):
    user_id = token_payload.get("id")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "id": str(user["_id"]),
        "full_name": user["full_name"],
        "email": user["email"],
        "role": user.get("role", "Admin"),
        "settings": user.get("settings", {"email_alerts": False, "auto_polling": True, "dark_mode": False})
    }

class SettingsRequest(BaseModel):
    email_alerts: bool
    auto_polling: bool
    dark_mode: bool

@app.put("/api/auth/me/settings")
async def update_settings(req: SettingsRequest, token_payload: dict = Depends(decode_access_token)):
    user_id = token_payload.get("id")
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "settings.email_alerts": req.email_alerts,
            "settings.auto_polling": req.auto_polling,
            "settings.dark_mode": req.dark_mode
        }}
    )
    return {"message": "Settings updated"}

class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str

@app.put("/api/auth/me/password")
async def update_password(req: PasswordUpdateRequest, token_payload: dict = Depends(decode_access_token)):
    user_id = token_payload.get("id")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not verify_password(req.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    new_hash = get_password_hash(req.new_password)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": new_hash}}
    )
    return {"message": "Password updated successfully"}
# ---------------------------------------------------------------------------
# Notifications Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/notifications")
async def get_notifications(token_payload: dict = Depends(decode_access_token)):
    # In a real app we'd filter by user_id. Here we'll just get all or mock filter if we have multiple users
    # For now, let's fetch all notifications since there's typically only one main admin, 
    # but we can filter by user_id if we have one.
    user_id = token_payload.get("id")
    notifs = await db.notifications.find({"user_id": user_id}).sort("created_at", -1).limit(50).to_list(50)
    for n in notifs:
        n["_id"] = str(n["_id"])
    return {"notifications": notifs}

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, token_payload: dict = Depends(decode_access_token)):
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read"}

@app.put("/api/notifications/read-all")
async def mark_all_notifications_read(token_payload: dict = Depends(decode_access_token)):
    user_id = token_payload.get("id")
    await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

# ---------------------------------------------------------------------------
# WebSocket Endpoint for Real-Time Updates
# ---------------------------------------------------------------------------

@app.websocket("/api/ws/leads")
async def websocket_leads_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We just keep the connection open, waiting for client disconnection
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("WebSocket disconnected")

# ---------------------------------------------------------------------------
# Company Management Endpoints
# ---------------------------------------------------------------------------

class InstructionsRequest(BaseModel):
    instructions: str

@app.put("/api/companies/{company_id}/instructions")
async def update_company_instructions(company_id: str, req: InstructionsRequest):
    """Update the AI agent instructions for a specific company/tenant."""
    result = await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": {"instructions": req.instructions}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"message": "Instructions updated successfully"}

@app.get("/api/customers/{company_id}/export")
async def export_customers_csv(company_id: str):
    """Export all customers for a company as a CSV file."""
    from fastapi.responses import StreamingResponse
    import io
    import csv

    customers = await db.customers.find({"company_id": company_id}).to_list(500)
    company = await db.companies.find_one({"_id": ObjectId(company_id)})
    company_name = company.get("name", "Company") if company else "Company"

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Phone", "Email", "Status", "Created At"])
    for c in customers:
        writer.writerow([
            c.get("name", ""),
            c.get("phone_number", ""),
            c.get("email", ""),
            c.get("status", ""),
            c.get("created_at", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={company_name.replace(' ', '_')}_leads.csv"}
    )

# ---------------------------------------------------------------------------
# Call Logs & Analytics Endpoints
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

    # Fetch call logs for those customers, sorting by _id descending (latest first)
    call_logs = await db.call_logs.find(
        {"customer_id": {"$in": customer_ids}}
    ).sort("_id", -1).to_list(1000)

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
