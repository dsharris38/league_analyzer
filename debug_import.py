
import sys
import os
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.append(str(ROOT_DIR))

print("Attempting to import run_analysis_pipeline from main...")
try:
    from main import run_analysis_pipeline
    print("Import successful!")
except ImportError as e:
    print(f"ImportError: {e}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
