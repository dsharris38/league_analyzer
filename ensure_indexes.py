
import time
from database import Database

print("Checking Database Indexes...")
db = Database()
if not db.is_connected:
    print("Database not connected.")
    exit(1)

matches = db._get_collection("matches")
analyses = db._get_collection("analyses")
timelines = db._get_collection("timelines")

def create_idx(col, keys, unique=False):
    name = "_".join([k[0] for k in keys])
    print(f"Ensuring index on {col.name}: {keys} (Unique={unique})")
    try:
        col.create_index(keys, unique=unique, background=True)
        print("Index created/verified.")
    except Exception as e:
        print(f"Failed to create index: {e}")

# Matches
create_idx(matches, [("metadata.matchId", 1)], unique=True)
create_idx(matches, [("metadata.participants", 1)], unique=False)
create_idx(matches, [("metadata.gameCreation", -1)], unique=False) # For sorting

# Timelines
create_idx(timelines, [("metadata.matchId", 1)], unique=True)

# Analyses
create_idx(analyses, [("riot_id", 1)], unique=True)
create_idx(analyses, [("filename_id", 1)], unique=True) # Critical for search

print("Index creation requests sent.")
