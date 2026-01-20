
import requests
import json
import logging

def debug_api():
    url = "http://127.0.0.1:8000/api/analyze/"
    payload = {
        "riot_id": "Bingbong#NAbab",
        "region": "NA",
        "match_count": 20,
        "call_ai": False # DEBUG: Disable AI to test basic pipeline speed
    }
    
    print(f"Sending POST to {url} with payload: {payload}")
    try:
        resp = requests.post(url, json=payload, timeout=30)
        print(f"Status Code: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print("Response JSON parsed successfully.")
            print("Keys in response:", list(data.keys()))
            
            if "season_stats" in data:
                print("season_stats found.")
                ss = data["season_stats"]
                print("season_stats keys:", list(ss.keys()))
                if "champions" in ss:
                    champs = ss["champions"]
                    print(f"season_stats.champions count: {len(champs)}")
                    if len(champs) > 0:
                        print("Sample champion:", champs[0])
            else:
                print("WARNING: season_stats MISSING in response.")
                
        else:
            print("Response Text:", resp.text[:500])
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    debug_api()
