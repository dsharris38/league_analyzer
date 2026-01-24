from database import Database
import pymongo

def ensure_indexes():
    print("Connecting to MongoDB...")
    db = Database()
    if not db.is_connected:
        print("Failed to connect to DB.")
        return

    col = db._get_collection("analyses")
    if col is None:
        print("Analyses collection not found.")
        return

    print("Creating index on 'riot_id'...")
    # Unique index ensures fast lookup and prevents duplicates
    try:
        col.create_index([("riot_id", pymongo.ASCENDING)], unique=True)
        print("Index 'riot_id_1' created successfully.")
    except Exception as e:
        print(f"Index creation failed (might be duplicates?): {e}")
        # Try non-unique if duplicates exist
        col.create_index([("riot_id", pymongo.ASCENDING)])
        print("Non-unique index created as fallback.")

    # Also index 'created' for sorting
    col.create_index([("created", pymongo.DESCENDING)])
    print("Index 'created_-1' created successfully.")
    
    # NEW: Index filename_id for fast O(1) lookups
    print("Creating index on 'filename_id'...")
    col.create_index([("filename_id", pymongo.ASCENDING)])
    print("Index 'filename_id_1' created successfully.")

    print("Creating index on 'filename_id_lower'...")
    col.create_index([("filename_id_lower", pymongo.ASCENDING)])
    print("Index 'filename_id_lower_1' created successfully.")

    print("\nVerifying Indexes:")
    for idx in col.list_indexes():
        print(idx)

if __name__ == "__main__":
    ensure_indexes()
