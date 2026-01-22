
import json
import os
import glob

def check_item7():
    # Find cache dir
    cache_dir = r"c:\Users\Dylan\OneDrive - Yale University\league_analyzer\saves_backup\cache\matches"
    
    # Get a few files
    files = glob.glob(os.path.join(cache_dir, "*.json"))
    if not files:
        print("No cached matches found.")
        return

    print(f"Checking {len(files)} matches for item7...")
    count_item7 = 0
    
    for fpath in files[:50]:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                info = data.get('info', {})
                parts = info.get('participants', [])
                for p in parts:
                    if 'item7' in p and p['item7'] != 0:
                        print(f"Match {data['metadata']['matchId']} - Champ: {p['championName']} has item7: {p['item7']}")
                        count_item7 += 1
        except Exception as e:
            pass

    print(f"Found {count_item7} participants with item7 != 0.")

if __name__ == "__main__":
    check_item7()
