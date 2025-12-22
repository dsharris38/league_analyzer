import requests
import json
import time

def trigger():
    url = "http://localhost:8000/api/analyze/"
    payload = {
        "riot_id": "CoreJJ#NA1", 
        "match_count": 5, 
        "region": "NA",
        "call_ai": False
    }
    
    print(f"POST {url} with {payload}")
    try:
        start = time.time()
        res = requests.post(url, json=payload)
        print(f"Status: {res.status_code}")
        print(f"Time: {time.time() - start:.2f}s")
        print(f"Response Headers: {res.headers}")
        try:
            print(f"Response JSON: {json.dumps(res.json(), indent=2)}")
        except:
            print(f"Response Text: {res.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    trigger()
