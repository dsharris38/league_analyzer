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
        
        try:
            from database import Database
            db = Database()
            
            # Use fuzzy finder for robust lookup
            # 1. Strip helper prefix/suffix if present (Frontend sends "league_analysis_X.json")
            core_id = filename.strip().rstrip('/')
            
            # Aggressive cleaning (Replace instead of If-Block to avoid edge cases)
            if core_id.lower().startswith("league_analysis_"):
                core_id = core_id[16:] # len("league_analysis_")
            
            if core_id.lower().endswith(".json"):
                core_id = core_id[:-5]

            # This handles "league_analysis_..." prefix AND raw Riot IDs
            # It normalizes spaces, tags, etc.
            target_doc = db.find_analysis_by_fuzzy_filename(core_id)
            
            if target_doc:
                # Sanitize to remove ObjectId
                target_doc = db._sanitize_document(target_doc)
                return JsonResponse(target_doc)
            else:
                return Response({'error': 'Analysis not found in DB'}, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

import json
from django.http import JsonResponse
from pathlib import Path
import time
import requests

# ... existing imports ...

# Define cache path (should match coach_data_enricher)
CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "saves" / "cache"

# Helper for Smart Caching
def fetch_if_modified(url, cache_path, timeout=10):
    """
    Fetches URL only if remote content is newer than local file.
    Returns: (data, was_modified)
    """
    headers = {}
    if cache_path.exists():
        # Add If-Modified-Since header
        mtime = cache_path.stat().st_mtime
        from email.utils import formatdate
        headers['If-Modified-Since'] = formatdate(mtime, usegmt=True)
        
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        
        if resp.status_code == 304:
            # Not Modified - Update local mtime to touch the file
            # print(f"[Smart Cache] Not Modified: {cache_path.name}")
            os.utime(cache_path, None)
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f), False
                
        elif resp.status_code == 200:
            # Modified - Save new data
            # print(f"[Smart Cache] Modified! Downloading {cache_path.name}")
            data = resp.json()
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
            return data, True
            
        else:
            # Error status - Fallback to cache if exists
            resp.raise_for_status()
            
    except Exception as e:
        print(f"Smart fetch failed ({e}), checking cache...")
        if cache_path.exists():
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f), False
        raise e

def cached_meraki_items(request):
    """Serve cached Meraki items to frontend with Smart Caching."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / "meraki_items_enriched.json"
    
    # Base Meraki Fetch (Smart)
    data = {}
    try:
        url = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/items.json"
        # Use simple name for raw cache to support headers check
        raw_cache_path = CACHE_DIR / "meraki_items_raw.json"
        
        # Check remote
        raw_data, modified = fetch_if_modified(url, raw_cache_path, timeout=3)
        
        if not modified and cache_path.exists():
            # If Meraki didn't change and we have enriched cache, return enriched
             # Check if enriched is also recent-ish (synced with raw)
            if cache_path.stat().st_mtime >= raw_cache_path.stat().st_mtime:
                 with open(cache_path, "r", encoding="utf-8") as f:
                    return JsonResponse(json.load(f))
        
        # If modified or no enriched cache, proceed to enrich
        data = raw_data
        
    except Exception as e:
        print(f"Meraki Smart Fetch failed ({e})...")
        
    # Enrichment Logic (Same as before)
    try:
        # Get latest version
        v_resp = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=5)
        latest_version = v_resp.json()[0]
        
        # Get DDragon Items
        dd_resp = requests.get(f"https://ddragon.leagueoflegends.com/cdn/{latest_version}/data/en_US/item.json", timeout=10)
        dd_items = dd_resp.json().get("data", {})

        if not data:
            data = dd_items # Fallback
        else:
            # Merge
            for item_id, item_info in data.items():
                dd_item = dd_items.get(item_id)
                if dd_item:
                    if dd_item.get("description"):
                        item_info["description"] = dd_item.get("description")
                    if dd_item.get("name"):
                         item_info["name"] = dd_item.get("name")
                         
        # Save enriched
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(data, f)
            
    except Exception as e:
        print(f"Enrichment failed: {e}")
        if not data:
            return JsonResponse({'error': 'Failed to fetch item data source'}, status=503)

    return JsonResponse(data)

def cached_meraki_champions(request):
    """Serve cached Meraki champions to frontend with Smart Caching."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / "meraki_champions.json"
    
    try:
        url = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json"
        # Smart Fetch (Large file, 20s timeout)
        data, _ = fetch_if_modified(url, cache_path, timeout=20)
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

class RunAnalysisView(APIView):
# ... existing code ...
    def post(self, request):
        with open("backend_debug.txt", "a") as f:
            f.write(f"\n[DEBUG] /api/analyze/ POST received at {time.time()}\n")
            # Log Raw Body to catch truncation issues
            try:
                raw_body = request.body.decode('utf-8')
                f.write(f"[DEBUG] Raw Body: {raw_body}\n")
            except:
                f.write("[DEBUG] Raw Body: <decode failed>\n")
            
        riot_id = request.data.get('riot_id')
        match_count = int(request.data.get('match_count', 20))
        use_timeline = request.data.get('use_timeline', True)
        call_ai = request.data.get('call_ai', True)
        region = request.data.get('region', 'NA')
        force_refresh = request.data.get('force_refresh', False)
        puuid = request.data.get('puuid', None)

        # Basic Validation
        if not riot_id:
            return Response({"error": "Riot ID is required"}, status=400)

        # Log to debug file
        with open("backend_debug.txt", "a") as f:
            f.write(f"[DEBUG-V2] Params: riot_id={riot_id}, count={match_count}, ai={call_ai}, refresh={force_refresh}, puuid={puuid}\n")
            f.write(f"[DEBUG-V2] Starting pipeline...\n")
            
        # Check for existing analysis in MongoDB
        from database import Database
        db = Database()
        # ... cache logic commented out ...
            
        try:
            # Run the pipeline
            
            import sys
            # Insert at 0 to prioritize local modules over installed setup
            project_root = str(settings.BASE_DIR.parent.parent)
            if project_root not in sys.path:
                sys.path.insert(0, project_root)
            
            from main import run_analysis_pipeline
            
            # If force_refresh is True, we pass it via specialized logic or simply don't load cache
            # But run_analysis_pipeline doesn't have force_refresh arg, it handles logic internally?
            # Actually main.py doesn't expose force_refresh param in run_analysis_pipeline signature!
            # It does now (checked previously? No, signature was:
            # riot_id, match_count, use_timeline, call_ai, save_json, open_dashboard, region_key)
            
            # Wait, I checked main.py just now. It DOES NOT have force_refresh.
            # But the view was passing it? 
            # Let's check the old code I am replacing.
            # "analysis_result = run_analysis_pipeline(riot_id, match_count=match_count, region_key=region, call_ai=call_ai)"
            
            # So I simply add puuid=puuid.
            
            # Note: We set open_dashboard=False since we are already in the dashboard
            analysis_result = run_analysis_pipeline(
                riot_id=riot_id,
                match_count=match_count,
                use_timeline=use_timeline,
                call_ai=call_ai,
                save_json=True,
                open_dashboard=False,
                region_key=region,
                puuid=puuid
            )
            with open("backend_debug.txt", "a") as f:
                f.write(f"[DEBUG] Pipeline finished successfully\n")
            
            if "error" in analysis_result:
                return Response({'error': analysis_result['error']}, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify save immediately
            with open("backend_debug.txt", "a") as f:
                f.write("[DEBUG] Verifying Save...\n")
            
            # Extract Canonical ID from pipeline result to ensure case-correctness
            canonical_riot_id = analysis_result.get("riot_id", riot_id)

            from database import Database
            db = Database()
            saved_doc = db.get_analysis(canonical_riot_id)
            
            with open("backend_debug.txt", "a") as f:
                f.write(f"[DEBUG] Save Verified: {bool(saved_doc)}\n")

            if not saved_doc:
                with open("backend_debug.txt", "a") as f:
                     f.write(f"[DEBUG] CRITICAL: Save verification failed for {canonical_riot_id}\n")
                return Response({'error': 'Analysis completed but failed to save to Database.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            print("[DEBUG-VIEW] Preparing Response...")
            response_data = {
                'status': 'success', 
                'riot_id': canonical_riot_id, # Return the ACTUAL ID used for saving
                'input_riot_id': riot_id,
                'debug': {
                    'db_connected': db.is_connected,
                    'save_verified': True,
                    'saved_id': saved_doc.get('riot_id'),
                    'db_doc_count': len(db.list_analyses())
                }
            }
            
            # log size of response (should be tiny)
            import json
            try:
                debug_json = json.dumps(response_data)
                with open("backend_debug.txt", "a") as f:
                    f.write(f"[DEBUG] Response JSON Size: {len(debug_json)} bytes\n")
            except Exception as e:
                with open("backend_debug.txt", "a") as f:
                    f.write(f"[DEBUG] Response Serialization Failed: {e}\n")

            with open("backend_debug.txt", "a") as f:
                f.write("[DEBUG] Sending Response object now.\n")
                
            # Use JsonResponse to bypass DRF content negotiation/overhead
            return JsonResponse(response_data)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            with open("backend_debug.txt", "a") as f:
                f.write(f"[DEBUG] Error in View: {str(e)}\n")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DeepDiveAnalysisView(APIView):
    def post(self, request, filename):
        filename = unquote(filename)
        match_id = request.data.get('match_id')
        print(f"Deep Dive Request: filename={filename}, match_id={match_id}")
        
        if not match_id:
            return Response({'error': 'match_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not match_id:
            return Response({'error': 'match_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Use robust DB lookup instead of fragile file path
        from database import Database
        db = Database()
        
        # 1. Strip helper prefix/suffix if present (Frontend sends "league_analysis_X.json")
        core_id = filename
        if core_id.startswith("league_analysis_") and core_id.endswith(".json"):
             core_id = core_id[len("league_analysis_"):-5]
        
        # Try finding by fuzzy filename (handles normalization)
        data = db.find_analysis_by_fuzzy_filename(core_id)
        
        if not data:
            # Fallback: Try straight ID lookup or original filename
            data = db.get_analysis(filename)
            
        if not data:
            print(f"Analysis not found for identifier: {filename}")
            return Response({'error': 'Analysis not found'}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            # Find the match in detailed_matches
            analysis = data.get("analysis", {})
            detailed_matches = analysis.get("detailed_matches", [])
            
            target_match = next((m for m in detailed_matches if m["match_id"] == match_id), None)
            
            if not target_match:
                print(f"Match {match_id} not found in detailed_matches (count={len(detailed_matches)})")
                return Response({'error': 'Match not found in this analysis file'}, status=status.HTTP_404_NOT_FOUND)
                
            # 1. Check Cache
            if "deep_dive_report" in target_match and target_match["deep_dive_report"]:
                print(f"[Deep Dive] serving cached report for {match_id}")
                return Response({'report': target_match["deep_dive_report"], 'match_data': target_match})

            # Run the deep dive
            import sys
            sys.path.append(str(settings.BASE_DIR.parent.parent))
            from league_crew import analyze_specific_game

            # Extract Champion Pool (Top 7 by games played)
            per_champion = analysis.get("per_champion", [])
            # Sort by games played (assuming 'games' or 'count' key, fallback to sorting provided by backend)
            champion_pool = []
            for pc in per_champion:
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
            else:
                # SAVE CACHE
                print(f"[Deep Dive] Saving report to DB for {filename}...")
                target_match["deep_dive_report"] = report_markdown
                # Find index to update in list
                for i, m in enumerate(detailed_matches):
                    if m["match_id"] == match_id:
                        detailed_matches[i] = target_match
                        break
                
                # Update analysis object
                analysis["detailed_matches"] = detailed_matches
                data["analysis"] = analysis
                
                # Persist to DB
                db.save_analysis(data)
                print("[Deep Dive] Saved successfully.")
            
            return Response({'report': report_markdown, 'match_data': target_match})
            
        except Exception as e:
            print(f"Deep Dive Error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def health_check(request):
    """Simple health check for frontend polling."""
    return JsonResponse({"status": "online", "timestamp": time.time()})
