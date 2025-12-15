import json
from pathlib import Path

path = Path(r"c:\Users\Dylan\OneDrive - Yale University\league_analyzer\saves\league_analysis_Bingbong_nabab.json")
try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
        print("Summoner Info:", data.get("summoner_info"))
        print("Rank Info:", data.get("rank_info"))
        print("Past Ranks:", data.get("past_ranks"))
except Exception as e:
    print(f"Error: {e}")
