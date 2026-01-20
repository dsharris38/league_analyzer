
import time
import zlib
import json
from database import Database

print("--- Detailed Profiler ---")
db = Database()
col = db._get_collection("matches")

# 1. Check Indexes
print("\n[1] Checking Indexes...")
try:
    indexes = col.index_information()
    for name, info in indexes.items():
        print(f"  - {name}: {info['key']}")
except Exception as e:
    print(f"  FAILED to list indexes: {e}")

# 2. Benchmark Query (Network + DB Search)
print("\n[2] Benchmarking Query (Network Roundtrip)...")
# Get 20 IDs first to simulate the bulk input
try:
    recent_20 = list(col.find({}, {"metadata.matchId": 1}).sort("metadata.gameCreation", -1).limit(20))
    match_ids = [r["metadata"]["matchId"] for r in recent_20]
    print(f"  Targeting {len(match_ids)} matches.")

    t0 = time.time()
    # Fetch raw docs WITHOUT processing to isolate DB speed
    cursor = col.find({"metadata.matchId": {"$in": match_ids}})
    raw_docs = list(cursor)
    t1 = time.time()
    print(f"  Raw Fetch Time: {t1 - t0:.4f}s")
    print(f"  Docs Retrieved: {len(raw_docs)}")
except Exception as e:
    print(f"  Query Failed: {e}")
    raw_docs = []

# 3. Benchmark Decompression (CPU)
print("\n[3] Benchmarking CPU Decompression...")
if raw_docs:
    t2 = time.time()
    decompressed_count = 0
    total_size = 0
    for doc in raw_docs:
        if "compressed_data" in doc:
            try:
                data = zlib.decompress(doc["compressed_data"])
                json_obj = json.loads(data)
                total_size += len(data)
                decompressed_count += 1
            except:
                pass
    t3 = time.time()
    print(f"  Decompression Time: {t3 - t2:.4f}s")
    print(f"  Items Decompressed: {decompressed_count}")
    print(f"  Total Data Size (Uncompressed): {total_size / 1024 / 1024:.2f} MB")
else:
    print("  Skipping CPU test (no docs).")

print("--- End ---")
