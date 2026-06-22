import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "krid_ai_db")

if "localhost" in MONGODB_URI:
    print("Using in-memory MongoDB for local testing...")
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
else:
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(MONGODB_URI)

db = client[DB_NAME]

async def seed_database():
    """Seed the database with mock companies and customers."""
    companies_count = await db.companies.count_documents({})
    if companies_count == 0:
        print("Seeding database...")
        
        # Seed Companies
        company_a = {
            "name": "Dream Homes Realty",
            "instructions": "You are calling on behalf of Dream Homes Realty. We sell luxury houses. Ask if they are looking to buy a house in the next 6 months. Be polite, professional, and persuasive."
        }
        company_b = {
            "name": "City Rentals LLC",
            "instructions": "You are calling on behalf of City Rentals LLC. We rent out apartments in the downtown area. Ask if they are looking for an apartment to rent and what their budget is. Be friendly and helpful."
        }
        
        res_a = await db.companies.insert_one(company_a)
        res_b = await db.companies.insert_one(company_b)
        
        comp_a_id = str(res_a.inserted_id)
        comp_b_id = str(res_b.inserted_id)
        
        # Seed Customers for Company A
        customers_a = [
            {"company_id": comp_a_id, "name": "John Doe", "phone_number": "+1234567890", "status": "PENDING"},
            {"company_id": comp_a_id, "name": "Jane Smith", "phone_number": "+1987654321", "status": "PENDING"}
        ]
        
        # Seed Customers for Company B
        customers_b = [
            {"company_id": comp_b_id, "name": "Alice Johnson", "phone_number": "+1122334455", "status": "PENDING"},
            {"company_id": comp_b_id, "name": "Bob Williams", "phone_number": "+1554433221", "status": "PENDING"},
            {"company_id": comp_b_id, "name": "Charlie Brown", "phone_number": "+1667788990", "status": "PENDING"}
        ]
        
        await db.customers.insert_many(customers_a + customers_b)
        print("Database seeded successfully!")
    else:
        print("Database already seeded.")
