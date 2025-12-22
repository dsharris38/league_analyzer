from database import Database

def clean_db():
    print("Connecting to DB...")
    db = Database()
    if not db.is_connected:
        print("Failed to connect!")
        return

    print("Deleting 'TestUser#123' if exists...")
    col = db._get_collection("analyses")
    if col is not None:
        result = col.delete_one({"riot_id": "TestUser#123"})
        print(f"Deleted {result.deleted_count} document(s).")
    else:
        print("Collection not found.")

if __name__ == "__main__":
    clean_db()
