
from pathlib import Path

env_path = Path(".env")
if not env_path.exists():
    print(".env NOT FOUND")
else:
    try:
        content = env_path.read_text(encoding="utf-8")
        lines = content.splitlines()
        print(f"Read {len(lines)} lines.")
        found = False
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                print(f"Skipping comment/empty: {line}")
                continue
            
            parts = line.split('=', 1) # Split only on the first '='
            key = parts[0].strip()
            print(f"Found key: '{key}'")

            if key == 'RIOT_API_KEY':
                val = parts[1].strip() if len(parts) > 1 else ""
                print(f"RIOT_API_KEY is present. Length: {len(val)}")
                print(f"First 5 chars: {val[:5]}")
                found = True
        
        if not found:
            print("RIOT_API_KEY not found in file.")
            
    except Exception as e:
        print(f"Error reading .env: {e}")
