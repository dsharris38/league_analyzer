
import os
from database import Database
from collections import defaultdict
import datetime

def fix_duplicates():
    print("Fixing duplicates...")
    db = Database()
    if not db.is_connected:
        print("DB Not Connected!")
        return

    col = db._get_collection("analyses")
    cursor = col.find({}, {"riot_id": 1, "filename_id_lower": 1, "created": 1})
    
    seen = defaultdict(list)
    for doc in cursor:
        uid = doc.get("filename_id_lower")
        if not uid:
            rid = doc.get("riot_id", "")
            if rid:
                uid = rid.replace("#", "_").lower()
            else:
                continue
        seen[uid].append(doc)

    for uid, docs in seen.items():
        if len(docs) > 1:
            print(f"Fixing '{uid}': {len(docs)} copies")
            # Sort by created desc (Newest first)
            docs.sort(key=lambda x: x.get("created", 0), reverse=True)
            
            # Keep index 0, delete the rest
            victim_ids = [d["_id"] for d in docs[1:]]
            
            if victim_ids:
                print(f"  Deleting {len(victim_ids)} old copies...")
                col.delete_many({"_id": {"$in": victim_ids}})
                print("  Deleted.")

    print("\nDone.")

if __name__ == "__main__":
    fix_duplicates()
