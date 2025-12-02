#!/usr/bin/env python3
"""Sync champion_profiles.json with Riot Data Dragon champion list.

This script:
  - Fetches the latest (or a specified) Data Dragon patch.
  - Downloads champion.json for that patch.
  - Ensures every champion has an entry in champion_profiles.json.
  - For any missing champion, it creates a *skeleton* profile you can fill in later.

Usage (from your project root, with requests installed):

    python data_dragon_sync.py

You can optionally set PATCH manually (e.g. "14.10.1") inside this file if you
want to lock to a specific patch instead of "latest".
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

import requests


# ----------------------
# Configuration
# ----------------------

# If PATCH is None, the script will query Data Dragon for the latest patch.
# You can hardcode something like "14.10.1" here if you prefer.
PATCH: Optional[str] = None

# Default language
LANG: str = "en_US"

# Path to your champion_profiles.json file (relative to this script)
CHAMPION_PROFILES_PATH = Path(__file__).parent / "champion_profiles.json"


# ----------------------
# Helpers
# ----------------------

def get_latest_patch() -> str:
    """Fetch the latest version string from Data Dragon."""
    url = "https://ddragon.leagueoflegends.com/api/versions.json"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    versions: List[str] = resp.json()
    if not versions:
        raise RuntimeError("No versions returned from Data Dragon.")
    return versions[0]


def get_champion_data(patch: str, lang: str = LANG) -> Dict[str, Any]:
    """Download champion.json for the given patch and language."""
    url = f"https://ddragon.leagueoflegends.com/cdn/{patch}/data/{lang}/champion.json"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if "data" not in data:
        raise RuntimeError("Unexpected champion.json structure (missing 'data').")
    return data["data"]  # mapping: champ_id -> champion info


def load_profiles(path: Path) -> Dict[str, Any]:
    """Load champion_profiles.json, or return a new base structure if missing."""
    if not path.exists():
        return {
            "__meta__": {
                "description": (
                    "Champion profile metadata for the League Analyzer coaching system. "
                    "Entries may be partially filled or skeletons. Extend as needed."
                ),
                "schema_version": "1.0",
                "fields": {
                    "recommended_roles": "List of Riot-style positions where this champ commonly appears",
                    "archetype": "High-level identity (e.g. tempo jungler, control mage, skirmisher, enchanter)",
                    "strengths": "What this champion is supposed to be good at when played well",
                    "core_goals": "Concrete win conditions or checklists for how a good game looks on this champ",
                },
            }
        }

    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_profiles(path: Path, data: Dict[str, Any]) -> None:
    """Write champion_profiles.json nicely formatted."""
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[OK] Wrote updated champion profiles to {path}")


def ensure_champions(
    profiles: Dict[str, Any],
    champ_data: Dict[str, Any],
) -> int:
    """Ensure every champion in champ_data has an entry in profiles.

    Returns:
        Number of *new* champions added as skeleton entries.
    """
    existing = set(profiles.keys())
    added = 0

    for champ_id, info in champ_data.items():
        # champ_id is usually the English name with camelcase (e.g. 'Aatrox', 'Velkoz')
        name_key = champ_id

        if name_key in existing or name_key == "__meta__":
            continue

        # Very lightweight skeleton profile; you can fill these in later.
        profiles[name_key] = {
            "recommended_roles": [],
            "archetype": "TBD",
            "strengths": [],
            "core_goals": [],
        }
        added += 1

    return added


# ----------------------
# Main
# ----------------------

def main(argv: List[str]) -> int:
    # Figure out which patch to use
    if PATCH is None:
        print("[*] Fetching latest patch version from Data Dragon...")
        patch = get_latest_patch()
    else:
        patch = PATCH

    print(f"[*] Using patch: {patch}")

    # Load champion data
    print("[*] Downloading champion list from Data Dragon...")
    champ_data = get_champion_data(patch, LANG)
    print(f"[*] Found {len(champ_data)} champions in Data Dragon for patch {patch}.")

    # Load existing profiles
    print(f"[*] Loading champion profiles from {CHAMPION_PROFILES_PATH}...")
    profiles = load_profiles(CHAMPION_PROFILES_PATH)

    # Ensure all champions have entries
    print("[*] Ensuring all champions have profile entries...")
    added = ensure_champions(profiles, champ_data)

    print(f"[*] Added {added} new champion skeleton(s).")

    # Save back
    save_profiles(CHAMPION_PROFILES_PATH, profiles)

    print("[*] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
