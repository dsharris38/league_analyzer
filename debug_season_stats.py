
import os
import sys
import django
from pathlib import Path

# Setup Django setup
sys.path.append(str(Path.cwd()))
sys.path.append(str(Path.cwd() / "web_dashboard" / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "web_dashboard.backend.dashboard_project.settings")
django.setup()

from database import Database
from analyzer import calculate_season_stats_from_db

def test_season_stats():
    db = Database()
    # Get a cached analysis to find a generic PUUID
    col = db._get_collection("analysis")
    doc = col.find_one({})
    if not doc:
        print("No analysis found in DB to test with.")
        return

    puuid = doc.get("puuid")
    riot_id = doc.get("riot_id", "Unknown")
    print(f"Testing season stats for {riot_id} (PUUID: {puuid})...")

    try:
        stats = calculate_season_stats_from_db(puuid)
        print("Season Stats Result Keys:", stats.keys())
        if "champions" in stats:
            print(f"Found {len(stats['champions'])} champions.")
            if len(stats["champions"]) > 0:
                print("First Champ:", stats["champions"][0])
        else:
            print("WARNING: 'champions' key missing!")
            print("Full Stats:", stats)
            
    except Exception as e:
        print(f"CRASHED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_season_stats()
