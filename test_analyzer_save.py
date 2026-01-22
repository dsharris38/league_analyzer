
import sys
import os
import time
from database import Database
from analyzer import analyze_matches

def test_analyzer_save():
    print("Connecting to DB...")
    db = Database()
    
    puuid = "qnTPlWIBNNDBMgoXXR6_WZKJVqaEhbjerktJEUlvmnsUSCa4IjVQ6Fz5giZt-eNSJoOi3uqzvnsCUw"
    riot_id = "Freeder#NA1"
    
    print("Fetching raw matches...")
    matches = db.get_matches_by_puuid(puuid, limit=5)
    
    if not matches:
        print("No matches found locally.")
        return

    print(f"Found {len(matches)} matches. Running analysis...")
    analysis = analyze_matches(matches, puuid)
    
    # Verify keys locally
    detailed = analysis.get("detailed_matches", [])
    if detailed:
        print(f"Local Match[0] Keys: {list(detailed[0].keys())}")
        print(f"Local Match[0] Role: {detailed[0].get('role')}")
    
    # Construct Mock Payload
    payload = {
        "riot_id": riot_id,
        "puuid": puuid,
        "analysis": analysis,
        "schema_version": "DEBUG-TEST",
        "created": time.time()
    }
    
    print("Saving to DB...")
    db.save_analysis(payload)
    print("Saved. Now re-reading from DB to verify persistence...")
    
    # Re-read immediately
    col = db._get_collection("analyses")
    doc = col.find_one({"riot_id": riot_id})
    if doc:
         saved_matches = doc.get("analysis", {}).get("detailed_matches", [])
         if saved_matches:
             m0 = saved_matches[0]
             print(f"DB Match[0] Keys: {list(m0.keys())}")
             print(f"DB Match[0] Role: {m0.get('role')}")
         else:
             print("DB detailed_matches empty!")
    else:
        print("Failed to find doc in DB after save.")

if __name__ == "__main__":
    test_analyzer_save()
