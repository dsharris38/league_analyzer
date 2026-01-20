
import time
import sys

print("--- DB Profiling Start ---")

t0 = time.time()
from database import Database
t_import = time.time()
print(f"Import time: {t_import - t0:.4f}s")

t1 = time.time()
try:
    db = Database()
    print("Database object created.")
except Exception as e:
    print(f"Database init failed: {e}")
t_init = time.time()
print(f"Database() Init time: {t_init - t1:.4f}s")

# Test Simple Ping/Check
t2 = time.time()
try:
    print(f"Connected: {db.is_connected}")
except Exception as e:
    print(f"Check connection failed: {e}")
t_check = time.time()
print(f"is_connected Check time: {t_check - t2:.4f}s")

# Test Bulk Fetch
t3 = time.time()
try:
    # Fetch random existing match (if any) to test retrieval
    col = db._get_collection("matches")
    one = col.find_one({}, {"metadata.matchId": 1})
    if one:
        mid = one["metadata"]["matchId"]
        print(f"Fetching match {mid}...")
        res = db.get_matches_bulk([mid])
        print(f"Result count: {len(res)}")
    else:
        print("No matches to fetch.")
except Exception as e:
    print(f"Query failed: {e}")

t_query = time.time()
print(f"Query time: {t_query - t3:.4f}s")
print("--- DB Profiling End ---")
