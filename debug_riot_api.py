
import os
import requests
import json
import traceback
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("RIOT_API_KEY")
HEADERS = {"X-Riot-Token": API_KEY}

print(f"--- Debugging Riot API (By-PUUID) ---")

# Known PUUID from previous logs
puuid = "iLKI__Gn5Q6g2j030u5UdMF200rwkRpw5u3tH5LGePi_Rp5w-iFEQL81YgbeBRweR" 
# (Truncated in logs, but let's re-fetch to be safe)

# 1. Fetch PUUID again
game_name = "Bingbong"
tag_line = "nabab"

try:
    print(f"\n[1] Account Lookup: {game_name}#{tag_line}")
    url_acc = f"https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
    r = requests.get(url_acc, headers=HEADERS, timeout=10)
    
    if r.status_code == 200:
        puuid = r.json().get('puuid')
        print(f"PUUID: {puuid}")
        
        # 2. Test League V4 By PUUID
        print(f"\n[2] League V4 (By PUUID) - na1")
        url_league = f"https://na1.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}"
        print(f"Fetching: {url_league}")
        
        r_league = requests.get(url_league, headers=HEADERS, timeout=10)
        print(f"Status: {r_league.status_code}")
        
        if r_league.status_code == 200:
            entries = r_league.json()
            print(f"Success! Found {len(entries)} entries.")
            print(json.dumps(entries, indent=2))
        else:
            print(f"Failed. Status: {r_league.status_code}")
            print(r_league.text)
            
    else:
        print(f"Account lookup might be rate limited: {r.status_code}")
        print(r.text)

except Exception as e:
    print(f"Failed: {e}")
    traceback.print_exc()
