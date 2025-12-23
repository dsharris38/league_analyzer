try:
    from database import Database
    import time

    print("Connecting to DB...")
    db = Database()
    
    col = db._get_collection("matches")
    if col is None:
        print("Matches collection not found!")
        exit(1)
        
    print(f"Total Matches: {col.count_documents({})}")
    
    # Get one match
    # Try finding one with compressed_data field specifically
    one_compressed = col.find_one({"compressed_data": {"$exists": True}})
    
    if one_compressed:
        mid = one_compressed["metadata"]["matchId"]
        print(f"Found compressed match ID: {mid}")
        
        # Test Retrieval via get_match
        retrieved = db.get_match(mid)
        if retrieved:
            print(f"SUCCESS: Retrieved match {mid}")
            print(f"Keys: {list(retrieved.keys())}")
            if "info" in retrieved:
                print("Match has 'info' key. Decompression worked.")
            else:
                print("Match missing 'info' key. Data corruption?")
        else:
            print("FAILURE: get_match returned None!")
            
    else:
        print("No compressed matches found in DB yet.")
        
    # Test Fallback Retrieval (if any exist)
    one_legacy = col.find_one({"compressed_data": {"$exists": False}})
    if one_legacy:
        mid = one_legacy["metadata"]["matchId"]
        print(f"Found legacy match ID: {mid}")
        retrieved = db.get_match(mid)
        if retrieved and "info" in retrieved:
             print("SUCCESS: Legacy retrieval worked.")
             
except Exception as e:
    print(f"CRASH: {e}")
    import traceback
    traceback.print_exc()
