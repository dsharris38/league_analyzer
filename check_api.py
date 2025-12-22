import os
import requests
from dotenv import load_dotenv

def check_api():
    load_dotenv()
    key = os.environ.get("RIOT_API_KEY")
    if not key:
        print("ERROR: RIOT_API_KEY not found in .env")
        return

    print(f"Checking Key: {key[:5]}...")
    url = "https://na1.api.riotgames.com/lol/status/v4/platform-data"
    headers = {"X-Riot-Token": key}
    
    try:
        res = requests.get(url, headers=headers)
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            print("SUCCESS: API Key is valid.")
        elif res.status_code == 403:
            print("FAILURE: API Key is EXPIRED or INVALID (403).")
        else:
            print(f"FAILURE: Unexpected status {res.status_code}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    check_api()
