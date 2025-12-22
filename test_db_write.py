from database import Database
import time

def test_db_write():
    print("Initializing Database...")
    db = Database()
    
    if not db.is_connected:
        print("ERROR: Not connected to DB.")
        return

    print("Connected. Attempting to save dummy analysis...")
    dummy_data = {
        "riot_id": "TestUser#123",
        "match_count_requested": 5,
        "region": "NA",
        "summary": {
            "primary_role": "Tester"
        },
        "meta": {
            "version": "1.0"
        },
        "timestamp": time.time()
    }
    
    try:
        db.save_analysis(dummy_data)
        print("Save command executed.")
    except Exception as e:
        print(f"Save failed with exception: {e}")
        return

    print("Verifying save...")
    saved = db.get_analysis("TestUser#123")
    if saved:
        print("SUCCESS! Dummy analysis found in DB.")
        print(saved)
    else:
        print("FAILURE! Analysis saved but not found in DB.")

if __name__ == "__main__":
    test_db_write()
