from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Set


def load_champion_profiles(path: str | Path | None = None) -> Dict[str, Any]:
    """Load champion_profiles.json from disk.

    If the file is missing or invalid, return an empty dict so the rest
    of the pipeline can still run.
    """
    if path is None:
        path = Path(__file__).with_name("champion_profiles.json")
    else:
        path = Path(path)

    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception:
        # If the JSON is malformed, fail soft
        return {}


def _collect_played_champions(analysis: Dict[str, Any]) -> Set[str]:
    champs: Set[str] = set()
    for pc in analysis.get("per_champion", []):
        name = pc.get("champion")
        if name:
            champs.add(str(name))

    for g in analysis.get("per_game_loss_details", []):
        name = g.get("champion")
        if name:
            champs.add(str(name))

    return champs


def attach_champion_profiles(
    agent_payload: Dict[str, Any],
    analysis: Dict[str, Any],
    all_profiles: Dict[str, Any],
) -> Dict[str, Any]:
    """Attach a filtered champion_profiles dict to the agent payload.

    Only champions that the player actually used in this dataset are
    included. This keeps the JSON smaller and makes the coach focus on
    relevant picks.
    """
    if not all_profiles:
        return agent_payload

    played = _collect_played_champions(analysis)
    if not played:
        return agent_payload

    selected: Dict[str, Any] = {}
    for champ_name in played:
        if champ_name in all_profiles:
            selected[champ_name] = all_profiles[champ_name]

    # Optionally keep a small meta section (e.g., version info) if present
    meta_keys = ["__meta__", "_meta", "meta"]
    for mk in meta_keys:
        if mk in all_profiles and mk not in selected:
            selected[mk] = all_profiles[mk]
            break

    new_payload = dict(agent_payload)
    new_payload["champion_profiles"] = selected
    return new_payload
