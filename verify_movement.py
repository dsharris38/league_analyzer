
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

def verify_movement():
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
        
        movement = analyze_timeline_movement(match, timeline, puuid)
        
        samples = movement.get("position_samples", [])
        print(f"Total position samples: {len(samples)}")
        
        # Print first 20 samples to check intervals
        print("First 20 samples:")
        for i, s in enumerate(samples[:20]):
            print(f"Sample {i}: {s['time_min']:.2f}m ({int(s['time_min']*60000)}ms) - {s['zone']}")
            
        # Check if we have any non-minute intervals
        non_minute_samples = [s for s in samples if int(s['time_min']*60000) % 60000 != 0]
        print(f"Non-minute samples found: {len(non_minute_samples)}")
        if non_minute_samples:
            print("Example non-minute sample:", non_minute_samples[0])

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_movement()
