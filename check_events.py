
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

def check_event_types():
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
        print(f"Checking events for {match_id}...")
        
        timeline = client.get_match_timeline(match_id)
        info = timeline.get("info", {})
        frames = info.get("frames", [])
        
        event_types = set()
        jungle_events = []
        
        for frame in frames:
            for event in frame.get("events", []):
                etype = event.get("type")
                event_types.add(etype)
                
                if "JUNGLE" in etype or "MONSTER" in etype:
                    jungle_events.append(event)
                    
        print("\nUnique Event Types Found:")
        for et in sorted(event_types):
            print(f"- {et}")
            
        print(f"\nTotal Jungle/Monster Events: {len(jungle_events)}")
        if jungle_events:
            print("Example Jungle Event:", jungle_events[0])

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_event_types()
