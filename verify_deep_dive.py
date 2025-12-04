import json
import os
from pathlib import Path
from league_crew import identify_review_candidates, analyze_specific_game

# Load an existing analysis file
SAVE_FILE = Path("saves/league_analysis_Potato Grip_na1.json")

def verify():
    output = []
    if not SAVE_FILE.exists():
        output.append(f"File not found: {SAVE_FILE}")
        with open("verify_output.txt", "w") as f:
            f.write("\n".join(output))
        return

    output.append(f"Loading {SAVE_FILE}...")
    with open(SAVE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    analysis = data.get("analysis", {})
    
    # 1. Test Review Candidates
    output.append("\n--- Testing identify_review_candidates ---")
    candidates = identify_review_candidates(analysis)
    output.append(f"Found {len(candidates)} candidates.")
    for c in candidates:
        output.append(f"Match {c['match_id']} ({c['champion']}): {c['reasons']}")

    if not candidates:
        output.append("No candidates found. Picking a random match for deep dive test.")
        detailed_matches = analysis.get("detailed_matches", [])
        if detailed_matches:
            target_match = detailed_matches[0]
            match_id = target_match["match_id"]
        else:
            output.append("No matches found in analysis.")
            with open("verify_output.txt", "w") as f:
                f.write("\n".join(output))
            return
    else:
        # Pick the top candidate
        match_id = candidates[0]["match_id"]
        detailed_matches = analysis.get("detailed_matches", [])
        target_match = next((m for m in detailed_matches if m["match_id"] == match_id), None)

    if not target_match:
        output.append(f"Could not find match data for {match_id}")
        with open("verify_output.txt", "w") as f:
            f.write("\n".join(output))
        return

    # 2. Test Deep Dive Analysis
    output.append(f"\n--- Testing analyze_specific_game for {match_id} ---")
    
    try:
        report = analyze_specific_game(match_id, target_match)
        output.append("\nResult:")
        output.append(report[:1000])
    except Exception as e:
        output.append(f"Deep dive failed: {e}")

    with open("verify_output.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(output))

if __name__ == "__main__":
    verify()
