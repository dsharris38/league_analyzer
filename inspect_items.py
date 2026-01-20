import requests
import json

def check_boots_data():
    url = "https://ddragon.leagueoflegends.com/cdn/16.1.1/data/en_US/item.json"
    print(f"Fetching {url}...")
    try:
        r = requests.get(url)
        data = r.json()
        items = data['data']
        
        target_ids = ["3170", "3171", "3172", "3173", "3174", "3175", "3176"]
        for i_id, i_data in items.items():
            if i_id in target_ids:
                print(f"ID: {i_id} | Name: {i_data['name']}")
                print("STATS:", json.dumps(i_data.get('stats'), indent=2))
                print("DESC:", i_data.get('description'))
                print("-" * 20)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import sys
    # Redirect stdout to a file with utf-8 encoding
    with open("item_dump.txt", "w", encoding="utf-8") as f:
        sys.stdout = f
        check_boots_data()
