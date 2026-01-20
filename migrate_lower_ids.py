
from database import Database
import time

print("--- Migration: Backfill filename_id_lower ---")
db = Database()
col = db._get_collection("analyses")

cursor = col.find({})
count = 0
updated = 0

for doc in cursor:
    count += 1
    rid = doc.get("riot_id")
    fid = doc.get("filename_id")
    
    updates = {}
    
    # Ensure filename_id exists
    if not fid and rid:
        fid = rid.replace("#", "_")
        updates["filename_id"] = fid
        
    # Ensure filename_id_lower exists
    if fid:
        fid_lower = fid.lower()
        if doc.get("filename_id_lower") != fid_lower:
            updates["filename_id_lower"] = fid_lower
            
    if updates:
        col.update_one({"_id": doc["_id"]}, {"$set": updates})
        print(f"Updated {rid}: {updates}")
        updated += 1

print(f"Migration Complete. Scanned {count}, Updated {updated}.")
