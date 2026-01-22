
import os
import sys
from database import Database
from analyzer import extract_self_participant

def debug_roles():
    print("Connecting to DB...")
    db = Database()
    if not db.is_connected:
        print("ERROR: Not connected to MongoDB")
        return

    col = db._get_collection("analyses")
    print("Searching for ALL 'Freeder' variations...")
    regex = {"$regex": "freeder", "$options": "i"}
    cursor = col.find({"riot_id": regex})
    
    docs = list(cursor)
    print(f"Found {len(docs)} documents matching 'freeder'.")
    
    for doc in docs:
        rid = doc.get("riot_id", "UNKNOWN")
        print(f"\n--- Checking Doc: {rid} ---")
        
        matches = []
        if "detailed_matches" in doc:
             matches = doc["detailed_matches"]
        elif "analysis" in doc and "detailed_matches" in doc["analysis"]:
             matches = doc["analysis"]["detailed_matches"]
             
        if matches:
            missing_role_count = 0
            for i, m in enumerate(matches):
                if "role" not in m:
                    missing_role_count += 1
                    if missing_role_count <= 3:
                         print(f"  [WARN] Match {i} ({m.get('match_id')}) MISSING 'role' key!")
                         print(f"         Keys: {list(m.keys())}")
            
            if missing_role_count > 0:
                print(f"TOTAL MISSING ROLE: {missing_role_count} / {len(matches)}")
            else:
                print("ALL MATCHES HAVE 'role' KEY.")

            m0 = matches[0]
            print(f"Match[0] Keys: {list(m0.keys())}")
            print(f"Match[0] Role: {m0.get('role')}")
            
            parts = m0.get("participants", [])
            if parts:
                p0 = parts[0]
                print(f"Participant[0] Keys: {list(p0.keys())}")
                print(f"Participant[0] is_self: {p0.get('is_self')}")
                print(f"Participant[0] teamPosition: {p0.get('teamPosition')}") # Camel
                print(f"Participant[0] team_position: {p0.get('team_position')}") # Snake
            else:
                print("No participants in match[0]")
        else:
            print("No matches.")
            
        # Raw Check
        puuid = "qnTPlWIBNNDBMgoXXR6_WZKJVqaEhbjerktJEUlvmnsUSCa4IjVQ6Fz5giZt-eNSJoOi3uqzvnsCUw"
        m_col = db._get_collection("matches")
        raw_match = m_col.find_one({"metadata.participants": puuid})
        
        if raw_match:
             print(f"Raw Match ID: {raw_match.get('metadata', {}).get('matchId')}")
             info = raw_match.get("info", {})
             for p in info.get("participants", []):
                 if p.get("puuid") == puuid:
                     print(f"Raw Data -> teamPosition: '{p.get('teamPosition')}'")
                     print(f"Raw Data -> individualPosition: '{p.get('individualPosition')}'")
                     print(f"Raw Data -> role: '{p.get('role')}'")
    else:
        print("Doc not found")

if __name__ == "__main__":
    debug_roles()
