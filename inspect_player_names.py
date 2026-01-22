
import json
import os

# Path to a recent match file
file_path = r"c:\Users\Dylan\OneDrive - Yale University\league_analyzer\saves_backup\cache\matches\NA1_5440971601.json"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Match ID: {data['metadata']['matchId']}")
print("-" * 40)
print(f"{'PUUID':<40} | {'SummonerName':<20} | {'RiotID':<30}")
print("-" * 40)

info = data.get("info", {})
participants = info.get("participants", [])

for p in participants:
    puuid = p.get("puuid", "")[:35] + "..."
    s_name = p.get("summonerName", "N/A")
    r_name = p.get("riotIdGameName", "N/A")
    r_tag = p.get("riotIdTagLine", "N/A")
    riot_id = f"{r_name}#{r_tag}"
    
    print(f"{puuid:<40} | {s_name:<20} | {riot_id:<30}")
