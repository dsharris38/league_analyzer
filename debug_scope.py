import os
import sys
import json
import requests
from dotenv import load_dotenv

# Load Env
load_dotenv(".env")
API_KEY = os.getenv("RIOT_API_KEY")

def debug_scope():
    if not API_KEY:
        print("ERROR: No RIOT_API_KEY found in .env")
        return

    print(f"Testing API Key: {API_KEY[:5]}...{API_KEY[-5:]}")
    
    headers = {"X-Riot-Token": API_KEY}
    
    # 1. Test Account V1 (Known Good)
    print("\n1. Testing Account V1 (PUUID Lookup)...")
    url_acct = "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Bingbong/NAbab"
    resp_acct = requests.get(url_acct, headers=headers)
    print(f"   Status: {resp_acct.status_code}")
    if resp_acct.status_code != 200:
        print(f"   Response: {resp_acct.text}")
    else:
        print("   Success.")

    # 2. Test League V4 GENERIC (No IDs involved)
    print("\n2. Testing League V4 (Challenger League)...")
    url_league = "https://na1.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5"
    resp_league = requests.get(url_league, headers=headers)
    print(f"   Status: {resp_league.status_code}")
    if resp_league.status_code == 200:
        print("   SUCCESS: API Key has access to League V4.")
    elif resp_league.status_code == 403:
        print("   FAILURE (403): API Key is FORBIDDEN from League V4 endpoints.")
        print("      -> Possible Cause: Key Expired, League API scope disabled, or Blacklisted.")
    else:
        print(f"   FAILURE ({resp_league.status_code}): {resp_league.text}")

    # 3. Test Status V4 (Generic)
    print("\n3. Testing Status V4 (Should always work)...")
    url_status = "https://na1.api.riotgames.com/lol/status/v4/platform-data"
    resp_status = requests.get(url_status, headers=headers)
    print(f"   Status: {resp_status.status_code}")

if __name__ == "__main__":
    debug_scope()
