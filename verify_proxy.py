
import os
import sys
import json
from pathlib import Path

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent / 'web_dashboard' / 'backend'
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from riot_client import RiotClient
from timeline_analyzer import analyze_timeline_movement

def verify_proxy():
    client = RiotClient()
    try:
        # Use a known match ID or fetch recent
        account = client.get_account_by_riot_id("Potato Grip", "NA1")
        puuid = account["puuid"]
        match_ids = client.get_recent_match_ids(puuid, 1)
        if not match_ids:
            print("No matches found.")
            return

        match_id = match_ids[0]
        print(f"Analyzing movement for {match_id}...")
        
        match = client.get_match(match_id)
        timeline = client.get_match_timeline(match_id)
        
        # We need to force a role to test proxy logic if the player isn't a laner
        # But analyze_timeline_movement infers role. Let's see what it does.
        movement = analyze_timeline_movement(match, timeline, puuid)
        
        samples = movement.get("position_samples", [])
        
        # Check for samples that match our proxy coordinates
        # Mid: (7400, 7400), Top: (1500, 13500), Bot: (13500, 1500)
        proxy_hits = 0
        for s in samples:
            x, y = s['x'], s['y']
            if (x == 7400 and y == 7400) or \
               (x == 1500 and y == 13500) or \
               (x == 13500 and y == 1500):
                proxy_hits += 1
                print(f"Proxy Sample Found: {s['time_min']:.2f}m at ({x}, {y})")
        
        print(f"Total position samples: {len(samples)}")
        print(f"Proxy samples injected: {proxy_hits}")
        
        if proxy_hits > 0:
            print("Success: Minion wave proxy logic is working.")
        else:
            print("Note: No proxy samples found. This might be correct if there were no large gaps or player wasn't a laner.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_proxy()
