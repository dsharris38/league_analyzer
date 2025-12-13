#!/usr/bin/env python3
"""Coaching data enrichment utilities.

This module takes the raw match data and existing analysis, and adds
extra structure that the AI coaching crew can use:

- macro_profile: high-level macro / objective patterns
- per_game_comp: game-by-game team & enemy composition (champ lists)
- per_game_items: your final item builds per game (with best-effort names)

The idea is:
- All HTTP / API calls (e.g., Data Dragon) happen here in Python.
- The LLM receives a richer JSON payload, but does not call APIs itself.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional

import requests



import os
import time
import json
from pathlib import Path

# ... imports ...

MERAKI_ITEMS_URL = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/items.json"
CACHE_DIR = Path(__file__).parent / "saves" / "cache"

def _get_cached_meraki_items() -> Dict[str, Any]:
    """Fetch Meraki items with local file caching (24h validity)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / "meraki_items.json"
    
    # Check cache validity
    if cache_path.exists():
        mtime = cache_path.stat().st_mtime
        if time.time() - mtime < 86400: # 24 hours
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass # Corrupt cache, refetch
    
    # Fetch fresh
    try:
        resp = requests.get(MERAKI_ITEMS_URL, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        # Save to cache
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception:
            pass
            
        return data
    except Exception:
        return {} # Fallback

def _safe_get_item_names(version: Optional[str] = None) -> Dict[int, str]:
    """Best-effort: fetch item ID -> item name mapping from Meraki Analytics (Cached)."""
    data = _get_cached_meraki_items()
    
    mapping: Dict[int, str] = {}
    for item_id_str, info in data.items():
        try:
            item_id = int(item_id_str)
        except ValueError:
            continue
        name = info.get("name") or item_id_str
        mapping[item_id] = name
    return mapping


def _extract_self_participant(match: Dict[str, Any], puuid: str) -> Dict[str, Any]:
    """Return the participant dict for this player in a full match payload."""
    info = match.get("info", {})
    for p in info.get("participants", []):
        if p.get("puuid") == puuid:
            return p
    raise ValueError("PUUID not found in match participants")


def build_macro_profile(
    analysis: Dict[str, Any],
    timeline_loss_diagnostics: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Aggregate high-level macro patterns from loss diagnostics and analysis.

    This does NOT try to perfectly reconstruct all objective timings; instead it
    summarizes patterns in terms of:
      - how often certain loss tags occur (threw_lead, early_gap, etc.)
      - average gold leads/deficits
      - average dragon/baron gaps

    The AI coach will interpret these numbers, so we keep it simple & robust.
    """
    tags_counter = Counter()
    total = len(timeline_loss_diagnostics)
    if total == 0:
        return {
            "games_with_timeline_data": 0,
            "tag_rates": {},
            "avg_max_lead": 0.0,
            "avg_max_deficit": 0.0,
            "avg_dragon_gap": 0.0,
            "avg_baron_gap": 0.0,
        }

    sum_lead = 0.0
    sum_deficit = 0.0
    sum_dragon_gap = 0.0
    sum_baron_gap = 0.0

    for entry in timeline_loss_diagnostics:
        tags = entry.get("tags", [])
        for t in tags:
            tags_counter[t] += 1

        details = entry.get("details", {})
        sum_lead += float(details.get("max_lead", 0.0) or 0.0)
        sum_deficit += float(details.get("max_deficit", 0.0) or 0.0)
        sum_dragon_gap += float(details.get("dragon_gap", 0.0) or 0.0)
        sum_baron_gap += float(details.get("baron_gap", 0.0) or 0.0)

    tag_rates = {
        tag: count / total
        for tag, count in tags_counter.items()
    }

    macro_profile = {
        "games_with_timeline_data": total,
        "tag_counts": dict(tags_counter),
        "tag_rates": tag_rates,
        "avg_max_lead": sum_lead / total if total else 0.0,
        "avg_max_deficit": sum_deficit / total if total else 0.0,
        "avg_dragon_gap": sum_dragon_gap / total if total else 0.0,
        "avg_baron_gap": sum_baron_gap / total if total else 0.0,
    }

    # Optional machine-readable hints
    macro_profile["likely_themes"] = []
    if tag_rates.get("threw_lead", 0) > 0.3:
        macro_profile["likely_themes"].append("frequent_throws_from_ahead")
    if tag_rates.get("early_gap", 0) > 0.3:
        macro_profile["likely_themes"].append("frequent_early_game_deficits")
    if tag_rates.get("objective_gap", 0) > 0.3:
        macro_profile["likely_themes"].append("objective_control_issues")
    if tag_rates.get("got_picked_before_objective", 0) > 0.3:
        macro_profile["likely_themes"].append("picks_before_objectives")

    return macro_profile


def build_detailed_match_info(
    matches: List[Dict[str, Any]],
    match_ids: List[str],
    puuid: str,
) -> List[Dict[str, Any]]:
    """Build a detailed per-game summary for the dashboard.
    
    Includes full stats for all 10 players to support OP.GG-style scoreboards.
    """
    detailed_matches = []

    for match, mid in zip(matches, match_ids):
        info = match.get("info", {})
        participants = info.get("participants", [])
        if not participants:
            continue

        game_creation = info.get("gameCreation", 0)
        game_duration = info.get("gameDuration", 0)
        game_mode = info.get("gameMode", "UNKNOWN")
        queue_id = info.get("queueId", 0) # Added queueId
        
        # Process all participants
        processed_participants = []
        for p in participants:
            # Basic Identity
            p_puuid = p.get("puuid", "")
            riot_id_name = p.get("riotIdGameName", "")
            riot_id_tag = p.get("riotIdTagline", "")
            riot_id = f"{riot_id_name}#{riot_id_tag}" if riot_id_name else p.get("summonerName", "Unknown")
            
            # Stats
            kills = p.get("kills", 0)
            deaths = p.get("deaths", 0)
            assists = p.get("assists", 0)
            kda = (kills + assists) / max(1, deaths)
            
            cs = p.get("totalMinionsKilled", 0) + p.get("neutralMinionsKilled", 0)
            cs_per_min = cs / (game_duration / 60) if game_duration > 0 else 0
            
            # Runes (Perks)
            perks = p.get("perks", {})
            styles = perks.get("styles", [])
            primary_style = styles[0].get("style") if len(styles) > 0 else None
            sub_style = styles[1].get("style") if len(styles) > 1 else None
            # Extract keystone (first selection of first style)
            keystone = None
            if len(styles) > 0 and styles[0].get("selections"):
                keystone = styles[0]["selections"][0].get("perk")

            processed_p = {
                "puuid": p_puuid,
                "riot_id": riot_id,
                "champion_name": p.get("championName", "Unknown"),
                "champion_id": p.get("championId", 0),
                "participant_id": p.get("participantId", 0),
                "team_id": p.get("teamId", 100),
                "position": p.get("teamPosition") or p.get("individualPosition") or "UNKNOWN",
                "win": p.get("win", False),
                "champ_level": p.get("champLevel", 1),
                
                # KDA & Combat
                "kills": kills,
                "deaths": deaths,
                "assists": assists,
                "kda": round(kda, 2),
                "total_damage_dealt_to_champions": p.get("totalDamageDealtToChampions", 0),
                "total_damage_taken": p.get("totalDamageTaken", 0),
                
                # Farming & Economy
                "total_minions_killed": p.get("totalMinionsKilled", 0),
                "neutral_minions_killed": p.get("neutralMinionsKilled", 0),
                "cs": cs,
                "cs_per_min": round(cs_per_min, 1),
                "gold_earned": p.get("goldEarned", 0),
                
                # Vision
                "vision_score": p.get("visionScore", 0),
                "wards_placed": p.get("wardsPlaced", 0),
                "wards_killed": p.get("wardsKilled", 0),
                "detector_wards_placed": p.get("detectorWardsPlaced", 0),
                
                # Loadout
                "item0": p.get("item0", 0),
                "item1": p.get("item1", 0),
                "item2": p.get("item2", 0),
                "item3": p.get("item3", 0),
                "item4": p.get("item4", 0),
                "item5": p.get("item5", 0),
                "item6": p.get("item6", 0),
                "summoner1Id": p.get("summoner1Id", 0),
                "summoner2Id": p.get("summoner2Id", 0),
                "perks": {
                    "primary_style": primary_style,
                    "sub_style": sub_style,
                    "keystone": keystone,
                    "primary_style": primary_style,
                    "sub_style": sub_style,
                    "keystone": keystone,
                    "styles": styles, # Keep full styles for detailed view
                    "statPerks": perks.get("statPerks", {})
                },
                
                # Flags
                "is_self": (p_puuid == puuid)
            }
            processed_participants.append(processed_p)

        detailed_matches.append({
            "match_id": mid,
            "game_creation": game_creation,
            "game_duration": game_duration,
            "game_mode": game_mode,
            "queue_id": queue_id, # Added field
            "participants": processed_participants
        })

    return detailed_matches


def build_per_game_comp(
    matches: List[Dict[str, Any]],
    match_ids: List[str],
    puuid: str,
) -> List[Dict[str, Any]]:
    """Build a simple per-game composition summary.
    
    (Kept for backward compatibility and simple AI prompts)
    """
    per_game_comp: List[Dict[str, Any]] = []

    for match, mid in zip(matches, match_ids):
        info = match.get("info", {})
        participants = info.get("participants", [])
        if not participants:
            continue

        # Find which team is "you"
        self_participant = None
        for p in participants:
            if p.get("puuid") == puuid:
                self_participant = p
                break
        if self_participant is None:
            continue

        my_team_id = self_participant.get("teamId")
        my_champ = self_participant.get("championName")
        my_role = (
            self_participant.get("teamPosition")
            or self_participant.get("individualPosition")
            or "UNKNOWN"
        )

        ally_champs = []
        enemy_champs = []
        for p in participants:
            champ_name = p.get("championName")
            if not champ_name:
                continue
            if p.get("teamId") == my_team_id:
                ally_champs.append(champ_name)
            else:
                enemy_champs.append(champ_name)

        per_game_comp.append(
            {
                "match_id": mid,
                "your_champion": my_champ,
                "your_role": my_role,
                "ally_champions": ally_champs,
                "enemy_champions": enemy_champs,
            }
        )

    return per_game_comp


def build_per_game_items(
    matches: List[Dict[str, Any]],
    match_ids: List[str],
    puuid: str,
) -> Dict[str, Any]:
    """Build per-game final item sets and a lightweight itemization profile.

    Uses Data Dragon (if available) to map item IDs to names for easier LLM use.
    If Data Dragon calls fail, we still provide the integer IDs.

    Returns a dict with:
      - per_game_items: list of per-game item data
      - itemization_profile: coarse summary stats (e.g. games_without_boots)
    """
    # Best-effort fetch of item names
    version = _safe_get_latest_dd_version()
    item_name_map = _safe_get_item_names(version)

    per_game_items: List[Dict[str, Any]] = []
    games_without_boots = 0
    games_with_6_items = 0

    # Simple list of common boots IDs; if DDragon fails this still catches most cases
    common_boot_ids = {
        1001, 3111, 3117, 3006, 3009, 3020, 3047, 3158,
        2422, 2423, 2424, 3159
    }

    for match, mid in zip(matches, match_ids):
        try:
            p = _extract_self_participant(match, puuid)
        except Exception:
            continue

        champ = p.get("championName")
        items = [
            p.get("item0", 0),
            p.get("item1", 0),
            p.get("item2", 0),
            p.get("item3", 0),
            p.get("item4", 0),
            p.get("item5", 0),
            p.get("item6", 0),
        ]
        item_ids = [int(i) for i in items if isinstance(i, int) and i > 0]
        item_names = [item_name_map.get(i, str(i)) for i in item_ids]

        has_boots = any(i in common_boot_ids for i in item_ids)
        if not has_boots:
            games_without_boots += 1
        if len(item_ids) >= 6:
            games_with_6_items += 1

        per_game_items.append(
            {
                "match_id": mid,
                "champion": champ,
                "item_ids": item_ids,
                "item_names": item_names,
                "has_boots": has_boots,
            }
        )

    total = len(per_game_items)
    itemization_profile = {
        "games_with_item_data": total,
        "games_without_boots": games_without_boots,
        "games_without_boots_rate": games_without_boots / total if total else 0.0,
        "games_with_6_or_more_items": games_with_6_items,
        "games_with_6_or_more_items_rate": games_with_6_items / total if total else 0.0,
    }

    return {
        "per_game_items": per_game_items,
        "itemization_profile": itemization_profile,
    }


def enrich_coaching_data(
    matches: List[Dict[str, Any]],
    match_ids: List[str],
    puuid: str,
    analysis: Dict[str, Any],
    timeline_loss_diagnostics: List[Dict[str, Any]],
    movement_summaries: List[Dict[str, Any]],  # currently unused but reserved for future
) -> Dict[str, Any]:
    """Enrich the core analysis dict with extra coaching-friendly structures.

    - Adds macro_profile (from timeline_loss_diagnostics)
    - Adds per_game_comp (from matches)
    - Adds per_game_items + itemization_profile (from matches + Data Dragon)

    Returns a *new* analysis dict (shallow copy) with extra keys.
    """
    new_analysis = dict(analysis)

    macro_profile = build_macro_profile(analysis, timeline_loss_diagnostics)
    per_game_comp = build_per_game_comp(matches, match_ids, puuid)
    items_data = build_per_game_items(matches, match_ids, puuid)
    detailed_matches = build_detailed_match_info(matches, match_ids, puuid)

    # Merge timeline data into detailed_matches
    # movement_summaries contains the output of analyze_timeline_movement
    timeline_map = {m["match_id"]: m for m in movement_summaries}
    
    for dm in detailed_matches:
        mid = dm["match_id"]
        if mid in timeline_map:
            t_data = timeline_map[mid]
            dm["skill_order"] = t_data.get("skill_order", [])
            dm["item_build"] = t_data.get("item_build", [])
            
            # Use all_item_builds if available, falling back to per-pid lookup
            all_builds = t_data.get("all_item_builds", {})
            
            for p in dm["participants"]:
                pid = p.get("participant_id")
                if pid and pid in all_builds:
                    p["item_build"] = all_builds[pid]
                else:
                    p["item_build"] = []

            dm["kill_events"] = t_data.get("kill_events", [])
            dm["ward_events"] = t_data.get("ward_events", [])
            dm["building_events"] = t_data.get("building_events", [])
            dm["position_samples"] = t_data.get("position_samples", [])
            dm["all_positions"] = t_data.get("all_positions", {}) # NEW
            dm["roams"] = t_data.get("roams", {})
            dm["jungle_pathing"] = t_data.get("jungle_pathing", {})
            dm["fight_presence"] = t_data.get("fight_presence", {})

    new_analysis["macro_profile"] = macro_profile
    new_analysis["per_game_comp"] = per_game_comp
    new_analysis["per_game_items"] = items_data.get("per_game_items", [])
    new_analysis["itemization_profile"] = items_data.get("itemization_profile", {})
    new_analysis["detailed_matches"] = detailed_matches

    return new_analysis
