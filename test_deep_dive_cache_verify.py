import requests
import json
from database import Database

BASE_URL = "http://localhost:8000/api"

def run():
    db = Database()
    
    # 1. Find Bingbong
    # Try fuzzy or exact
    doc = db.find_analysis_by_fuzzy_filename("Bingbong_NAbab")
    if not doc:
        # Try getting any
        analyses = db.list_analyses()
        if not analyses:
            print("No analyses found to test.")
            return
        # Use first one
        target_fname = analyses[0]['filename']
        # Extract core ID from filename? No, we need to load doc to edit it.
        # list_analyses returns 'riot_id'.
        riot_id = analyses[0]['riot_id']
        doc = db.get_analysis(riot_id)
    
    if not doc:
        print("Could not load document.")
        return
        
    riot_id = doc.get("riot_id")
    filename = f"league_analysis_{riot_id.replace('#', '_')}.json"
    print(f"Testing on: {riot_id} (File: {filename})")
    
    # 2. Get Match
    analysis = doc.get("analysis", {})
    detailed_matches = analysis.get("detailed_matches", [])
    if not detailed_matches:
        print("No matches in analysis.")
        return
        
    target_match = detailed_matches[0]
    match_id = target_match["match_id"]
    print(f"Target Match: {match_id}")
    
    # 3. Inject Fake Cache
    FAKE_REPORT = "## CACHED_REPORT_VERIFICATION_SUCCESS\nThis is a fake report."
    
    # Update local doc
    target_match["deep_dive_report"] = FAKE_REPORT
    
    # Update list
    detailed_matches[0] = target_match
    doc["analysis"]["detailed_matches"] = detailed_matches
    
    # Save
    db.save_analysis(doc)
    print("Injected fake cache into DB.")
    
    # 4. Call API
    url = f"{BASE_URL}/analyses/{filename}/deep_dive/"
    print(f"POST {url}")
    res = requests.post(url, json={"match_id": match_id})
    
    if res.status_code == 200:
        data = res.json()
        report = data.get("report", "")
        if FAKE_REPORT in report:
            print("SUCCESS: API returned cached report!")
        else:
            print("FAILURE: API returned something else.")
            print(f"Got: {report[:100]}...")
    else:
        print(f"FAILURE: API Error {res.status_code}")
        print(res.text)

if __name__ == "__main__":
    run()
