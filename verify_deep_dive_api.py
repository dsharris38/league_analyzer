import json
import os
from pathlib import Path
from league_crew import analyze_specific_game

# Mock loading env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("python-dotenv not found, assuming env vars are set or will fail.")

SAVES_DIR = Path("saves")
FILENAME = "league_analysis_Potato Grip_na1.json"
MATCH_ID = "NA1_5425892216"

def verify():
    file_path = SAVES_DIR / FILENAME
    if not file_path.exists():
        print(f"File not found: {file_path}")
        return

    print(f"Loading {file_path}...")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    analysis = data.get("analysis", {})
    detailed_matches = analysis.get("detailed_matches", [])
    
    target_match = next((m for m in detailed_matches if m["match_id"] == MATCH_ID), None)
    
    if not target_match:
        print(f"Match {MATCH_ID} not found in file.")
        return

    print(f"Found match {MATCH_ID}. Calling analyze_specific_game...")
    
    # Check API Key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("WARNING: GEMINI_API_KEY is not set in environment.")
    else:
        print("GEMINI_API_KEY is set.")

    report = analyze_specific_game(MATCH_ID, target_match)
    
    print("\n--- Report Result ---")
    print(report[:500] + "..." if len(report) > 500 else report)
    print("\n---------------------")

if __name__ == "__main__":
    verify()
