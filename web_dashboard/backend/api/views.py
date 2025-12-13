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
        print(f"Listing files in {SAVES_DIR}")
        files = []
        if SAVES_DIR.exists():
            for f in SAVES_DIR.glob('league_analysis_*.json'):
                try:
                    stats = f.stat()
                    # Read the file to get metadata
                    with open(f, 'r', encoding='utf-8') as json_file:
                        data = json.load(json_file)
                        
                    summary = data.get('analysis', {}).get('summary', {})
                    
                    files.append({
                        'filename': f.name,
                        'created': stats.st_mtime,
                        'size': stats.st_size,
                        'riot_id': data.get('riot_id', 'Unknown'),
                        'primary_role': data.get('analysis', {}).get('primary_role', 'Unknown'),
                        'match_count': data.get('match_count_requested', 0)
                    })
                except Exception as e:
                    print(f"Error reading {f.name}: {e}")
                    # Still add it with basic info if read fails
                    files.append({
                        'filename': f.name,
                        'created': f.stat().st_mtime,
                        'size': f.stat().st_size,
                        'riot_id': 'Error',
                        'primary_role': 'Error',
                        'match_count': 0
                    })
        
        # Sort by created desc
        files.sort(key=lambda x: x['created'], reverse=True)
        return Response(files)

class AnalysisDetailView(APIView):
    def get(self, request, filename):
        filename = unquote(filename)
        file_path = SAVES_DIR / filename
        if not file_path.exists():
            return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return Response(data)
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
        
        if not riot_id:
            return Response({'error': 'riot_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Run the pipeline
            import sys
            sys.path.append(str(settings.BASE_DIR.parent.parent))
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
            
            return Response({'status': 'success', 'riot_id': riot_id})
            
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

