import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv(".env")
API_KEY = os.getenv("RIOT_API_KEY")
HEADERS = {"X-Riot-Token": API_KEY}

def inspect_ids():
    riot_id = "Bingbong#NAbab"
    print(f"--- Inspecting IDs for {riot_id} ---")
    
    # 1. Get PUUID
    url_acct = "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Bingbong/NAbab"
    resp = requests.get(url_acct, headers=HEADERS)
    if resp.status_code != 200:
        print(f"Acct Failed: {resp.text}")
        return
    puuid = resp.json()['puuid']
    print(f"PUUID: {puuid}")

    # 2. Get 5 Matches
    url_matches = f"https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=5"
    resp = requests.get(url_matches, headers=HEADERS)
    match_ids = resp.json()
    print(f"Matches: {match_ids}")

    # 3. Check IDs in each
    unique_ids = set()
    
    for mid in match_ids:
        print(f"\nChecking {mid}...")
        url_match = f"https://americas.api.riotgames.com/lol/match/v5/matches/{mid}"
        r = requests.get(url_match, headers=HEADERS)
        if r.status_code != 200:
            print("  Failed to fetch.")
            continue
            
        parts = r.json().get('info', {}).get('participants', [])
        me = next((p for p in parts if p.get('puuid') == puuid), None)
        
        if me:
            sid = me.get('summonerId')
            creation = r.json().get('info', {}).get('gameCreation')
            import datetime
            dt = datetime.datetime.fromtimestamp(creation / 1000)
            print(f"  SummonerID: {sid}")
            print(f"  Date: {dt}")
            unique_ids.add(sid)
        else:
            print("  Participant not found via PUUID?")

    print(f"\nUnique IDs found: {unique_ids}")
    
    # 4. Test League V4 on each unique ID
    for sid in unique_ids:
        if not sid: continue
        print(f"\nTesting League V4 with ID: {sid}...")
        url_league = f"https://na1.api.riotgames.com/lol/league/v4/entries/by-summoner/{sid}"
        r = requests.get(url_league, headers=HEADERS)
        print(f"  League Status: {r.status_code}")
        
        print(f"Testing TFT League V1 with ID: {sid}...")
        url_tft = f"https://na1.api.riotgames.com/tft/league/v1/entries/by-summoner/{sid}"
        r_tft = requests.get(url_tft, headers=HEADERS)
        print(f"  TFT Status: {r_tft.status_code}")

if __name__ == "__main__":
    inspect_ids()
