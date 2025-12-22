from database import Database

def check_analyses():
    print("Connecting to DB...")
    db = Database()
    if not db.is_connected:
        print("Failed to connect!")
        return

    print("Listing databases...")
    print(db._client.list_database_names())
    
    print("Checking 'league_analyzer' stats...")
    print(f"Collections: {db._db.list_collection_names()}")
    
    col = db._get_collection("analyses")
    if col is not None:
        count = col.count_documents({})
        print(f"Count in 'analyses': {count}")
        if count > 0:
            print("Listing ALL documents brief:")
            for doc in col.find({}, {"riot_id": 1, "analysis": 1}):
                 has_analysis = "analysis" in doc
                 print(f" - ID: {doc.get('riot_id')} | Has Analysis: {has_analysis}")
    else:
        print("Collection 'analyses' missing.")

if __name__ == "__main__":
    check_analyses()
