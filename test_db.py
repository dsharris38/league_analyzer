import os
from dotenv import load_dotenv
from pymongo import MongoClient

def test_connection():
    print("Loading .env...")
    load_dotenv()
    uri = os.environ.get("MONGO_URI")
    
    if not uri:
        print("ERROR: MONGO_URI not found in environment!")
        return

    print(f"Found URI: {uri[:20]}... (masked)")
    
    if "<db_password>" in uri:
        print("CRITICAL: URI still contains placeholder '<db_password>'. Please replace it with your actual password in .env!")
        return

    print("Attempting to connect to MongoDB...")
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        # Force a command to verify connection
        info = client.server_info()
        print("SUCCESS! Connected to MongoDB.")
        print(f"Server version: {info.get('version')}")
        
        db = client.get_database("league_analyzer")
        print(f"Database 'league_analyzer' selected.")
        
        # Check collections
        cols = db.list_collection_names()
        print(f"Collections: {cols}")
        
    except Exception as e:
        print(f"CONNECTION FAILED: {e}")
        # Check for dns/pymongo specific errors
        import sys
        if "dns" in str(e).lower():
            print("Hint: This might be a DNS error. Is 'dnspython' installed?")

if __name__ == "__main__":
    test_connection()
