
from riot_client import RiotClient
import pprint

def check_level():
    client = RiotClient(region_key="NA")
    print("Fetching Account 'im having fun#0001'...")
    
    try:
        # Get Account
        acc = client.get_account_by_riot_id("im having fun", "0001")
        print("Account Data:")
        pprint.pprint(acc)
        
        puuid = acc["puuid"]
        
        # Get Summoner
        print("\nFetching Summoner by PUUID...")
        summoner = client.get_summoner_by_puuid(puuid)
        print("Summoner Data:")
        pprint.pprint(summoner)
        
        with open("level_check.txt", "w") as f:
            f.write(f"Level: {summoner['summonerLevel']}\n")
            f.write(f"Icon: {summoner['profileIconId']}\n")
            f.write(f"RevisionDate: {summoner['revisionDate']}\n")

        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_level()
