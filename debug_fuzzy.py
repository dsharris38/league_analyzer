
import os
import sys
from pathlib import Path
import re

# Add current dir to path to find match_history_analyzer/database.py
# Assuming script is run from root "league_analyzer"
sys.path.append(str(Path.cwd()))

from database import Database

def test_fuzzy():
    print("Initializing Database...")
    db = Database()
    docs = db.list_analyses()
    print(f"Found {len(docs)} docs in DB.")
    
    failures = []
    
    for d in docs:
        r_id = d['riot_id'] # e.g. "Doublelift#NA1"
        
        # Emulate how views.py receives the filename
        # views.py receives "league_analysis_Doublelift_NA1.json"
        # and strips it to "Doublelift_NA1"
        # We simulate the filename generation from database.py logic:
        # filename = f"league_analysis_{doc.get('riot_id').replace('#','_')}.json"
        
        simulated_filename = f"league_analysis_{r_id.replace('#','_')}.json"
        core_name = simulated_filename.replace('league_analysis_', '').replace('.json', '')
        
        # Now test the fuzzy finder with this core_name
        print(f"Test: ID='{r_id}' -> FileCore='{core_name}'")
        
        found = db.find_analysis_by_fuzzy_filename(core_name)
        
        if found and found['riot_id'] == r_id:
            print("  [PASS]")
        else:
            print(f"  [FAIL] Found: {found.get('riot_id') if found else 'None'}")
            failures.append((r_id, core_name))

    print("\n--- SUMMARY ---")
    if failures:
        print(f"FAILED: {len(failures)}/{len(docs)}")
        for f in failures:
            print(f"  ID: {f[0]} | Core: {f[1]}")
    else:
        print("ALL PASSED. Logic is correct.")

if __name__ == "__main__":
    test_fuzzy()
