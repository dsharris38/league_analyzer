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
                if attempt == max_attempts:
                    print(f"[RiotClient] Request failed after {max_attempts} attempts: url={url}, status={status_code}, error={e}")
                    raise
                print(f"[RiotClient] Request failed (attempt {attempt}/{max_attempts}): url={url}, status={status_code}. Retrying in {backoff * attempt}s...")
                time.sleep(backoff * attempt)

        raise RuntimeError("Unexpected retry failure in RiotClient._get")

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
        return r.json()

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
        Get recent match IDs.

        Default queue = 420 (Ranked Solo/Duo)
        queue = 440    (Ranked Flex)
        queue = None   (No filter, all queues)
        """
        url = f"{self.base_match_url}/lol/match/v5/matches/by-puuid/{puuid}/ids"
        params: Dict[str, Any] = {
            "start": 0,
            "count": count,
        }
        if queue is not None:
            params["queue"] = queue

        r = self._get(url, params=params, timeout=10)
        return r.json()

    def get_match(self, match_id: str) -> Dict[str, Any]:
        """Fetch full match-v5 payload for a given match ID."""
        url = f"{self.base_match_url}/lol/match/v5/matches/{match_id}"
        r = self._get(url, timeout=15)
        return r.json()

    def get_match_timeline(self, match_id: str) -> Dict[str, Any]:
        """Fetch match timeline for deeper analysis."""
        url = f"{self.base_match_url}/lol/match/v5/matches/{match_id}/timeline"
        r = self._get(url, timeout=15)
        return r.json()

    # -------------------------------
    # League / Rank
    # -------------------------------

    def get_league_entries(self, summoner_id: str) -> List[Dict[str, Any]]:
        """Get league entries (Rank, LP, etc.) for a summoner."""
        url = f"{self.base_lol_url}/lol/league/v4/entries/by-summoner/{summoner_id}"
        r = self._get(url, timeout=10)
        return r.json()
    # -------------------------------
    # Mastery
    # -------------------------------

    def get_champion_mastery(self, puuid: str) -> List[Dict[str, Any]]:
        """Get all champion mastery entries sorted by number of champion points descending."""
        url = f"{self.base_lol_url}/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}"
        r = self._get(url, timeout=10)
        return r.json()


