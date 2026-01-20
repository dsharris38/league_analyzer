from database import Database
import pymongo

def migrate_filename_ids():
    print("Connecting to MongoDB for Migration...")
    db = Database()
    if not db.is_connected:
        print("DB Connection Failed.")
        return

    col = db._get_collection("analyses")
    print(f"Total Documents: {col.count_documents({})}")
    
    # 1. Create Index first (Unique?)
    print("Creating index on 'filename_id'...")
    try:
        col.create_index([("filename_id", pymongo.ASCENDING)], unique=True)
        print("Unique Index 'filename_id_1' created.")
    except:
        print("Unique Index failed (duplicates?), creating non-unique.")
        col.create_index([("filename_id", pymongo.ASCENDING)])

    # 2. Iterate and Update
    cursor = col.find({})
    count = 0
    updated = 0
    
    for doc in cursor:
        count += 1
        riot_id = doc.get("riot_id")
        if not riot_id: continue
        
        # Logic: matches database.py save_analysis
        new_fid = riot_id.replace("#", "_")
        
        # Check if update needed
        if doc.get("filename_id") != new_fid:
            col.update_one({"_id": doc["_id"]}, {"$set": {"filename_id": new_fid}})
            updated += 1
            print(f"Updated: {riot_id} -> {new_fid}")
            
    print(f"\nMigration Complete.")
    print(f"Scanned: {count}")
    print(f"Updated: {updated}")

if __name__ == "__main__":
    migrate_filename_ids()
