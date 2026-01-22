
import sys
import os
import requests
sys.path.append(os.getcwd())

from riot_client import RiotClient

def test_routing():
    print("Testing Region Routing...")
    
    # helper
    def check_region(region_key, expected_routing):
        try:
            c = RiotClient(region_key)
            if c.region == expected_routing:
                print(f"[PASS] {region_key} -> {c.region}")
            else:
                print(f"[FAIL] {region_key} -> {c.region} (Expected {expected_routing})")
        except Exception as e:
            print(f"[ERROR] {region_key}: {e}")

    check_region("NA", "americas")
    check_region("EUW", "europe")
    check_region("KR", "asia")
    check_region("OCE", "sea")
    
    # Test a mockup PUUID lookup if possible?
    # No, requires valid API key and valid PUUID.
    # We can try to instantiate client and print the base URL used for account lookup
    c = RiotClient("NA")
    print(f"NA Account URL: {c.base_account_url}")

if __name__ == "__main__":
    test_routing()
