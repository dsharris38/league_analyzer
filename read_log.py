
try:
    with open("saves/error_log.txt", "r") as f:
        print(f.read())
except Exception as e:
    print(f"Failed to read log: {e}")
