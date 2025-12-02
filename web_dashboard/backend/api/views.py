import json
import os
from pathlib import Path
from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

# Path to the saves directory
# BASE_DIR is web_dashboard/backend
# We need to go up to league_analyzer/saves
SAVES_DIR = settings.BASE_DIR.parent.parent / 'saves'

class AnalysisListView(APIView):
    def get(self, request):
        if not SAVES_DIR.exists():
            return Response([], status=status.HTTP_200_OK)

        files = []
        for f in SAVES_DIR.glob('league_analysis_*.json'):
            stat = f.stat()
            metadata = {
                'filename': f.name,
                'created': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'size': stat.st_size,
                'riot_id': 'Unknown',
                'match_count': 0,
                'primary_role': 'Unknown'
            }
            
            # Peek into the file for metadata
            try:
                with open(f, 'r', encoding='utf-8') as json_file:
                    # Read only the first 4KB to avoid loading huge files if possible, 
                    # but JSON parsing requires full content usually. 
                    # Given these are < 1MB typically, full load is fine.
                    data = json.load(json_file)
                    metadata['riot_id'] = data.get('riot_id', 'Unknown')
                    metadata['match_count'] = data.get('match_count_requested', 0)
                    metadata['primary_role'] = data.get('analysis', {}).get('primary_role', 'Unknown')
            except Exception:
                # If reading fails, just return basic file info
                pass

            files.append(metadata)
        
        # Sort by newest first
        files.sort(key=lambda x: x['created'], reverse=True)
        return Response(files)

import sys

# Add the project root to sys.path to allow importing main.py and other modules
PROJECT_ROOT = settings.BASE_DIR.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from main import run_analysis_pipeline

class AnalysisDetailView(APIView):
    def get(self, request, filename):
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
        
        if not riot_id:
            return Response({'error': 'Riot ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Run the analysis pipeline
            # We disable open_dashboard since we are already in the web app
            result = run_analysis_pipeline(
                riot_id=riot_id,
                match_count=match_count,
                use_timeline=True,
                call_ai=True,
                save_json=True,
                open_dashboard=False
            )
            return Response({'status': 'success', 'riot_id': riot_id})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
