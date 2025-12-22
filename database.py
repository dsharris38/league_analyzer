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
        if not col: return None
        return col.find_one({"metadata.matchId": match_id}, {"_id": 0})

    def save_match(self, match_data: Dict[str, Any]):
        col = self._get_collection("matches")
        if not col or not match_data: return
        match_id = match_data.get("metadata", {}).get("matchId")
        if match_id:
            col.replace_one({"metadata.matchId": match_id}, match_data, upsert=True)

    def get_timeline(self, match_id: str) -> Optional[Dict[str, Any]]:
        col = self._get_collection("timelines")
        if not col: return None
        return col.find_one({"metadata.matchId": match_id}, {"_id": 0})

    def save_timeline(self, match_id: str, timeline_data: Dict[str, Any]):
        col = self._get_collection("timelines")
        if not col or not timeline_data: return
        # Ensure ID is searchable
        timeline_data["metadata"] = timeline_data.get("metadata", {})
        timeline_data["metadata"]["matchId"] = match_id
        col.replace_one({"metadata.matchId": match_id}, timeline_data, upsert=True)

    # --- Analysis Storage ---

    def save_analysis(self, analysis_data: Dict[str, Any]):
        col = self._get_collection("analyses")
        if not col or not analysis_data: return
        
        riot_id = analysis_data.get("riot_id", "Unknown")
        # Identify by Riot ID
        # Note: We might want a unique run ID or just overwrite the user's "latest"?
        # Current logic: One active analysis per Riot ID (to match file system behavior)
        col.replace_one({"riot_id": riot_id}, analysis_data, upsert=True)

    def get_analysis(self, riot_id: str) -> Optional[Dict[str, Any]]:
        col = self._get_collection("analyses")
        if not col: return None
        return col.find_one({"riot_id": riot_id}, {"_id": 0})

    def list_analyses(self) -> List[Dict[str, Any]]:
        col = self._get_collection("analyses")
        if not col: return []
        
        cursor = col.find({}, {
            "riot_id": 1, 
            "region": 1, 
            "summary": 1, 
            "match_count_requested": 1,
            "meta": 1, 
            "_id": 0
        })
        
        results = []
        for doc in cursor:
            # Reconstruct the metadata shape used by views.py
            results.append({
                "riot_id": doc.get("riot_id"),
                "filename": f"league_analysis_{doc.get('riot_id').replace('#','_')}.json", # Virtual filename for frontend compat
                "created": time.time(), # TODO: Add timestamps to DB save
                "primary_role": doc.get("summary", {}).get("primary_role", "Unknown"),
                "match_count": doc.get("match_count_requested", 0)
            })
        return results
