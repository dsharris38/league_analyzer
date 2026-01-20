
import time
from database import Database

db = Database()
col = db._get_collection("matches")

# Find recent 20 match IDs
recent = list(col.find({}, {"metadata.matchId": 1}).sort("metadata.gameCreation", -1).limit(20))
mids = [r["metadata"]["matchId"] for r in recent]
print(f"Testing bulk fetch of {len(mids)} matches from Atlas...")

t0 = time.time()
res = db.get_matches_bulk(mids)
t1 = time.time()

print(f"Fetched {len(res)} matches in {t1 - t0:.4f}s")
print(f"Average time per match: {(t1 - t0) / len(mids):.4f}s")
