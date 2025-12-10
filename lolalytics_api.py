import requests
import re
from typing import Optional, Any

class LolalyticsData:
    def __init__(self, tier: str, win_rate: str):
        self.tier = tier
        self.win_rate = win_rate
    
    def __repr__(self):
        return f"LolalyticsData(tier='{self.tier}', win_rate='{self.win_rate}')"

class Lolalytics:
    @staticmethod
    def get_champion_data(champion: str, lane: str = "mid") -> Optional[LolalyticsData]:
        """
        Scrapes live data from Lolalytics.com.
        Relies on their SSR HTML structure.
        """
        if not champion:
            return None
            
        # Normalize inputs
        champion_slug = champion.lower().replace(" ", "").replace("'", "").replace(".", "")
        if champion_slug == "wukong": champion_slug = "monkeyking" # Riot vs Lolalytics naming
        
        # Lolalytics uses specific lane names
        # 'top', 'jungle', 'mid', 'adc' (bottom), 'support'
        lane_map = {
            "top": "top",
            "jungle": "jungle",
            "mid": "middle", # URL uses 'middle' sometimes? No, checking URL structure.
            # URL: lolalytics.com/lol/ahri/build/ -> defaults to most popular
            "adc": "bottom",
            "bottom": "bottom",
            "support": "support",
            "utility": "support"
        }
        
        # Actually the URL for lane specific is: /lol/{champ}/build/{lane}/? 
        # But /lol/{champ}/build/ usually defaults to their main role.
        # Let's try the generic build URL first as it redirects to the main role.
        
        url = f"https://www.lolalytics.com/lol/{champion_slug}/build/"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
        }
        
        try:
            resp = requests.get(url, headers=headers, timeout=5)
            if resp.status_code != 200:
                print(f"[Lolalytics] Failed to fetch {url}: {resp.status_code}")
                return None
                
            html = resp.text
            
            # --- Regex Extraction ---
            # Pattern seen in debug: 
            # <div class="mb-1 font-bold"><!--t=4g-->51.54<!---->%</div><div class="text-xs text-[#bbb]">Win
            # We look for the number before "%" and "Win"
            
            # 1. Win Rate
            # Matches: >51.54<!---->%</div>...Win
            # or just >51.54%</div>...Win if comments are stripped (rare in raw text)
            wr_match = re.search(r'>([\d\.]+)<!---->%</div><div[^>]*>Win', html)
            win_rate = "N/A"
            if wr_match:
                win_rate = wr_match.group(1)
            else:
                 # Backup loose match
                 wr_match_loose = re.search(r'([\d\.]+)%</div>.*?Win', html)
                 if wr_match_loose:
                     win_rate = wr_match_loose.group(1)

            # 2. Tier
            # Pattern: <div class="mb-1 font-bold"><!--t=4e-->Emerald+<!----></div><div class="text-xs text-[#bbb]">Tier
            # Wait, "Emerald+" is the rank filter. We want the TIER (S, A, B).
            # Look for "Tier" label.
            # <div class="...">S-</div>...Tier
            tier_match = re.search(r'>([SABCDF][\+\-]?)<!----></div><div[^>]*>Tier', html)
            tier = "Unknown"
            if tier_match:
                tier = tier_match.group(1)
            
            # Return data
            return LolalyticsData(tier=tier, win_rate=win_rate)
            
        except Exception as e:
            print(f"[Lolalytics] Error: {e}")
            return None

# Test integration
if __name__ == "__main__":
    print("Testing extraction for Ahri...")
    data = Lolalytics.get_champion_data("Ahri")
    print(data)
