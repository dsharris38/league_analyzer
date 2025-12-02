import time
import requests
from typing import List, Dict, Any, Optional
from analyzer_config import RIOT_API_KEY, REGION, PLATFORM

# Base URLs
BASE_ACCOUNT_URL = f"https://{REGION}.api.riotgames.com"
BASE_LOL_URL = f"https://{PLATFORM}.api.riotgames.com"
BASE_MATCH_URL = f"https://{REGION}.api.riotgames.com"

HEADERS = {
    "X-Riot-Token": RIOT_API_KEY
}


class RiotClient:
    """
    Thin wrapper around Riot's REST API.

    Key improvements:
    - Automatic retry on 429 or transient network errors
    - Queue filtering (solo = 420, flex = 440, or None = all queues)
    """

    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

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
                if attempt == max_attempts:
                    print(f"[RiotClient] Request failed after {max_attempts} attempts: {e}")
                    raise
                print(f"[RiotClient] Request failed (attempt {attempt}/{max_attempts}). Retrying in {backoff * attempt}s...")
                time.sleep(backoff * attempt)

        raise RuntimeError("Unexpected retry failure in RiotClient._get")

    # -------------------------------
    # Account lookup
    # -------------------------------

    def get_account_by_riot_id(self, game_name: str, tag_line: str) -> Dict[str, Any]:
        """Look up an account by Riot ID (gameName#tagLine)."""
        url = f"{BASE_ACCOUNT_URL}/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
        r = self._get(url, timeout=10)
        return r.json()

    def get_summoner_by_puuid(self, puuid: str) -> Dict[str, Any]:
        """Get Summoner-v4 data for a player by PUUID."""
        url = f"{BASE_LOL_URL}/lol/summoner/v4/summoners/by-puuid/{puuid}"
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
        url = f"{BASE_MATCH_URL}/lol/match/v5/matches/by-puuid/{puuid}/ids"
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
        url = f"{BASE_MATCH_URL}/lol/match/v5/matches/{match_id}"
        r = self._get(url, timeout=15)
        return r.json()

    def get_match_timeline(self, match_id: str) -> Dict[str, Any]:
        """Fetch match timeline for deeper analysis."""
        url = f"{BASE_MATCH_URL}/lol/match/v5/matches/{match_id}/timeline"
        r = self._get(url, timeout=15)
        return r.json()
