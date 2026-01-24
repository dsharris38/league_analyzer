
from database import Database
import pprint

def inspect():
    db = Database()
    col = db._get_collection("analyses")
    
    print("Searching for 'fun'...")
    # Regex search for anything with "fun" and "0001"
    cursor = col.find({"riot_id": {"$regex": "fun", "$options": "i"}})
    
    found = False
    for doc in cursor:
        found = True
        print("\nFound Document:")
        if "summoner_info" in doc:
            s = doc["summoner_info"]
            with open("db_value_check.txt", "w") as f:
                f.write(f"Level: {s.get('summonerLevel')}\n")
                f.write(f"Icon: {s.get('profileIconId')}\n")
                f.write(f"Created: {doc.get('created')}\n")
            print("Wrote to db_value_check.txt")
        else:
            print("No summoner info")
        print(f"  filename_id_lower: '{doc.get('filename_id_lower')}'")
        print(f"  created: {doc.get('created')}")
        
        matches = doc.get("analysis", {}).get("detailed_matches", [])
        if matches:
            latest = matches[0]
            print(f"  Latest Match: {latest.get('match_id')} ({latest.get('game_creation')})")
        else:
            print("  Latest Match: None")
        
    if not found:
        print("No documents found containing 'fun'.")

if __name__ == "__main__":
    inspect()
