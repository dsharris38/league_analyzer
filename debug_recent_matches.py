
from riot_client import RiotClient
from database import Database
import pprint

def check_all_queues():
    client = RiotClient(region_key="NA") # Default NA for 'im having fun'
    
    print("Looking up account...")
    acc = client.get_account_by_riot_id("im having fun", "0001")
    puuid = acc["puuid"]
    print(f"Found PUUID: {puuid}")
    
    print("Fetching last 5 matches (ANY Queue)...")
    ids = client.get_recent_match_ids(puuid, count=5, queue=None) # None = all
    
    print(f"Found {len(ids)} matches:")
    import datetime
    for mid in ids:
        m = client.get_match(mid)
        info = m.get("info", {})
        q_id = info.get("queueId")
        creation = info.get("gameCreation")
        dt = datetime.datetime.fromtimestamp(creation / 1000)
        print(f"  {mid}: Queue {q_id} | Created: {dt}")

if __name__ == "__main__":
    check_all_queues()
