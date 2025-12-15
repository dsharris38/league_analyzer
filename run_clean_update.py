
import sys
from main import run_analysis_pipeline

# Configuration
RIOT_ID = "Bingbong#nabab"
MATCH_COUNT = 250  # Full Analysis
REGION = "NA"

print(f"--- Running Manual Clean Update for {RIOT_ID} ---")

try:
    result = run_analysis_pipeline(
        riot_id=RIOT_ID,
        match_count=MATCH_COUNT,
        use_timeline=True, # Enable timeline for full data
        call_ai=True,      # Enable AI for full coaching
        save_json=True,
        open_dashboard=False,
        region_key=REGION
    )
    
    if "error" in result:
        print(f"FAILED: {result['error']}")
    else:
        print("SUCCESS! Dashboard file updated.")
        
except Exception as e:
    import traceback
    traceback.print_exc()
