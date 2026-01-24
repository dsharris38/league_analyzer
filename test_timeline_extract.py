
import os
import json
from database import Database

def test_extract():
    db = Database()
    # Find a timeline in DB
    col = db._get_collection("timelines")
    tl_doc = col.find_one({})
    
    if not tl_doc:
        print("No timelines found in DB. Run the dashboard to fetch some first.")
        return

    print(f"Testing extraction on timeline for match {tl_doc.get('metadata', {}).get('matchId')}...")
    
    # Needs PUUID to find "self". Since we don't have the context here easily, 
    # we'll just extract for ALL participants to verify logic.
    
    info = tl_doc.get("info", {})
    frames = info.get("frames", [])
    
    participant_builds = {} # pid -> list of events
    participant_skills = {} # pid -> list of events
    
    for frame in frames:
        events = frame.get("events", [])
        for event in events:
            pid = event.get("participantId")
            if not pid: continue
            
            etype = event.get("type")
            
            if etype in ["ITEM_PURCHASED", "ITEM_SOLD", "ITEM_UNDO"]:
                if pid not in participant_builds: participant_builds[pid] = []
                # Keep critical fields
                participant_builds[pid].append({
                    "type": etype,
                    "itemId": event.get("itemId") or event.get("itemBefore") or event.get("itemAfter"), # UNDO uses different keys sometimes?
                    "timestamp": event.get("timestamp")
                })
                # Note: ITEM_UNDO in riot api usually has 'afterId' and 'beforeId'. 
                # Actually checking doc: ITEM_UNDO has participantId, timestamp, type. 
                # It effectively undoes the last event. itemAfter/itemBefore are for header? 
                # Let's dump the event to see.
                if etype == "ITEM_UNDO":
                    participant_builds[pid][-1]["raw"] = event
                    
            elif etype == "SKILL_LEVEL_UP":
                if pid not in participant_skills: participant_skills[pid] = []
                participant_skills[pid].append({
                    "skillSlot": event.get("skillSlot"),
                    "timestamp": event.get("timestamp"),
                    "levelUpType": event.get("levelUpType")
                })

    # Print results for Participant 1
    print("\n--- Participant 1 Build ---")
    for b in participant_builds.get(1, [])[:10]:
        print(b)
        
    print("\n--- Participant 1 Skills ---")
    for s in participant_skills.get(1, []):
        print(s)

if __name__ == "__main__":
    test_extract()
