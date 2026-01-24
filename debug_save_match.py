
from riot_client import RiotClient
from database import Database
import pprint

def try_save():
    client = RiotClient(region_key="NA")
    db = Database()
    
    mid = "NA1_5472895375"
    print(f"Fetching match {mid}...")
    match_data = client.get_match(mid)
    
    if not match_data:
        print("Failed to fetch match data!")
        return

    print("Attempting to save to DB...")
    try:
        db.save_match(match_data)
        print("Save SUCCESSFUL!")
    except Exception as e:
        print(f"Save FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try_save()
