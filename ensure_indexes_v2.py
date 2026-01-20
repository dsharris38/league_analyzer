
import time
from database import Database

print("Applying Case-Insensitive Indexes...")
db = Database()
if not db.is_connected:
    print("Database not connected.")
    exit(1)

analyses = db._get_collection("analyses")

def create_idx(col, keys, unique=False):
    name = "_".join([k[0] for k in keys])
    print(f"Ensuring index on {col.name}: {keys} (Unique={unique})")
    try:
        col.create_index(keys, unique=unique, background=True)
        print("Index created/verified.")
    except Exception as e:
        print(f"Failed to create index: {e}")

# New Case-Insensitive Lookup Index
create_idx(analyses, [("filename_id_lower", 1)], unique=True) # Must be unique if filename_id is unique
create_idx(analyses, [("riot_id", 1)], unique=True)
create_idx(analyses, [("filename_id", 1)], unique=True)

print("Index applied.")
