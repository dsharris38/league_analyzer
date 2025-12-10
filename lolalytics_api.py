import requests
import re
from typing import Optional, List

class LolalyticsData:
    def __init__(self, tier: str, win_rate: str, popular_build: List[int]):
        self.tier = tier
        self.win_rate = win_rate
        self.popular_build = popular_build
    
    def __repr__(self):
        return f"LolalyticsData(tier='{self.tier}', win_rate='{self.win_rate}', build={self.popular_build})"

class Lolalytics:
    @staticmethod
    def get_champion_data(champion: str, lane: str = "mid", vs_champion: Optional[str] = None) -> Optional[LolalyticsData]:
        """
        Scrapes live data from Lolalytics.com.
        Relies on their SSR HTML structure.
        """
        if not champion:
            return None
            
        champion_slug = champion.lower().replace(" ", "").replace("'", "").replace(".", "")
        if champion_slug == "wukong": champion_slug = "monkeyking"
        
        # Lolalytics uses specific lane names
        # 'top', 'jungle', 'mid', 'adc' (bottom), 'support'
        lane_map = {
            "top": "top",
            "jungle": "jungle",
            "mid": "middle",
            "adc": "bottom",
            "bottom": "bottom",
            "support": "support",
            "utility": "support"
        }
        
        url = f"https://www.lolalytics.com/lol/{champion_slug}/build/"
        
        # If we have a matchup, use the VS url
        # Format: /lol/ahri/vs/syndra/build/
        if vs_champion and vs_champion != "Unknown":
            vs_slug = vs_champion.lower().replace(" ", "").replace("'", "").replace(".", "")
            if vs_slug == "wukong": vs_slug = "monkeyking"
            url = f"https://www.lolalytics.com/lol/{champion_slug}/vs/{vs_slug}/build/"
            # print(f"[Lolalytics] Fetching matchup: {champion} vs {vs_champion}")
        
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
            
            # 1. Win Rate
            wr_match = re.search(r'>([\d\.]+)<!---->%</div><div[^>]*>Win', html)
            win_rate = "N/A"
            if wr_match:
                win_rate = wr_match.group(1)
            else:
                 wr_match_loose = re.search(r'([\d\.]+)%</div>.*?Win', html)
                 if wr_match_loose:
                     win_rate = wr_match_loose.group(1)

            # 2. Tier
            tier_match = re.search(r'>([SABCDF][\+\-]?)<!----></div><div[^>]*>Tier', html)
            tier = "Unknown"
            if tier_match:
                tier = tier_match.group(1)
            
            # 3. Popular Build (Core Items)
            # Pattern: "6655_3020_4645" or similar inside JSON-like structures
            # We look for 3 or more 4-digit numbers separated by underscores
            build_match = re.search(r'"(\d{4}_\d{4}_\d{4}(?:_\d{4})?)"', html)
            
            popular_build = []
            if build_match:
                # Extract IDs
                ids_str = build_match.group(1)
                popular_build = [int(x) for x in ids_str.split("_")]
            
            return LolalyticsData(tier=tier, win_rate=win_rate, popular_build=popular_build)
            
        except Exception as e:
            print(f"[Lolalytics] Error: {e}")
            return None

if __name__ == "__main__":
    print("Testing extraction for Ahri vs Syndra...")
    data = Lolalytics.get_champion_data("Ahri", vs_champion="Syndra")
    print(data)
