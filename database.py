import os
import pymongo
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database as MongoDatabase
from typing import Dict, Any, List, Optional
import time

class Database:
    _instance = None
    _client: MongoClient = None
    _db: MongoDatabase = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        # Ensure .env is loaded for scripts/CLI usage
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

        # Default to local if no URI provided (dev mode safe fallback)
        uri = os.environ.get("MONGO_URI")
        if not uri:
            print("WARNING: MONGO_URI not found in env. Database features will be disabled.")
            self._client = None
            return

        try:
            self._client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            # Default database name 'league_analyzer'
            self._db = self._client.get_database("league_analyzer")
            print("Connected to MongoDB.")
        except Exception as e:
            print(f"Failed to connect to MongoDB: {e}")
            self._client = None

    @property
    def is_connected(self) -> bool:
        return self._client is not None

    def _get_collection(self, name: str) -> Optional[Collection]:
        if not self.is_connected:
            return None
        return self._db[name]

    # --- Match Caching ---

    def get_match(self, match_id: str) -> Optional[Dict[str, Any]]:
        col = self._get_collection("matches")
        if col is None: return None
        doc = col.find_one({"metadata.matchId": match_id}, {"_id": 0})
        
        if doc:
            if "compressed_data" in doc:
                try:
                    import zlib
                    import json
                    decompressed = zlib.decompress(doc["compressed_data"])
                    return json.loads(decompressed)
                except Exception as e:
                    print(f"Error decompressing match {match_id}: {e}")
                    return None
            return doc
        return None

    def save_match(self, match_data: Dict[str, Any]):
        col = self._get_collection("matches")
        if col is None or not match_data: return
        match_id = match_data.get("metadata", {}).get("matchId")
        if match_id:
            try:
                import zlib
                import json
                from bson import Binary
                
                # Extract Critical Metadata for Querying/Cleanup
                meta = match_data.get("metadata", {})
                info = match_data.get("info", {})
                
                # 1. Game Creation Timestamp
                if "gameCreation" in info:
                    meta["gameCreation"] = info["gameCreation"]
                
                # 2. Participants (PUUIDs)
                if "participants" in info:
                    meta["participants"] = [p.get("puuid") for p in info["participants"]]

                json_str = json.dumps(match_data)
                compressed = zlib.compress(json_str.encode('utf-8'))
                
                doc = {
                    "metadata": meta,
                    "compressed_data": Binary(compressed)
                }
                col.replace_one({"metadata.matchId": match_id}, doc, upsert=True)
            except Exception as e:
                print(f"Error compressing match {match_id}: {e}")
                import traceback
                traceback.print_exc()
                # Fallback: Sanitize allows int keys to be stringified
                sanitized = self._sanitize_document(match_data)
                col.replace_one({"metadata.matchId": match_id}, sanitized, upsert=True)

    def cleanup_old_matches(self, puuid: str, limit: int = 250):
        """Delete matches exceeding the limit for a specific player."""
        col = self._get_collection("matches")
        tl_col = self._get_collection("timelines")
        if col is None: return

        try:
            # Find all matches for this player, sorted NEWEST first
            cursor = col.find(
                {"metadata.participants": puuid},
                {"metadata.matchId": 1} # Projection
            ).sort("metadata.gameCreation", -1)
            
            matches = list(cursor)
            
            # If we have more than limit
            if len(matches) > limit:
                # Identify victims (from limit onwards)
                victims = matches[limit:]
                victim_ids = [m["metadata"]["matchId"] for m in victims]
                
                if victim_ids:
                    # Delete from Matches
                    col.delete_many({"metadata.matchId": {"$in": victim_ids}})
                    # Delete from Timelines
                    if tl_col is not None:
                        tl_col.delete_many({"metadata.matchId": {"$in": victim_ids}})
                    
                    print(f"   [DB] Cleaned up {len(victim_ids)} old matches (over limit of {limit}).")
        except Exception as e:
            print(f"   [DB] Cleanup execution failed: {e}")

    def get_timeline(self, match_id: str) -> Optional[Dict[str, Any]]:
        col = self._get_collection("timelines")
        if col is None: return None
        doc = col.find_one({"metadata.matchId": match_id}, {"_id": 0})
        
        if doc:
            # Check for compression
            if "compressed_data" in doc:
                try:
                    import zlib
                    import json
                    decompressed = zlib.decompress(doc["compressed_data"])
                    return json.loads(decompressed)
                except Exception as e:
                    print(f"Error decompressing timeline {match_id}: {e}")
                    return None
            return doc # Legacy uncompressed
        return None

    def save_timeline(self, match_id: str, timeline_data: Dict[str, Any]):
        col = self._get_collection("timelines")
        if col is None or not timeline_data: return
        
        # Ensure ID is searchable
        # Compress the data to save massive DB space (80% reduction)
        try:
            import zlib
            import json
            from bson import Binary
            
            # We preserve metadata outside compression for querying
            meta = timeline_data.get("metadata", {})
            meta["matchId"] = match_id
            
            json_str = json.dumps(timeline_data)
            compressed = zlib.compress(json_str.encode('utf-8'))
            
            doc = {
                "metadata": meta,
                "compressed_data": Binary(compressed)
            }
            
            col.replace_one({"metadata.matchId": match_id}, doc, upsert=True)
        except Exception as e:
            print(f"Error compressing timeline {match_id}, saving raw: {e}")
            import traceback
            traceback.print_exc()
            # Fallback
            # Sanitize fallback too!
            sanitized = self._sanitize_document(timeline_data)
            sanitized["metadata"] = sanitized.get("metadata", {})
            sanitized["metadata"]["matchId"] = match_id
            col.replace_one({"metadata.matchId": match_id}, sanitized, upsert=True)

    # --- Analysis Storage ---

    def _sanitize_document(self, doc: Any) -> Any:
        """Recursively replace dots in dictionary keys with underscores for MongoDB compatibility."""
        if isinstance(doc, dict):
            new_doc = {}
            for k, v in doc.items():
                clean_k = str(k).replace(".", "_")
                new_doc[clean_k] = self._sanitize_document(v)
            return new_doc
        elif isinstance(doc, list):
            return [self._sanitize_document(item) for item in doc]
        else:
            return doc

    def save_analysis(self, analysis_data: Dict[str, Any]):
        col = self._get_collection("analyses")
        if col is None or not analysis_data: return
        
        # Sanitize data to remove dots from keys (e.g. "15.8" -> "15_8")
        analysis_data = self._sanitize_document(analysis_data)
        
        if "created" not in analysis_data:
            import time
            analysis_data["created"] = time.time()
            
        riot_id = analysis_data.get("riot_id", "Unknown")
        # Identify by Riot ID
        try:
            col.replace_one({"riot_id": riot_id}, analysis_data, upsert=True)
            print(f"[DB-DEBUG] Saved analysis for {riot_id}")
        except Exception as e:
            msg = f"[DB-ERROR] Failed to save analysis for {riot_id}: {e}"
            print(msg)
            import traceback
            traceback.print_exc()
            try:
                with open("db_error.log", "w") as f:
                    f.write(msg + "\n")
                    traceback.print_exc(file=f)
            except:
                pass

    def get_analysis(self, riot_id: str) -> Optional[Dict[str, Any]]:
        col = self._get_collection("analyses")
        if col is None: return None
        return col.find_one({"riot_id": riot_id}, {"_id": 0})

    def list_analyses(self) -> List[Dict[str, Any]]:
        col = self._get_collection("analyses")
        if col is None: return []
        
        cursor = col.find({}, {
            "riot_id": 1, 
            "region": 1, 
            "summary": 1, 
            "match_count_requested": 1,
            "meta": 1,
            "created": 1, 
            "_id": 0
        })
        
        results = []
        for doc in cursor:
            # Reconstruct the metadata shape used by views.py
            results.append({
                "riot_id": doc.get("riot_id"),
                "filename": f"league_analysis_{doc.get('riot_id').replace('#','_')}.json", # Virtual filename for frontend compat
                "created": doc.get("created", time.time()), # Timestamp from DB
                "primary_role": doc.get("summary", {}).get("primary_role", "Unknown"),
                "match_count": doc.get("match_count_requested", 0)
            })
        return results

    def find_analysis_by_fuzzy_filename(self, core_name: str) -> Optional[Dict[str, Any]]:
        """
        Attempts to find a document where the Riot ID matches the 'core_name' 
        (which comes from filename 'league_analysis_{core_name}.json').
        The core_name has substituted '#' and ' ' with '_'.
        We need to match this against stored riot_ids like 'Name#TAG'.
        """
        col = self._get_collection("analyses")
        if col is None: return None
        
        # 1. Optimistic: Try recreating the Riot ID if it follows standard Name_Tag pattern
        # Assume last underscore is the tag separator if no # exists
        parts = core_name.rsplit('_', 1)
        if len(parts) == 2:
            potential_id = f"{parts[0]}#{parts[1]}" # e.g. "Doublelift#NA1"
            # Try exact match first
            doc = col.find_one({"riot_id": potential_id}, {"_id": 0})
            if doc: 
                return doc

        # 2. Fallback: Search using Regex
        import re
        # re.escape() behavior varies by python version regarding underscores.
        # We need to robustly replace the underscore with our class [# _].
        escaped = re.escape(core_name)
        # Normalize: if it DID escape underscores (old python), replace \_ with _
        escaped = escaped.replace(r'\_', '_')
        # Now replace all underscores with the class
        pattern_str = escaped.replace('_', '[# _]')
        pattern_str = f"^{pattern_str}$"
        
        try:
            return col.find_one({"riot_id": {"$regex": pattern_str, "$options": "i"}}, {"_id": 0})
        except Exception as e:
            print(f"[DB-ERROR] Fuzzy search failed: {e}")
            return None
