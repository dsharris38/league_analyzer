
import os
import sys
import json
from pathlib import Path

# Setup Django environment to reuse RiotClient
BASE_DIR = Path(__file__).resolve().parent / 'web_dashboard' / 'backend'
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from riot_client import RiotClient

def dump_timeline():
    client = RiotClient()
    # Use a known match ID if possible, or fetch recent
    # I'll fetch the most recent match for a known user
    try:
        account = client.get_account_by_riot_id("Potato Grip", "NA1")
        puuid = account["puuid"]
        match_ids = client.get_recent_match_ids(puuid, 1)
        if not match_ids:
            print("No matches found.")
            return

        match_id = match_ids[0]
        print(f"Fetching timeline for {match_id}...")
        timeline = client.get_match_timeline(match_id)
        
        # Dump the first few frames to see the interval
        frames = timeline.get("info", {}).get("frames", [])
        print(f"Total frames: {len(frames)}")
        
        for i, frame in enumerate(frames[:5]):
            ts = frame.get("timestamp", 0)
            print(f"FRAME_{i}_TS: {ts}")
            pf = frame.get("participantFrames", {})
            if pf:
                # Get first participant found
                pid = list(pf.keys())[0]
                pos = pf[pid].get("position", {})
                print(f"FRAME_{i}_POS: {pos}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    dump_timeline()
