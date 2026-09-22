import asyncio
import os
import time
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

import sys

load_dotenv()
load_dotenv("backend/.env")

async def check_atlas_connection():
    # Accept URI from command line argument if provided, else fallback to env
    if len(sys.argv) > 1 and sys.argv[1]:
        uri = sys.argv[1]
    else:
        uri = os.getenv("MONGODB_URI", "")

    db_name = os.getenv("DB_NAME", "krid_ai_db")

    print("=" * 60)
    print("🔍 MONGODB ATLAS HEALTH & DIAGNOSTIC CHECK")
    print("=" * 60)

    if not uri:
        print("⚠️  No MONGODB_URI found in environment or .env file!")
        print("\n👉 You can check your Atlas cluster by passing your connection string:")
        print('   python3 backend/check_atlas.py "mongodb+srv://<username>:<password>@cluster.mongodb.net/"')
        print("=" * 60)
        return

    # Mask credentials for safe terminal printing
    masked_uri = uri
    if "@" in uri:
        parts = uri.split("@")
        prefix = parts[0].split("://")[0]
        masked_uri = f"{prefix}://*****:*****@{parts[1]}"
    print(f"🔗 Target URI: {masked_uri}")
    print(f"📁 Target Database: {db_name}\n")

    try:
        print("⏳ Attempting connection to MongoDB...")
        start_time = time.time()
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        
        # Ping the server
        await client.admin.command('ping')
        latency = (time.time() - start_time) * 1000
        print(f"✅ Connection Successful! (Latency: {latency:.1f}ms)\n")

        # Inspect database and collections
        db = client[db_name]
        collections = await db.list_collection_names()
        print(f"📊 Collections Found in '{db_name}': {len(collections)}")
        for col_name in collections:
            count = await db[col_name].count_documents({})
            print(f"   • {col_name:20} : {count} documents")

        print("\n" + "=" * 60)
        print("🎉 STATUS: ATLAS IS 100% HEALTHY AND REACHABLE!")
        print("=" * 60)

    except Exception as e:
        print("\n❌ FAILED TO CONNECT TO ATLAS:")
        print(f"   Reason: {e}\n")
        print("💡 TROUBLESHOOTING CHECKLIST:")
        print("   1. Check IP Whitelist in Atlas: Go to 'Network Access' -> Add '0.0.0.0/0' (Allow access from anywhere).")
        print("   2. Check Database User: Go to 'Database Access' -> Ensure username & password match your URI.")
        print("   3. Check URI Format: Should look like mongodb+srv://<username>:<password>@<cluster>.mongodb.net/")

if __name__ == "__main__":
    asyncio.run(check_atlas_connection())
