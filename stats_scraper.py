import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Optional

HEADER = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def get_past_ranks(game_name: str, tag_line: str, region: str = "na") -> List[Dict[str, str]]:
    """
    Scrape LeagueOfGraphs for past season ranks.
    Returns a list of dicts: [{"season": "S2023", "tier": "Platinum IV"}, ...]
    """
    # Normalize region if needed (LoG uses specific region codes)
    # Mapping common region codes to LeagueOfGraphs format
    # simplistic mapping: na1 -> na, euw1 -> euw, etc.
    region_map = {
        "na1": "na",
        "euw1": "euw",
        "eun1": "eune",
        "kr": "kr",
        "br1": "br",
        "jp1": "jp",
        "ru": "ru",
        "oc1": "oce",
        "tr1": "tr",
        "la1": "lan",
        "la2": "las"
    }
    
    # Clean inputs
    r_code = region_map.get(region.lower(), region.lower()).replace("1", "") # fallback cleanup
    g_name = game_name.replace(" ", "%20") # URL encode spaces logic (Log might handle + or %20)
    
    # LeagueOfGraphs URL format: https://www.leagueofgraphs.com/summoner/na/Name-Tag
    # Note: If name contains spaces, they might be +, but let's try standard.
    # Actually LoG usually uses dashes or encoded URL. Browser usually redirects.
    # Safe format: Name-Tag
    
    url = f"https://www.leagueofgraphs.com/summoner/{r_code}/{g_name}-{tag_line}"
    
    try:
        print(f"Scraping {url} for past ranks...")
        response = requests.get(url, headers=HEADER, timeout=10)
        
        if response.status_code != 200:
            print(f"Failed to fetch LeagueOfGraphs: Status {response.status_code}")
            return []
            
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Structure on LoG: 
        # Often in a sidebar div with class "box" containing "Personal Ratings" or similar.
        # But specifically looking for "Past Ranks".
        # Let's search for the elements.
        # Usually they are in a list or div. 
        # Best bet: Look for text "Season" or known tiers.
        
        # Specific container usually has class "summonerRatingsHistory" or similar if they expose it?
        # Let's look for the standard "S<Number> <Tier>" badges.
        
        results = []
        
        # LeagueOfGraphs "Best Rating" or "Past Ranks" often appear in the header or sidebar.
        # We'll look for elements with text matching 'Season \d+'
        
        # Based on typical LoG layout:
        # <div class="tag"> S13: Platinum IV </div>
        # or similar badges.
        
        # Let's try to match text patterns in common containers.
        # There is often a section for "Leagues".
        
        # Strategy: Find all "div" or "span" that contain "Season" or "S13", etc.
        # Pattern: "S(\d+):? (.+)"
        
        # Actually LoG often uses a 'tag' class for these small badges.
        tags = soup.find_all(lambda tag: tag.name in ['div', 'span'] and 'S20' in tag.get_text())
        
        # Let's try a more generic approach: Find "season-rating" containers if they exist, 
        # or parse the text of badges.
        
        # LoG specific: They have a "ratings" section.
        # Let's inspect the text of ALL text nodes that look like a Rank.
        
        # Trying a specific selector often found on LoG profile sidebars:
        # The sidebar has "Past Ranks" sometimes? No, generally they show current.
        # "Records" page has history?
        # The main page usually has "Season 2024 ...", "Season 2023 ..."
        
        # Let's try parsing the "banner" or specific data attributes if available.
        
        # Fallback: Look for elements with class matching "img-align-block" that are next to text?
        
        # Let's try to capture anything that looks like "S10 Gold", "S11 Platinum".
        text_content = soup.get_text(" ", strip=True)
        # Regex to find "S13: Gold IV" or similar
        # Valid tiers: Iron, Bronze, Silver, Gold, Platinum, Emerald, Diamond, Master, Grandmaster, Challenger
        # Year pattern: S\d+ or Season \d+
        
        matches = re.findall(r"(S\d+|Season \d+)[:\s]+(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond|Master|Grandmaster|Challenger)\s*([IV\d]*)", text_content, re.IGNORECASE)
        
        seen_seasons = set()
        for season, tier, div in matches:
            # Clean up season string (e.g. "Season 2023" -> "S2023")
            s_clean = season.replace("Season ", "S").replace(" ", "").upper()
            
            # Skip duplicate seasons (sometimes they appear multiple times)
            if s_clean in seen_seasons:
                continue
            seen_seasons.add(s_clean)
            
            full_rank = f"{tier} {div}".strip()
            results.append({"season": s_clean, "tier": full_rank})
            
        # Sort results (descending by season typically preferred)
        # S14 > S13 ...
        # Simple extraction might be unsorted.
        
        return results

    except Exception as e:
        print(f"Error scraping LeagueOfGraphs: {e}")
        return []

if __name__ == "__main__":
    # Test
    print(get_past_ranks("Bingbong", "NAbab", "na1"))
