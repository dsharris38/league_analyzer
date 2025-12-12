
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
            if line.startswith("RIOT_API_KEY"):
                parts = line.split("=", 1)
                if len(parts) == 2 and parts[1].strip():
                    print("Found RIOT_API_KEY definition.")
                    print(f"Key length: {len(parts[1].strip())}")
                    found = True
                else:
                    print("Found RIOT_API_KEY but malformed/empty.")
        
        if not found:
            print("RIOT_API_KEY not found in file.")
            
    except Exception as e:
        print(f"Error reading .env: {e}")
