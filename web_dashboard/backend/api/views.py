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
import sys
sys.path.append(str(settings.BASE_DIR.parent.parent)) # Add league_analyzer root
from league_crew import analyze_specific_game

SAVES_DIR = settings.BASE_DIR.parent.parent / 'saves'

class AnalysisListView(APIView):
    def get(self, request):
        files = []
        if SAVES_DIR.exists():
            for f in SAVES_DIR.glob('league_analysis_*.json'):
                try:
                    stats = f.stat()
                    files.append({
                        'filename': f.name,
                        'created': stats.st_mtime,
                        'size': stats.st_size
                    })
                except OSError:
                    pass
        
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
            print(f"Running deep dive for {match_id}...")
            report_markdown = analyze_specific_game(match_id, target_match)
            print(f"Deep dive complete. Report length: {len(report_markdown)}")
            
            if not report_markdown:
                 print("Report is empty!")
            
            return Response({'report': report_markdown})
            
        except Exception as e:
            print(f"Deep Dive Error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
