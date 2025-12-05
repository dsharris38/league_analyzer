
import os
import sys
import django
from pathlib import Path

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent / 'web_dashboard' / 'backend'
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from main import run_analysis_pipeline

# Mock request data
riot_id = "Dyl#NA1" # Replace with a known valid ID if possible, or ask user. 
# Using a placeholder for now, assuming the user has one they use. 
# Actually, I should probably use the one from the logs if I had them.
# I'll try to find a valid one from the file system saves if possible, or just ask the user.
# For now, let's try to run it with a dummy ID and see if it crashes *before* API calls (e.g. import errors).
# Or better, I can check if there are any saved analysis files to get a valid ID.

def debug_run():
    try:
        print("Starting analysis pipeline...")
        # We'll use a dummy ID, but the Riot API might fail if it doesn't exist.
        # However, if it's a code error (SyntaxError, ImportError), it will fail immediately.
        run_analysis_pipeline(
            riot_id="Potato Grip#NA1", 
            match_count=1, 
            use_timeline=True, 
            call_ai=True, # Enable AI to test new prompts
            save_json=False,
            open_dashboard=False
        )
        print("Analysis finished successfully.")
    except Exception as e:
        print(f"Analysis Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_run()
