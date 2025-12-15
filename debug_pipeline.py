import os
import sys
from pathlib import Path
import json

# Add project root to path
sys.path.append(os.getcwd())

from riot_client import RiotClient
# from config import get_config # CAUSE OF ERROR

# Manually load env just in case
from dotenv import load_dotenv
load_dotenv(".env")

def debug_fetch():
    riot_id = "Bingbong#NAbab"
    print(f"--- Debugging Data Fetch for {riot_id} ---")
    
    try:
        game_name, tag_line = riot_id.split("#")
    except ValueError:
        print("Invalid Riot ID format")
        return

    # Initialize Client (simulating main.py)
    # main.py defaults region_key="NA" if not specified, 
    # but passed region_key to RiotClient.__init__?
    # Let's check how main.py does it: client = RiotClient(region_key=region_key)
    client = RiotClient(region_key="NA") 
    print(f"RiotClient Region: {client.region} (Platform: {client.platform})")

    # 1. Get Account
    try:
        print("1. Fetching Account...")
        account = client.get_account_by_riot_id(game_name, tag_line)
        print(f"   SUCCESS: PUUID: {account.get('puuid')}")
        print(f"   GameName: {account.get('gameName')}#{account.get('tagLine')}")
        puuid = account['puuid']
    except Exception as e:
        print(f"   FAILED: {e}")
        return

    # 2. Get Summoner
    try:
        print("\n2. Fetching Summoner (Profile/Level)...")
        summoner = client.get_summoner_by_puuid(puuid)
        print("   --- RAW JSON RESPONSE ---")
        print(json.dumps(summoner, indent=4))
        print("   --- KEYS ---")
        print(f"   Keys found: {list(summoner.keys())}")
        
        if 'id' in summoner:
            print(f"   SUCCESS: Level={summoner.get('summonerLevel')}, Icon={summoner.get('profileIconId')}")
            # Try debugging rank here directly
            print("\n3. Fetching League Entries (Rank)...")
            entries = client.get_league_entries(summoner['id'])
            print(f"   Raw Entries: {json.dumps(entries, indent=4)}")
            
        else:
            print("   WARNING: 'id' missing in response key list.")
            print("   Attempting Fallback via Match V5...")
            
            try:
                # 1. Get Match IDs
                match_ids = client.get_recent_match_ids(puuid, count=1)
                if not match_ids:
                    print("   FALLBACK FAILED: No matches found.")
                    return
                
                # 2. Get Match Details
                latest_match_id = match_ids[0]
                print(f"   Fetching match {latest_match_id}...")
                match_data = client.get_match(latest_match_id)
                
                # 3. Find Participant
                participants = match_data.get('info', {}).get('participants', [])
                me = next((p for p in participants if p.get('puuid') == puuid), None)
                
                if me and 'summonerId' in me:
                    summoner_id = me['summonerId']
                    print(f"   SUCCESS: Found Fallback Summoner ID: {summoner_id}")
                    
                    # 4. Fetch Rank
                    print("\n3. (Fallback) Fetching League Entries...")
                    entries = client.get_league_entries(summoner_id)
                    print(f"   Raw Entries: {json.dumps(entries, indent=4)}")
                else:
                    print("   FALLBACK FAILED: Summoner ID not found in match participants.")
                    print(f"   Participant Keys: {list(me.keys()) if me else 'None'}")
                    
            except Exception as e:
                print(f"   FALLBACK ERROR: {e}")
    except Exception as e:
        print(f"   FAILED: {e}")
        return

if __name__ == "__main__":
    debug_fetch()
