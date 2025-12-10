"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application
from pathlib import Path
import sys

# Add the repository root to sys.path so we can import league_crew/main
# BASE_DIR is .../backend/config/wsgi.py -> parent -> parent -> backend
# We need repo root: backend -> parent -> web_dashboard -> parent -> league_analyzer
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent.parent
sys.path.append(str(REPO_ROOT))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
