import os
import sys
import traceback
from dotenv import load_dotenv

# Setup paths
sys.path.append(os.getcwd())
load_dotenv(".env")

from main import run_analysis_pipeline

def debug_full():
    print("--- Starting Full Pipeline Debug ---")
    riot_id = "Bingbong#NAbab"
    
    try:
        # Mimic views.py call
        result = run_analysis_pipeline(
            riot_id=riot_id,
            match_count=20, # reduced count? No, stick to default
            use_timeline=False, # match views.py default? views says True. Let's use True.
            call_ai=False, # Skip AI to save time/tokens, focusing on data fetching
            save_json=True,
            open_dashboard=False,
            region_key="NA"
        )
        
        if "error" in result:
            print(f"PIPELINE RETURNED ERROR: {result['error']}")
        else:
            print("PIPELINE SUCCESS!")
            print(f"Keys in result: {list(result.keys())}")
            if "summoner_info" in result:
                print(f"Summoner Info: {result['summoner_info']}")
            
    except Exception:
        print("PIPELINE CRASHED:")
        traceback.print_exc()

if __name__ == "__main__":
    debug_full()
