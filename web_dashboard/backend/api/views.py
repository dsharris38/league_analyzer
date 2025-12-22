from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import json
import os
from pathlib import Path
from urllib.parse import unquote

# Import the analyzer function
# We need to make sure league_crew is in the python path or importable
# Imports moved inside views to avoid circular dependencies

SAVES_DIR = settings.BASE_DIR.parent.parent / 'saves'

class AnalysisListView(APIView):
    def get(self, request):
        print("Listing analyses from MongoDB")
        try:
            from database import Database
            db = Database()
            
            # If DB not connected, fallback to empty or implement strict FS fallback?
            # For migration, we assume DB is primary.
            if not db.is_connected:
                print("MongoDB not connected, returning empty list.")
                return Response([])
                
            files = db.list_analyses()
            
            # Sort by created desc (db.list_analyses doesn't sort yet, or we sort here)
            files.sort(key=lambda x: x.get('created', 0), reverse=True)
            return Response(files)
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error listing analyses: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AnalysisDetailView(APIView):
    def get(self, request, filename):
        filename = unquote(filename)
        # Parse Riot ID from virtual filename: league_analysis_Name_Tag.json
        # Format: league_analysis_{safe_id}.json where safe_id has _ instead of #
        # But wait, original code saved as Name_TAG.json.
        # Ideally we stored the exact Riot ID in the DB.
        # Frontend passes "league_analysis_Name_TAG.json".
        
        try:
            from database import Database
            db = Database()
            
            # Simple parsing: remove prefix and extension
            if filename.startswith("league_analysis_") and filename.endswith(".json"):
                core = filename[len("league_analysis_"):-5] # "Name_TAG"
                # This is "safe_id". We need "Name#TAG".
                # Problem: We don't know where the # was.
                # Solution: The DB is keyed by `riot_id`. 
                # Either we fuzzy match OR we change `list_analyses` to return the real Riot ID as the ID, 
                # and Frontend passes just the ID? 
                # For compatibility, `list_analyses` returns filenames that map to this view.
                # Let's try to query by the `riot_id` if we can reconstruct it, OR scan.
                # BETTER: `save_analysis` keys by `riot_id`. `list_analyses` creates a filename.
                # Ideally, we should just query `db.analyses` where `riot_id.replace('#', '_') == core`.
                # But that requires a scan or a stored "safe_id" field.
                
                # Let's fix this properly: 
                # 1. `list_analyses` should provide the riot_id. 
                # 2. Frontend probably uses `filename` as the key.
                # 3. We can iterate DB or normalize?
                # Quick fix: The DB key is `riot_id`. We can try to find a doc where `riot_id` matches "Name#TAG" 
                # derived from "Name_TAG". But "_" is ambiguous (Name_With_Underscore#TAG).
                
                # Fallback: Query where `riot_id` approximately matches?
                # Or simply add a `safe_id` field to the DB on save?
                # Actually, in `main.py` we used `safe_riot_id = riot_id.replace("#", "_")`.
                # Let's assume we can loop through the limited number of analyses to find the match? 
                # OR, just fix the View to accept `riot_id`? Front end relies on filename.
                
                # Let's search the DB for the document where `riot_id` transforms to this `core`.
                # This is safer than guessing.
                
                all_docs = db.list_analyses()
                target_doc = None
                for doc in all_docs:
                    # Reconstruct what the filename would be
                    r_id = doc.get('riot_id', '')
                    # Match frontend: replace # AND spaces with _
                    safe_r = r_id.replace('#', '_').replace(' ', '_')
                    
                    # Case-insensitive comparison? Filesystem was case-sensitive on Linux but not Windows.
                    # Let's try exact first.
                    if safe_r == core:
                        # Found it, fetch full doc
                        target_doc = db.get_analysis(r_id)
                        break
                
                if target_doc:
                    return Response(target_doc)
                else:
                    return Response({'error': 'Analysis not found in DB'}, status=status.HTTP_404_NOT_FOUND)

            return Response({'error': 'Invalid filename format'}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

import json
from django.http import JsonResponse
from pathlib import Path
import time
import requests

# ... existing imports ...

# Define cache path (should match coach_data_enricher)
CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "saves" / "cache"

def cached_meraki_items(request):
    """Serve cached Meraki items to frontend."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / "meraki_items_enriched.json"
    
    # Check cache validity
    if cache_path.exists():
        mtime = cache_path.stat().st_mtime
        if time.time() - mtime < 86400: # 24 hours
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return JsonResponse(data)
            except Exception:
                pass 
    
    # Fetch fresh
    try:
        # 1. Fetch Meraki (Base Data)
        url = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/items.json"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        # 2. Fetch DDragon (Enrichment for Text/Description)
        try:
            # Get latest version
            v_resp = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=5)
            latest_version = v_resp.json()[0]
            
            # Get DDragon Items
            dd_resp = requests.get(f"https://ddragon.leagueoflegends.com/cdn/{latest_version}/data/en_US/item.json", timeout=10)
            dd_items = dd_resp.json().get("data", {})

            # Merge
            for item_id, item_info in data.items():
                dd_item = dd_items.get(item_id)
                if dd_item:
                    # Always prefer Riot's description for tooltips (contains formatted passives)
                    if dd_item.get("description"):
                        item_info["description"] = dd_item.get("description")
                    
                    # Ensure Name is Riot-official
                    if dd_item.get("name"):
                         item_info["name"] = dd_item.get("name")
        except Exception as e:
            print(f"Warning: Failed to merge DDragon data: {e}")
        
        # Save to cache
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception:
            pass
            
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def cached_meraki_champions(request):
    """Serve cached Meraki champions to frontend."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / "meraki_champions.json"
    
    # Check cache validity
    if cache_path.exists():
        mtime = cache_path.stat().st_mtime
        if time.time() - mtime < 86400: # 24 hours
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return JsonResponse(data)
            except Exception:
                pass 
    
    # Fetch fresh
    try:
        url = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json"
        
        # Champions file is large (~1.5MB), increased timeout
        resp = requests.get(url, timeout=20) 
        resp.raise_for_status()
        data = resp.json()
        
        # Save to cache
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception:
            pass
            
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

class RunAnalysisView(APIView):
# ... existing code ...
    def post(self, request):
        riot_id = request.data.get('riot_id')
        match_count = int(request.data.get('match_count', 20))
        use_timeline = request.data.get('use_timeline', True)
        call_ai = request.data.get('call_ai', True)
        region = request.data.get('region', 'NA')
        force_refresh = request.data.get('force_refresh', False)
        
        if not riot_id:
            return Response({'error': 'riot_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check for existing analysis to save tokens (Global Cache)
        # Format: league_analysis_{Name}_{Tag}.json (spaces -> _, # -> _)
        # Note: This is case-sensitive on Linux, but usually files are saved with original casing or normalized?
        # main.py uses the riot_id as passed or from account data. 
        # To be safe, we might miss if case differs, but accurate inputs will hit cache.
        # Check for existing analysis in MongoDB
        from database import Database
        db = Database()
        existing_doc = db.get_analysis(riot_id)
        
        if existing_doc and not force_refresh:
            print(f"CACHE HIT (DB): Found existing analysis for {riot_id}, skipping pipeline.")
            return Response({
                'status': 'success', 
                'riot_id': riot_id, 
                'cached': True,
                'debug': {
                    'db_connected': db.is_connected,
                    'save_verified': True,
                    'saved_id': existing_doc.get('riot_id'),
                    'db_doc_count': len(db.list_analyses())
                }
            })
            
        try:
            # Run the pipeline
            import sys
            # Insert at 0 to prioritize local modules over installed setup
            project_root = str(settings.BASE_DIR.parent.parent)
            if project_root not in sys.path:
                sys.path.insert(0, project_root)
            
            from main import run_analysis_pipeline
            
            # Note: We set open_dashboard=False since we are already in the dashboard
            analysis_result = run_analysis_pipeline(
                riot_id=riot_id,
                match_count=match_count,
                use_timeline=use_timeline,
                call_ai=call_ai,
                save_json=True,
                open_dashboard=False,
                region_key=region
            )
            
            if "error" in analysis_result:
                return Response({'error': analysis_result['error']}, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify save immediately
            from database import Database
            db = Database()
            saved_doc = db.get_analysis(riot_id)
            print(f"[DEBUG-VIEW] Run Complete. DB Connected: {db.is_connected}. Analysis found in DB? {bool(saved_doc)}")
            if saved_doc:
                print(f"[DEBUG-VIEW] Saved ID: {saved_doc.get('riot_id')}")
            else:
                print(f"[DEBUG-VIEW] ANALYSIS MISSING FROM DB! Riot ID: {riot_id}")
                # Try list all to see what's there
                all_docs = db.list_analyses()
                print(f"[DEBUG-VIEW] Current DB entries ({len(all_docs)}): {[d.get('riot_id') for d in all_docs]}")

            return Response({
                'status': 'success', 
                'riot_id': riot_id,
                'debug': {
                    'db_connected': db.is_connected,
                    'save_verified': bool(saved_doc),
                    'saved_id': saved_doc.get('riot_id') if saved_doc else None,
                    'db_doc_count': len(db.list_analyses())
                }
            })
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DeepDiveAnalysisView(APIView):
    def post(self, request, filename):
        filename = unquote(filename)
        match_id = request.data.get('match_id')
        print(f"Deep Dive Request: filename={filename}, match_id={match_id}")
        
        if not match_id:
            return Response({'error': 'match_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        file_path = SAVES_DIR / filename
        if not file_path.exists():
            print(f"File not found: {file_path}")
            return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Find the match in detailed_matches
            analysis = data.get("analysis", {})
            detailed_matches = analysis.get("detailed_matches", [])
            
            target_match = next((m for m in detailed_matches if m["match_id"] == match_id), None)
            
            if not target_match:
                print(f"Match {match_id} not found in detailed_matches (count={len(detailed_matches)})")
                return Response({'error': 'Match not found in this analysis file'}, status=status.HTTP_404_NOT_FOUND)
                
            # Run the deep dive
            import sys
            sys.path.append(str(settings.BASE_DIR.parent.parent))
            from league_crew import analyze_specific_game

            # Extract Champion Pool (Top 7 by games played)
            per_champion = analysis.get("per_champion", [])
            # Sort by games played (assuming 'games' or 'count' key, fallback to sorting provided by backend)
            # Backend usually provides it sorted or we assume the list is useful.
            # Let's just pass the names and game counts.
            champion_pool = []
            for pc in per_champion: # per_champion is list of {champion_name: ..., games: ...}
                cname = pc.get("champion_name")
                cgames = pc.get("games", 0)
                if cname:
                    champion_pool.append(f"{cname} ({cgames} games)")
            
            # Take top 10 to be safe
            champion_pool = champion_pool[:10]

            print(f"Running deep dive for {match_id} (Pool: {len(champion_pool)} champs)...")
            report_markdown = analyze_specific_game(match_id, target_match, champion_pool=champion_pool)
            print(f"Deep dive complete. Report length: {len(report_markdown)}")
            
            if not report_markdown:
                 print("Report is empty!")
            
            return Response({'report': report_markdown, 'match_data': target_match})
            
        except Exception as e:
            print(f"Deep Dive Error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def health_check(request):
    """Simple health check for frontend polling."""
    return JsonResponse({"status": "online", "timestamp": time.time()})
