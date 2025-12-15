
import json
import os

file_path = "saves/league_analysis_Bingbong_nabab.json"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    # Try finding any json file
    files = [f for f in os.listdir("saves") if f.endswith(".json") and "cache" not in f]
    if files:
        file_path = os.path.join("saves", files[0])
        print(f"Reading alternative file: {file_path}")
    else:
        print("No analysis files found.")
        exit()

try:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print(f"Keys in root: {list(data.keys())}")
    
    if "summoner_info" in data:
        print("\n--- SUMMONER INFO ---")
        print(json.dumps(data['summoner_info'], indent=2))
    else:
        print("summoner_info MISSING")
        
    if "rank_info" in data:
        print("\n--- RANK INFO ---")
        print(json.dumps(data['rank_info'], indent=2))
    else:
        print("rank_info MISSING")

except Exception as e:
    print(f"Error reading JSON: {e}")
