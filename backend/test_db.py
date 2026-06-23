import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()
client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
db = client.voice_ai_db

async def test():
    customer = await db.customers.find_one({"status": "PENDING"})
    if customer:
        print("CUSTOMER_ID:", str(customer["_id"]))
    else:
        print("NO PENDING CUSTOMERS")

asyncio.run(test())
