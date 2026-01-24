
import os
from database import Database
from collections import defaultdict
import datetime

def check_duplicates():
    print("Connecting to DB...")
    db = Database()
    if not db.is_connected:
        print("DB Not Connected!")
        return

    col = db._get_collection("analyses")
    print(f"Total Documents: {col.count_documents({})}")

    cursor = col.find({}, {"riot_id": 1, "filename_id_lower": 1, "created": 1})
    
    seen = defaultdict(list)
    
    for doc in cursor:
        uid = doc.get("filename_id_lower")
        if not uid:
            # Fallback if filename_id_lower missing
            rid = doc.get("riot_id", "")
            if rid:
                uid = rid.replace("#", "_").lower()
            else:
                uid = "UNKNOWN"
        
        seen[uid].append(doc)

    duplicates_count = 0
    for uid, docs in seen.items():
        if len(docs) > 1:
            duplicates_count += 1
            print(f"\n[DUPLICATE FOUND] '{uid}': {len(docs)} copies")
            # Sort by created desc
            docs.sort(key=lambda x: x.get("created", 0), reverse=True)
            
            for i, d in enumerate(docs):
                ts = d.get("created", 0)
                try:
                    date_str = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')
                except:
                    date_str = "Invalid Date"
                    
                print(f"  {i+1}. ID: {d.get('_id')} | RiotID: {d.get('riot_id')} | Created: {date_str} ({ts})")

    if duplicates_count == 0:
        print("\nNo duplicates found! DB is clean.")
    else:
        print(f"\nFound {duplicates_count} duplicated players.")

if __name__ == "__main__":
    check_duplicates()
