
from database import Database
import time

def test_save_new_analysis():
    print("--- Test: Simulate New Analysis Save ---")
    db = Database()
    
    # 1. Create a mock new analysis payload (as if from run_analysis_pipeline)
    # Using a unique ID to simulate a "new" user
    unique_tag = int(time.time())
    riot_id = f"NewUser#{unique_tag}"
    
    payload = {
        "riot_id": riot_id,
        "region": "NA",
        "summary": {"games": 10, "wins": 5},
        "analysis": {"detailed_matches": []}
    }
    
    print(f"Saving new payload for: {riot_id}")
    db.save_analysis(payload)
    
    # 2. Immediately try to find it using the fuzzy finder (simulating the view)
    # The view constructs a 'filename' like: league_analysis_NewUser_12345.json
    
    # Logic from Views.py:
    # core_id = filename.strip().rstrip('/')
    # if core_id.lower().startswith("league_analysis_"):
    #     core_id = core_id[16:]
    # if core_id.lower().endswith(".json"):
    #     core_id = core_id[:-5]
        
    expected_filename_id = riot_id.replace("#", "_")
    virtual_filename = f"league_analysis_{expected_filename_id}.json"
    
    print(f"Simulating lookup for virtual filename: {virtual_filename}")
    
    # View Logic Simulation
    core_id = virtual_filename
    if core_id.startswith("league_analysis_"):
        core_id = core_id[16:]
    if core_id.endswith(".json"):
        core_id = core_id[:-5]
        
    print(f"Core ID extracted: {core_id}")
    
    # Direct DB Verification of fields
    saved_doc = db.get_analysis(riot_id)
    if not saved_doc:
        print("CRITICAL: Document was not saved at all!")
        return

    print(f"Saved Doc Keys: {list(saved_doc.keys())}")
    print(f"filename_id: {saved_doc.get('filename_id')}")
    print(f"filename_id_lower: {saved_doc.get('filename_id_lower')}")
    
    if saved_doc.get("filename_id") == expected_filename_id:
        print("SUCCESS: filename_id generated correctly.")
    else:
        print(f"FAILURE: filename_id missing or incorrect. Got: {saved_doc.get('filename_id')}")

    # Fuzzy Find Verification
    found = db.find_analysis_by_fuzzy_filename(core_id)
    if found:
        print(f"SUCCESS: find_analysis_by_fuzzy_filename FOUND the record via '{core_id}'")
        print(f"Matched Riot ID: {found.get('riot_id')}")
    else:
        print(f"FAILURE: find_analysis_by_fuzzy_filename DID NOT find the record via '{core_id}'")

if __name__ == "__main__":
    test_save_new_analysis()
