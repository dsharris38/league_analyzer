import time
import requests
from typing import List, Dict, Any, Optional
from analyzer_config import RIOT_API_KEY, REGION, PLATFORM


HEADERS = {
    "X-Riot-Token": RIOT_API_KEY
}


# Region Mapping
# Maps User-Friendly Region Codes to (Platform, Routing)
# Platform: for Summoner/League V4 (na1, euw1, kr)
# Routing: for Match V5 / Account V1 (americas, europe, asia, esports)
REGION_MAPPING = {
    "NA":  {"platform": "na1",  "routing": "americas"},
    "EUW": {"platform": "euw1", "routing": "europe"},
    "EUNE":{"platform": "eun1", "routing": "europe"},
    "KR":  {"platform": "kr",   "routing": "asia"},
    "BR":  {"platform": "br1",  "routing": "americas"},
    "LAN": {"platform": "la1",  "routing": "americas"},
    "LAS": {"platform": "la2",  "routing": "americas"},
    "OCE": {"platform": "oc1",  "routing": "sea"}, # OCE is weird, often routed to americas or sea. checking docs... officially 'sea' for match-v5? No, usually 'americas' for OCE match history in old system, but new routing might be 'sea'.
    # Riot Docs: https://developer.riotgames.com/apis#match-v5
    # NA, BR, LAN, LAS -> americas
    # KR, JP -> asia
    # EUNE, EUW, TR, RU -> europe
    # OCE, PH, SG, TH, TW, VN -> sea
    "JP":  {"platform": "jp1",  "routing": "asia"},
    "TR":  {"platform": "tr1",  "routing": "europe"},
    "RU":  {"platform": "ru",   "routing": "europe"},
    "PH":  {"platform": "ph2",  "routing": "sea"},
    "SG":  {"platform": "sg2",  "routing": "sea"},
    "TH":  {"platform": "th2",  "routing": "sea"},
    "TW":  {"platform": "tw2",  "routing": "sea"},
    "VN":  {"platform": "vn2",  "routing": "sea"},
}

# For OCE, specifically, check docs. Usually mapped to 'sea' for V5?
# Riot Developer Portal: "Americas" includes NA, BR, LATAM. "Asia" includes KR, JP. "Europe" includes EU, TR, RU. "SEA" includes OCE, PH, SG, TH, TW, VN.
REGION_MAPPING["OCE"]["routing"] = "sea" 


class RiotClient:
    """
    Thin wrapper around Riot's REST API.

    Key improvements:
    - Automatic retry on 429 or transient network errors
    - Queue filtering (solo = 420, flex = 440, or None = all queues)
    - Dynamic Region Support
    """

    def __init__(self, region_key: str = "NA") -> None:
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        
        # Default to NA/Americas if unknown
        config = REGION_MAPPING.get(region_key.upper(), REGION_MAPPING["NA"])
        
        self.platform = config["platform"]
        self.region = config["routing"]
        
        # Update Base URLs for this instance
        self.base_account_url = f"https://{self.region}.api.riotgames.com"
        self.base_lol_url = f"https://{self.platform}.api.riotgames.com"
        self.base_match_url = f"https://{self.region}.api.riotgames.com"

    # -------------------------------
    # Internal GET helper with retries
    # -------------------------------

    def _get(
        self,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 10,
    ) -> requests.Response:
        """Centralized GET with basic retry and 429 handling."""
        max_attempts = 4
        backoff = 1.5

        for attempt in range(1, max_attempts + 1):
            try:
                resp = self.session.get(url, params=params, timeout=timeout)

                # Handle Riot rate limits
                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", "2"))
                    print(f"[RiotClient] Rate limited (429). Retrying in {retry_after}s...")
                    time.sleep(retry_after)
                    continue

                resp.raise_for_status()
                return resp

            except requests.RequestException as e:
                status_code = e.response.status_code if e.response else "Unknown"
                
                # Fail fast on client errors (4xx) - likely not recoverable by retry
                # 429 is handled above, so checking 400-499 here covers the rest
                if isinstance(status_code, int) and 400 <= status_code < 500:
                    print(f"[RiotClient] Client Error ({status_code}): {url}")
                    raise e

                if attempt == max_attempts:
                    print(f"[RiotClient] Request failed after {max_attempts} attempts: url={url}, status={status_code}, error={e}")
                    raise
                print(f"[RiotClient] Request failed (attempt {attempt}/{max_attempts}): url={url}, status={status_code}. Retrying in {backoff * attempt}s...")
                time.sleep(backoff * attempt)

        raise RuntimeError("Unexpected retry failure in RiotClient._get")

    # -------------------------------
    # Account lookup
    # -------------------------------

    # -------------------------------
    # Account lookup
    # -------------------------------

    def get_account_by_riot_id(self, game_name: str, tag_line: str) -> Dict[str, Any]:
        """Look up an account by Riot ID (gameName#tagLine)."""
        url = f"{self.base_account_url}/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
        r = self._get(url, timeout=10)
        return r.json()

    def get_summoner_by_puuid(self, puuid: str) -> Dict[str, Any]:
        """Get Summoner-v4 data for a player by PUUID."""
        url = f"{self.base_lol_url}/lol/summoner/v4/summoners/by-puuid/{puuid}"
        r = self._get(url, timeout=10)
        data = r.json()
        
        # Note: 'id' (SummonerID) might be missing in some regions/responses.
        # Since we switched to checking Rank by PUUID, we no longer enforce 'id' presence.
        return data

    # -------------------------------
    # Match history
    # -------------------------------

    # -------------------------------
    # Match history
    # -------------------------------

    def get_recent_match_ids(
        self,
        puuid: str,
        count: int = 20,
        queue: Optional[int] = 420,
    ) -> List[str]:
        """
        Get recent match IDs with automatic pagination.
        Riot API limits 'count' to 100 per request.
        """
        url = f"{self.base_match_url}/lol/match/v5/matches/by-puuid/{puuid}/ids"
        all_ids = []
        start_index = 0
        
        while len(all_ids) < count:
            # Determine batch size (max 100)
            remaining = count - len(all_ids)
            batch_size = min(remaining, 100)
            
            params: Dict[str, Any] = {
                "start": start_index,
                "count": batch_size,
            }
            if queue is not None:
                params["queue"] = queue

            try:
                r = self._get(url, params=params, timeout=10)
                batch_ids = r.json()
            except Exception as e:
                print(f"[RiotClient] Failed to fetch match batch at start={start_index}: {e}")
                break

            if not batch_ids:
                break # No more matches available
                
            all_ids.extend(batch_ids)
            start_index += len(batch_ids)
            
            # Rate limit politeness handled by _get internals, but safeguard infinite loops
            if len(batch_ids) < batch_size:
                break
                
        return all_ids

    def get_match(self, match_id: str) -> Dict[str, Any]:
        """Fetch full match-v5 payload for a given match ID (Cached via MongoDB)."""
        from database import Database
        db = Database()
        
        # 1. Try DB Cache
        cached = db.get_match(match_id)
        if cached:
            return cached

        # 2. Fetch Fresh
        url = f"{self.base_match_url}/lol/match/v5/matches/{match_id}"
        r = self._get(url, timeout=15)
        data = r.json()
        
        # 3. Save to DB
        db.save_match(data)
            
        return data

    def get_match_timeline(self, match_id: str) -> Dict[str, Any]:
        """Fetch match timeline for deeper analysis (Cached via MongoDB)."""
        from database import Database
        db = Database()

        # 1. Try DB Cache
        cached = db.get_timeline(match_id)
        if cached:
            return cached

        # 2. Fetch Fresh
        url = f"{self.base_match_url}/lol/match/v5/matches/{match_id}/timeline"
        r = self._get(url, timeout=15)
        data = r.json()
        
        # 3. Save to DB
        db.save_timeline(match_id, data)
            
        return data

    # -------------------------------
    # League / Rank
    # -------------------------------

    def get_league_entries(self, puuid: str) -> List[Dict[str, Any]]:
        """Get league entries (Rank, LP, etc.) for a summoner by PUUID."""
        url = f"{self.base_lol_url}/lol/league/v4/entries/by-puuid/{puuid}"
        try:
            r = self._get(url, timeout=10)
            return r.json()
        except Exception as e:
            # Handle 403 Forbidden or other errors gracefully
            if "403" in str(e):
                print(f"[RiotClient] Warning: 403 Forbidden on League V4 for PUUID {puuid}. Account might be restricted or ID invalid.")
                return []
            raise e
    # -------------------------------
    # Mastery
    # -------------------------------

    def get_champion_mastery(self, puuid: str) -> List[Dict[str, Any]]:
        """Get all champion mastery entries sorted by number of champion points descending."""
        url = f"{self.base_lol_url}/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}"
        r = self._get(url, timeout=10)
        return r.json()


