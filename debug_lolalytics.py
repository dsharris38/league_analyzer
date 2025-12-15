
import requests
import re

def test_fetch(champion="ahri"):
    url = f"https://www.lolalytics.com/lol/{champion}/build/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        r = requests.get(url, headers=headers)
        print(f"Status: {r.status_code}")
        
        html = r.text
        
        # Look for "runes" key in JSON
        regex_runes = re.search(r'"runes":\s*\[(.*?)\]', html)
        if regex_runes:
            print("Found 'runes' array:", regex_runes.group(1)[:200]) # First 200 chars

        # Look for "keystone"
        regex_keystone = re.search(r'"keystone":\s*(\d+)', html)
        if regex_keystone:
            print("Found 'keystone':", regex_keystone.group(1))
            
        # Often Lolalytics puts the IDs in valid class names or data-ids
        # e.g. <div class="...rune..." data-id="8112">
        regex_data_id = re.findall(r'data-id="(\d{4})"', html)
        if regex_data_id:
            print("Found distinct data-ids (candidates for runes/items):", regex_data_id[:20])

        if "Predator" in html:
             print("Predator text FOUND in HTML")

    except Exception as e:
        print(e)

if __name__ == "__main__":
    test_fetch()
