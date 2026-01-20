
from database import Database
import time

print("--- Debug Case Sensitivity ---")
db = Database()
col = db._get_collection("analyses")

# 1. List Stored filename_ids
print("\n[1] Stored filename_ids:")
cursor = col.find({}, {"filename_id": 1, "riot_id": 1})
stored = []
for doc in cursor:
    fid = doc.get("filename_id", "MISSING")
    rid = doc.get("riot_id", "MISSING")
    print(f"  - RiotID: {rid} | FilenameID: {fid}")
    stored.append(fid)

if not stored:
    print("  No analyses found.")
    exit()

# 2. Test Lookup Speed (Case Sensitive)
target = stored[0]
print(f"\n[2] Testing Exact Match: '{target}'")
t0 = time.time()
doc = col.find_one({"filename_id": target})
t1 = time.time()
print(f"  Found: {bool(doc)} in {t1 - t0:.4f}s")

# 3. Test Lookup Speed (Lower Case Mismatch)
target_lower = target.lower()
if target_lower == target:
    # Force a mismatch case if possible
    target_lower = target.upper() 

print(f"\n[3] Testing Mismatched Case: '{target_lower}'")
t2 = time.time()
doc = col.find_one({"filename_id": target_lower}) # Expect None
t3 = time.time()
print(f"  Found: {bool(doc)} in {t3 - t2:.4f}s")

# 4. Test Regex Fallback (What currently happens on mismatch)
import re
print(f"\n[4] Testing Regex Fallback for '{target_lower}'")
start_regex = time.time()
escaped = re.escape(target_lower)
pattern_str = f"^{escaped}$"
# Case insensitive regex
doc = col.find_one({"filename_id": {"$regex": pattern_str, "$options": "i"}})
end_regex = time.time()
print(f"  Found: {bool(doc)} in {end_regex - start_regex:.4f}s")
