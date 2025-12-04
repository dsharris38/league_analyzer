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

class RunAnalysisView(APIView):
    def post(self, request):
        riot_id = request.data.get('riot_id')
        match_count = int(request.data.get('match_count', 20))
        use_timeline = request.data.get('use_timeline', True)
        call_ai = request.data.get('call_ai', True)
        
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
                open_dashboard=False
            )
            
            return Response({'status': 'success', 'riot_id': riot_id})
            
        except Exception as e:
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

            print(f"Running deep dive for {match_id}...")
            report_markdown = analyze_specific_game(match_id, target_match)
            print(f"Deep dive complete. Report length: {len(report_markdown)}")
            
            if not report_markdown:
                 print("Report is empty!")
            
            return Response({'report': report_markdown, 'match_data': target_match})
            
        except Exception as e:
            print(f"Deep Dive Error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class PingView(APIView):
    permission_classes = [] # Allow anyone to ping
    def get(self, request):
        return Response({
            'status': 'ok',
            'allowed_hosts': settings.ALLOWED_HOSTS,
            'cors_origins': getattr(settings, 'CORS_ALLOWED_ORIGINS', []),
            'saves_dir_exists': SAVES_DIR.exists(),
            'saves_dir_path': str(SAVES_DIR),
            'base_dir': str(settings.BASE_DIR),
            'debug': settings.DEBUG,
        })
