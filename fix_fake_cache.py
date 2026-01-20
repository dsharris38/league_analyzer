
from database import Database

def run():
    db = Database()
    
    # 1. Load the document (using logic from the test script)
    doc = db.find_analysis_by_fuzzy_filename("Bingbong_NAbab")
    if not doc:
        print("Could not find Bingbong analysis to clean.")
        return

    riot_id = doc.get("riot_id")
    print(f"Cleaning Analysis for: {riot_id}")

    # 2. Iterate matches and find the fake report
    detailed_matches = doc.get("analysis", {}).get("detailed_matches", [])
    modified = False
    
    for m in detailed_matches:
        report = m.get("deep_dive_report", "")
        # Check for the specific marker we used
        if "CACHED_REPORT_VERIFICATION_SUCCESS" in report or "This is a fake report" in report:
            print(f"Found Fake Report in match {m.get('match_id')}. Cleaning...")
            m["deep_dive_report"] = None # Clear it
            modified = True
            
    if modified:
        db.save_analysis(doc)
        print("✅ Cleanup Successful. Fake report removed.")
    else:
        print("No fake reports found.")

if __name__ == "__main__":
    run()
