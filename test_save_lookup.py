from database import Database
import time

def test_save_lookup():
    print("Test: Self-Healing Performance (Save New -> Lookup)")
    db = Database()
    
    # 1. Save New Data
    fid = "PerformanceTest#NA1"
    payload = {
        "riot_id": fid,
        "region": "NA",
        "match_count_requested": 1,
        "summary": {"test": True}
    }
    
    print(f"Saving {fid}...")
    db.save_analysis(payload)
    
    # 2. Lookup by Filename
    # Frontend sends: league_analysis_PerformanceTest_NA1.json
    virtual_name = "PerformanceTest_NA1" # matches replace('#', '_')
    
    print(f"Looking up {virtual_name}...")
    t0 = time.time()
    doc = db.find_analysis_by_fuzzy_filename(virtual_name)
    dur = time.time() - t0
    
    if doc:
        print(f"SUCCESS! Found doc in {dur:.4f}s")
        print(f"FID Field: {doc.get('filename_id')}")
    else:
        print(f"FAILED! Doc not found. Duration: {dur:.4f}s")

if __name__ == "__main__":
    test_save_lookup()
