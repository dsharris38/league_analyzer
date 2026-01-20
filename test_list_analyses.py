from database import Database
import sys

try:
    db = Database()
    print(f"Connected: {db.is_connected}")
    analyses = db.list_analyses()
    print(f"Found {len(analyses)} analyses.")
    for a in analyses[:3]:
        print(f"- {a.get('riot_id')} -> {a.get('filename')}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
