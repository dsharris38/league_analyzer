
import sys
import os
from database import Database
from analyzer import analyze_matches

def test_analyzer():
    print("Connecting to DB...")
    db = Database()
    
    # Freeder PUUID
    puuid = "qnTPlWIBNNDBMgoXXR6_WZKJVqaEhbjerktJEUlvmnsUSCa4IjVQ6Fz5giZt-eNSJoOi3uqzvnsCUw"
    
    print("Fetching raw matches...")
    matches = db.get_matches_by_puuid(puuid, limit=5)
    
    if not matches:
        print("No matches found locally.")
        return

    print(f"Found {len(matches)} matches. Running analysis...")
    
    analysis = analyze_matches(matches, puuid)
    
    detailed = analysis.get("detailed_matches", [])
    print(f"Analysis complete. detailed_matches count: {len(detailed)}")
    
    if detailed:
        m0 = detailed[0]
        print(f"Match[0] Keys: {list(m0.keys())}")
        print(f"Match[0] Role: {m0.get('role')}")
        print(f"Match[0] Champion: {m0.get('champion')}")
    else:
        print("Detailed matches empty.")

if __name__ == "__main__":
    test_analyzer()
