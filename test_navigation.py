import requests
import json
import time

riot_id = "Doublelift#NA1"
url_analyze = "http://localhost:8000/api/analyze/"
url_list = "http://localhost:8000/api/analyses/"
url_detail_base = "http://localhost:8000/api/analyses/"

print(f"--- Simulating Frontend Flow for {riot_id} ---")

# 1. Stage 1 Analysis
print("\n[1] POST /api/analyze/ (Stage 1)")
data = {
    "riot_id": riot_id,
    "match_count": 20,
    "region": "NA",
    "call_ai": False,
    "force_refresh": True
}
try:
    res = requests.post(url_analyze, json=data, timeout=60)
    print(f"Status: {res.status_code}")
    if res.status_code != 200:
        print(f"Error: {res.text}")
        exit()
except Exception as e:
    print(f"Request Failed: {e}")
    exit()

# 2. List Analyses
print("\n[2] GET /api/analyses/")
time.sleep(0.5) # Simulate slight delay
res_list = requests.get(url_list)
files = res_list.json()
found = False
target_filename = ""

clean_target = riot_id.lower().replace("#", "").replace(" ", "")

for f in files:
    f_riot = f.get('riot_id', '').lower().replace("#", "").replace(" ", "")
    if f_riot == clean_target:
        found = True
        target_filename = f.get('filename')
        print(f"FOUND in List! Filename: {target_filename}")
        break

if not found:
    print("NOT FOUND in List (Race Condition confirmed?)")
    # 3. Fallback Construction
    target_filename = f"league_analysis_{riot_id.replace('#', '_')}.json"
    print(f"Constructed Fallback: {target_filename}")

# 4. Fetch Detail
print(f"\n[3] GET /api/analyses/{target_filename}/")
res_detail = requests.get(f"{url_detail_base}{target_filename}/")

print(f"Status: {res_detail.status_code}")
if res_detail.status_code == 200:
    print("SUCCESS! Analysis loaded.")
    data = res_detail.json()
    print(f"Riot ID in Doc: {data.get('riot_id')}")
else:
    print(f"FAILURE! {res_detail.text}")
