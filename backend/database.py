import os
import asyncio
from datetime import datetime, timezone
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
    """Seed the database with mock companies and customers.

    Each customer now includes an ``email`` and ``created_at`` field.
    Five realistic customers are seeded per company.
    """
    companies_count = await db.companies.count_documents({})
    if companies_count == 0:
        print("Seeding database...")

        now = datetime.now(timezone.utc)

        # ----------------------------------------------------------------
        # Seed Companies
        # ----------------------------------------------------------------
        company_a = {
            "name": "Dream Homes Realty",
            "instructions": (
                "You are calling on behalf of Dream Homes Realty. We sell luxury "
                "houses. Ask if they are looking to buy a house in the next 6 "
                "months. Be polite, professional, and persuasive."
            ),
        }
        company_b = {
            "name": "City Rentals LLC",
            "instructions": (
                "You are calling on behalf of City Rentals LLC. We rent out "
                "apartments in the downtown area. Ask if they are looking for an "
                "apartment to rent and what their budget is. Be friendly and helpful."
            ),
        }

        res_a = await db.companies.insert_one(company_a)
        res_b = await db.companies.insert_one(company_b)

        comp_a_id = str(res_a.inserted_id)
        comp_b_id = str(res_b.inserted_id)

        # ----------------------------------------------------------------
        # Seed Customers for Company A — Dream Homes Realty (5 customers)
        # ----------------------------------------------------------------
        customers_a = [
            {
                "company_id": comp_a_id,
                "name": "John Doe",
                "phone_number": "+1234567890",
                "email": "john.doe@email.com",
                "status": "PENDING",
                "created_at": now,
            },
            {
                "company_id": comp_a_id,
                "name": "Jane Smith",
                "phone_number": "+1987654321",
                "email": "jane.smith@email.com",
                "status": "PENDING",
                "created_at": now,
            },
            {
                "company_id": comp_a_id,
                "name": "Michael Chen",
                "phone_number": "+1415550198",
                "email": "michael.chen@outlook.com",
                "status": "PENDING",
                "created_at": now,
            },
            {
                "company_id": comp_a_id,
                "name": "Priya Sharma",
                "phone_number": "+1628550734",
                "email": "priya.sharma@gmail.com",
                "status": "PENDING",
                "created_at": now,
            },
            {
                "company_id": comp_a_id,
                "name": "David Martinez",
                "phone_number": "+1310550246",
                "email": "david.martinez@yahoo.com",
                "status": "PENDING",
                "created_at": now,
            },
        ]

        # ----------------------------------------------------------------
        # Seed Customers for Company B — City Rentals LLC (5 customers)
        # ----------------------------------------------------------------
        customers_b = [
            {
                "company_id": comp_b_id,
                "name": "Alice Johnson",
                "phone_number": "+1122334455",
                "email": "alice.johnson@gmail.com",
                "status": "PENDING",
                "created_at": now,
            },
            {
                "company_id": comp_b_id,
                "name": "Bob Williams",
                "phone_number": "+1554433221",
                "email": "bob.williams@protonmail.com",
                "status": "PENDING",
                "created_at": now,
            },
            {
                "company_id": comp_b_id,
                "name": "Charlie Brown",
                "phone_number": "+1667788990",
                "email": "charlie.brown@email.com",
                "status": "PENDING",
                "created_at": now,
            },
            {
                "company_id": comp_b_id,
                "name": "Sophia Nguyen",
                "phone_number": "+1718550482",
                "email": "sophia.nguyen@icloud.com",
                "status": "PENDING",
                "created_at": now,
            },
            {
                "company_id": comp_b_id,
                "name": "Ethan Patel",
                "phone_number": "+1929550613",
                "email": "ethan.patel@hotmail.com",
                "status": "PENDING",
                "created_at": now,
            },
        ]

        await db.customers.insert_many(customers_a + customers_b)
        print("Database seeded successfully!")
    else:
        print("Database already seeded.")
