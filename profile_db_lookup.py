import time
from database import Database
import sys

def profile_lookup(filename_virtual):
    print(f"--- Profiling Lookup for: {filename_virtual} ---")
    
    t0 = time.time()
    db = Database()
    t_connect = time.time() - t0
    print(f"DB Connect: {t_connect:.4f}s")
    
    if not db.is_connected:
        print("DB Not Connected!")
        return

    # Simulate View Logic
    if filename_virtual.startswith("league_analysis_") and filename_virtual.endswith(".json"):
        core = filename_virtual[len("league_analysis_"):-5]
    else:
        core = filename_virtual
    
    print(f"Core Name: {core}")
    
    t1 = time.time()
    doc = db.find_analysis_by_fuzzy_filename(core)
    t_lookup = time.time() - t1
    print(f"Lookup Time: {t_lookup:.4f}s")
    
    if doc:
        import json
        payload_str = json.dumps(doc)
        size_mb = len(payload_str) / (1024 * 1024)
        print(f"Document Found! Size: {size_mb:.2f} MB")
        print(f"Riot ID: {doc.get('riot_id')}")
    else:
        print("Document NOT FOUND")

if __name__ == "__main__":
    # Test with a likely existing file pattern from the user's context or previous logs
    # I'll use a placeholder, but if I knew the user's ID it would be better.
    # I'll try to list analyses first to pick one.
    
    db = Database()
    files = db.list_analyses()
    if files:
        target = files[0]['filename']
        profile_lookup(target)
    else:
        print("No analyses found to profile.")
