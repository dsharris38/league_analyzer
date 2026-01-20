import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_flow():
    print("1. Listing analyses...")
    try:
        res = requests.get(f"{BASE_URL}/analyses/")
        if res.status_code != 200:
            print(f"FAILED to list: {res.status_code} {res.text}")
            return
        
        files = res.json()
        print(f"Found {len(files)} files.")
        
        target = None
        for f in files:
            print(f" - {f.get('riot_id')} ({f.get('filename')})")
            if "Bingbong" in f.get('riot_id', "") or "bingbong" in f.get('riot_id', "").lower():
                target = f
        
        if not target:
            # Fallback to finding ANY file to test
            if files: target = files[0]
            print("Target not found via name logic, using first available.")
            
        if target:
            fname = target['filename']
            print(f"2. Fetching detail for: {fname}")
            detail_res = requests.get(f"{BASE_URL}/analyses/{fname}")
            
            if detail_res.status_code == 200:
                data = detail_res.json()
                print("SUCCESS: Loaded analysis data.")
                print(f"Keys: {list(data.keys())}")
                if "analysis" in data:
                    print(f"Analysis Summary present: {bool(data['analysis'].get('summary'))}")
            else:
                print(f"FAILED to fetch detail: {detail_res.status_code} {detail_res.text}")
        else:
            print("No files to test detail fetch.")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_flow()
