
from pymongo import MongoClient
import json

def scan_items():
    client = MongoClient("mongodb+srv://league_analyzer:league_analyzer@cluster0.0q0k4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
    db = client["league_analysis"]
    collection = db["analyses"]

    # Get latest
    doc = collection.find_one({}, sort=[("timestamp", -1)])
    if not doc:
        print("No analysis found.")
        return

    print(f"Latest Analysis: {doc.get('riot_id')}")
    matches = doc.get("detailed_matches", [])
    
    all_item_ids = set()
    
    for m in matches:
        # Check builds
        build = m.get("item_build", [])
        for e in build:
            all_item_ids.add(e.get("itemId"))
            
    print(f"Found {len(all_item_ids)} unique item IDs.")
    print("Potential New Items (IDs > 3000 or unknown ranges):")
    
    # helper to print
    sorted_ids = sorted(list(all_item_ids))
    for i in sorted_ids:
        # Filter for likely new items (Boots were 3170+)
        # Standard items are usually 1000-8000.
        # Let's just print them all if it's not too huge, 
        # or focus on the 3100-3300 range or 20000+
        if 3170 <= i <= 3300: 
             print(f"  {i}")
        # Also check for very new IDs if any
        if i > 10000:
             print(f"  {i}")

if __name__ == "__main__":
    scan_items()
