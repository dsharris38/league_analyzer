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
            self._ensure_indexes()
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

    def _ensure_indexes(self):
        """Idempotently ensure critical indexes exist for performance."""
        try:
            col = self._get_collection("analyses")
            if col is not None:
                # 1. Access Query Indexes (Most Critical)
                col.create_index([("filename_id", pymongo.ASCENDING)], background=True)
                col.create_index([("filename_id_lower", pymongo.ASCENDING)], background=True)
                
                # 2. Uniqueness & Sorting
                # Use background=True to avoid locking DB on startup
                col.create_index([("riot_id", pymongo.ASCENDING)], unique=True, background=True)
                col.create_index([("created", pymongo.DESCENDING)], background=True)
                # print("[DB] Verified critical indexes.")
        except Exception as e:
            print(f"[DB-WARN] Auto-index creation failed: {e}")

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

    def get_matches_bulk(self, match_ids: List[str]) -> Dict[str, Any]:
        """Bulk fetch matches from DB. Returns a dict {match_id: match_data}."""
        col = self._get_collection("matches")
        if col is None or not match_ids: return {}
        
        # Use $in query for bulk retrieval
        cursor = col.find({"metadata.matchId": {"$in": match_ids}})
        
        results = {}
        import zlib
        import json
        
        for doc in cursor:
            mid = doc.get("metadata", {}).get("matchId")
            if not mid: continue
            
            final_doc = None
            if "compressed_data" in doc:
                try:
                    decompressed = zlib.decompress(doc["compressed_data"])
                    final_doc = json.loads(decompressed)
                except Exception as e:
                    print(f"Error decompressing match {mid}: {e}")
            else:
                final_doc = doc
            
            if final_doc:
                results[mid] = self._sanitize_document(final_doc)
        
        return results

    def get_matches_by_puuid(self, puuid: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """Retrieve all cached matches where the user is a participant."""
        col = self._get_collection("matches")
        if col is None: return []
        
        # Query for PUUID in participants list (using metadata for speed)
        # Sort by gameCreation descending (newest first)
        cursor = col.find({"metadata.participants": puuid})\
                    .sort("metadata.gameCreation", -1)\
                    .limit(limit)
        
        results = []
        import zlib
        import json
        
        for doc in cursor:
            if "compressed_data" in doc:
                try:
                    decompressed = zlib.decompress(doc["compressed_data"])
                    results.append(json.loads(decompressed))
                except Exception as e:
                    print(f"Error decompressing match {doc.get('metadata', {}).get('matchId')}: {e}")
            else:
                results.append(doc)
                
        return results

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

    def cleanup_old_matches(self, puuid: str, limit: int = 1000):
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

    def get_timeline_analysis(self, match_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached analysis results (loss/movement) to skip redundant processing."""
        col = self._get_collection("timeline_analysis")
        if col is None: return None
        return col.find_one({"match_id": match_id}, {"_id": 0})

    def save_timeline_analysis(self, match_id: str, analysis_data: Dict[str, Any]):
        """Cache the expensive analysis results."""
        col = self._get_collection("timeline_analysis")
        if col is None: return
        
        # FIX: Sanitize integer keys in timeline data (e.g. frame numbers)
        analysis_data = self._sanitize_document(analysis_data)
        
        doc = {"match_id": match_id, **analysis_data}
        col.replace_one({"match_id": match_id}, doc, upsert=True)

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
            
        # Optimization: Store the "virtual filename" ID for O(1) lookups
        if "riot_id" in analysis_data:
            analysis_data["filename_id"] = analysis_data["riot_id"].replace("#", "_")
            
        riot_id = analysis_data.get("riot_id", "Unknown")
        
        # Add Normalized Filename ID for O(1) Lookup
        # Matches logic: riot_id.replace("#", "_")
        if riot_id != "Unknown":
            # Store standard ID
            analysis_data["filename_id"] = riot_id.replace("#", "_")
            # Store lowercase ID for case-insensitive O(1) lookup
            analysis_data["filename_id_lower"] = analysis_data["filename_id"].lower()

        if "analysis" in analysis_data:
            an = analysis_data["analysis"]
            if "movement_summaries" in an and isinstance(an["movement_summaries"], list):
                if len(an["movement_summaries"]) > 0:
                    try:
                        import zlib
                        import json
                        from bson import Binary
                        # Compress
                        raw_json = json.dumps(an["movement_summaries"]).encode('utf-8')
                        compressed = zlib.compress(raw_json)
                        an["movement_summaries_compressed"] = Binary(compressed)
                        del an["movement_summaries"]
                        analysis_data["analysis"] = an
                        print(f"[DB-DEBUG] Compressed movement_summaries: {len(raw_json)} -> {len(compressed)} bytes")
                    except Exception as e:
                        print(f"[DB-WARN] Failed to compress movement_summaries: {e}")

        # Identify by Riot ID (Case-Insensitive Handling)
        # Identify by Riot ID (Case-Insensitive Handling)
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # 1. Check if a record exists with the same ID (ignoring case)
                # Use 'filename_id_lower' which we just set
                target_riot_id = riot_id
                
                existing = col.find_one({"filename_id_lower": analysis_data["filename_id_lower"]})
                if existing:
                    # Reuse the EXISTING casing for the primary key to ensure we overwrite it
                    # instead of creating a duplicate with slightly different casing.
                    # KEY FIX: Also force the payload itself to respect this ID so we don't trigger "duplicate key error"
                    # on the update if we accidentally change the index field to something that collides.
                    target_riot_id = existing["riot_id"]
                    analysis_data["riot_id"] = target_riot_id
                    # print(f"[DB-DEBUG] Found existing doc with id '{target_riot_id}'. Overwriting...")
                
                col.replace_one({"riot_id": target_riot_id}, analysis_data, upsert=True)
                print(f"[DB-DEBUG] Saved analysis for {target_riot_id} (fid: {analysis_data.get('filename_id')})")
                return # Success
                
            except Exception as e:
                # pymongo.errors.DuplicateKeyError is wrapped in Exception usually, but better to check
                is_dup = "E11000" in str(e) or "DuplicateKeyError" in str(e)
                if is_dup and attempt < max_retries - 1:
                     print(f"[DB-WARN] DuplicateKeyError on save (race condition). Retrying {attempt+1}/{max_retries}...")
                     import time
                     time.sleep(0.2)
                     continue
                     
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

    def _decompress_analysis(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        if not doc: return doc
        
        an = doc.get("analysis", {})
        if "movement_summaries_compressed" in an:
            try:
                import zlib
                import json
                compressed = an["movement_summaries_compressed"]
                decompressed = zlib.decompress(compressed)
                an["movement_summaries"] = json.loads(decompressed)
                # del an["movement_summaries_compressed"] # Keep raw? No, cleaner to swap.
                # Actually, clients expect 'movement_summaries'.
                # We should probably modify a copy if we want to be safe, but modifying in place is faster.
                pass
            except Exception as e:
                print(f"[DB-ERROR] Failed to decompress movement_summaries: {e}")
                an["movement_summaries"] = [] # Fallback
                
        return doc

    def get_analysis(self, riot_id: str) -> Optional[Dict[str, Any]]:
        col = self._get_collection("analyses")
        if col is None: return None
        doc = col.find_one({"riot_id": riot_id}, {"_id": 0})
        return self._decompress_analysis(doc)

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
        import time
        t_start = time.time()
        col = self._get_collection("analyses")
        
        # 0. Super-Optimistic: Exact filename_id match (Fastest, O(1))
        doc = col.find_one({"filename_id": core_name}, {"_id": 0})
        if doc:
            # print(f"[DB-PERF] Direct Filename Match '{core_name}' found in {time.time() - t_start:.4f}s")
            return self._decompress_analysis(doc)

        # 1. Case-Insensitive O(1) Match (Fast, requires 'filename_id_lower' index)
        core_lower = core_name.lower()
        doc = col.find_one({"filename_id_lower": core_lower}, {"_id": 0})
        if doc:
            print(f"[DB-PERF] Case-Insensitive Match '{core_lower}' found in {time.time() - t_start:.4f}s")
            return self._decompress_analysis(doc)

        # 2. Optimistic: Try recreating the Riot ID if it follows standard Name_Tag pattern
        parts = core_name.rsplit('_', 1)
        if len(parts) == 2:
            potential_id = f"{parts[0]}#{parts[1]}" # e.g. "Doublelift#NA1"
            doc = col.find_one({"riot_id": potential_id}, {"_id": 0})
            if doc: 
                return self._decompress_analysis(doc)
            
            # Try Case Insensitive Riot ID (if we indexed 'riot_id_lower'?)
            # Or assume most users type correct casing or rely on filename_id_lower above.

        # 3. Fallback: Search using Regex (Slowest, Last Resort)
        print(f"[DB-WARN] Falling back to REGEX search for {core_name} (This is slow on remote DB)")
        import re
        escaped = re.escape(core_name)
        escaped = escaped.replace(r'\_', '_')
        pattern_str = escaped.replace('_', '[# _]')
        pattern_str = f"^{pattern_str}$"
        
        t_regex = time.time()
        try:

            doc = col.find_one({"riot_id": {"$regex": pattern_str, "$options": "i"}}, {"_id": 0})
            print(f"[DB-PERF] Regex Search for '{core_name}' took {time.time() - t_regex:.4f}s (Result: {bool(doc)})")
            return self._decompress_analysis(doc)
        except Exception as e:
            print(f"[DB-ERROR] Fuzzy search failed: {e}")
            return None
