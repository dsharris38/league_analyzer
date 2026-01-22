
import sys
import os
import json
from collections import defaultdict

# Setup paths
sys.path.append(os.getcwd())

# Mock Database
class MockDatabase:
    def get_matches_by_puuid(self, puuid, limit=1000):
        # Scan cache for a file that contains this puuid
        # For simplicity, load the known cache file we used before
        path = r"saves_backup\cache\matches\NA1_5440971601.json"
        if os.path.exists(path):
             with open(path, "r") as f:
                return [json.load(f)]
        return []
    
    def get_matches_bulk(self, match_ids):
        return {}

import analyzer
import database
database.Database = MockDatabase

# Get a target PUUID (User associated with that match)
# The user in that match (NA1_5440971601) is likely the first participant or we can pick one.
def get_target_puuid():
    path = r"saves_backup\cache\matches\NA1_5440971601.json"
    if os.path.exists(path):
        with open(path, "r") as f:
            data = json.load(f)
            return data["info"]["participants"][0]["puuid"] # Use the first player as "me"
    return "dummy_puuid"

target_puuid = get_target_puuid()
print(f"Target PUUID: {target_puuid}")

# Run Stats
stats = analyzer.calculate_season_stats_from_db(target_puuid)

print("\n--- FINAL DUOS OUTPUT ---")
print(json.dumps(stats.get("duos", []), indent=2))
