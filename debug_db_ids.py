from database import Database

def dump_ids():
    db = Database()
    col = db._get_collection("analyses")
    print("Listing all Riot IDs and Filename IDs in DB:")
    for doc in col.find({}, {"riot_id": 1, "filename_id": 1, "_id": 0}):
        print(f"RiotID: '{doc.get('riot_id')}' | FID: '{doc.get('filename_id')}'")

if __name__ == "__main__":
    dump_ids()
