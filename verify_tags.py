import json
import os
from pathlib import Path
from league_crew import classify_matches_and_identify_candidates

# Mock loading env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SAVES_DIR = Path("saves")
files = list(SAVES_DIR.glob("league_analysis_*.json"))
if not files:
    print("No save files found.")
    exit()
    
latest_file = max(files, key=os.path.getmtime)

with open(latest_file, "r", encoding="utf-8") as f:
    data = json.load(f)

analysis = data.get("analysis", {})
detailed_matches = analysis.get("detailed_matches", [])

candidates, match_tags = classify_matches_and_identify_candidates(analysis)

with open("verify_tags_output_utf8.txt", "w", encoding="utf-8") as out:
    for mid, tags in match_tags.items():
        d_match = next((m for m in detailed_matches if m["match_id"] == mid), None)
        if not d_match:
            continue
            
        self_p = next((p for p in d_match["participants"] if p.get("is_self")), None)
        if not self_p:
            continue
            
        team_id = self_p.get("teamId")
        teammates = [p for p in d_match["participants"] if p.get("teamId") == team_id]
        team_kills = sum(p.get("kills", 0) for p in teammates)
        
        kills = float(self_p.get("kills", 0))
        deaths = float(self_p.get("deaths", 0))
        assists = float(self_p.get("assists", 0))
        kda = (kills + assists) / max(1, deaths)
        
        kp_calc = (kills + assists) / team_kills if team_kills > 0 else 0.0
        
        out.write(f"Match {mid}: {tags}\n")
        out.write(f"  TeamId: {team_id}, Teammates found: {len(teammates)}, Team Kills: {team_kills}\n")
        out.write(f"  Calc KP: {kp_calc:.2f}\n")
        
print("Output written to verify_tags_output_utf8.txt")
