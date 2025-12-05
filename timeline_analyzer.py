"""
timeline_analyzer.py

Timeline-based analysis for League of Legends matches.

We provide two main entry points used by the rest of the project and by
the Streamlit dashboard:

1) classify_loss_reason(match, timeline, puuid)
   - Uses gold graph + objectives + (simple) picks-before-objectives
   - Tags:
        * "early_gap"                  – fell behind early in gold
        * "threw_lead"                 – had a big lead then lost it
        * "objective_gap"              – consistently behind on drakes/barons
        * "got_picked_before_objective"– died near key objective fights
        * "even_or_unclear"            – fallback

   The function only returns a dict for LOSSES. For wins, it returns None.

2) analyze_timeline_movement(match, timeline, puuid)
   - Uses position (x, y) over time and fight events to analyze:
        * Roams (for laners)
        * Jungle early ganks (for junglers)
        * Skirmishes / picks / teamfights
        * Teamfight presence
        * Coarse position samples for dashboard visualizations

   The function returns a dict containing:
        {
            "match_id": str,
            "champion": str,
            "role": str,
            "duration_min": float,
            "roams": {...},
            "jungle_pathing": {...} or None,
            "fight_presence": {...},
            "position_samples": [  # used by the dashboard
                {"time_min": float, "x": int, "y": int, "zone": str, "event": str},
                ...
            ],
        }

This module is intentionally self-contained (only standard library imports)
so that it is robust when used in different contexts (CLI + dashboard).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
from ward_data import WARD_HOTSPOTS


# ---------------------------------------------------------------------------
# Basic helpers
# ---------------------------------------------------------------------------


def _get_self_participant(match: Dict[str, Any], puuid: str) -> Dict[str, Any]:
    info = match.get("info", {})
    for p in info.get("participants", []):
        if p.get("puuid") == puuid:
            return p
    raise ValueError("PUUID not found in match participants")


def _get_team_ids(
    match: Dict[str, Any], puuid: str
) -> Tuple[int, int, int]:
    """Return (my_team_id, enemy_team_id, my_pid)."""
    info = match.get("info", {})
    participants = info.get("participants", [])

    me = _get_self_participant(match, puuid)
    my_team = int(me.get("teamId"))
    my_pid = int(me.get("participantId"))
    enemy_team = 100 if my_team == 200 else 200

    return my_team, enemy_team, my_pid


def _flatten_events(timeline: Dict[str, Any]) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    for frame in timeline.get("info", {}).get("frames", []):
        for e in frame.get("events", []):
            events.append(e)
    events.sort(key=lambda e: e.get("timestamp", 0))
    return events


# ---------------------------------------------------------------------------
# Gold diff / objective helpers
# ---------------------------------------------------------------------------


def _compute_gold_diff_series(
    match: Dict[str, Any], timeline: Dict[str, Any], puuid: str
) -> List[Tuple[float, float]]:
    """Return list of (minute, gold_diff) where gold_diff = my_team - enemy_team."""
    my_team, enemy_team, _ = _get_team_ids(match, puuid)

    frames = timeline.get("info", {}).get("frames", [])
    if not frames:
        return []

    # Map participantId -> teamId
    team_by_pid: Dict[int, int] = {}
    for p in match.get("info", {}).get("participants", []):
        pid = int(p.get("participantId", 0) or 0)
        team_by_pid[pid] = int(p.get("teamId", 0) or 0)

    series: List[Tuple[float, float]] = []

    for frame in frames:
        ts_ms = frame.get("timestamp", 0)
        minute = ts_ms / 60000.0

        pf = frame.get("participantFrames", {})
        my_gold = 0.0
        enemy_gold = 0.0

        for pid_str, pdata in pf.items():
            try:
                pid = int(pid_str)
            except (TypeError, ValueError):
                continue

            team_id = team_by_pid.get(pid)
            if team_id is None:
                continue

            gold = float(pdata.get("totalGold", 0) or 0.0)
            if team_id == my_team:
                my_gold += gold
            elif team_id == enemy_team:
                enemy_gold += gold

        gold_diff = my_gold - enemy_gold
        series.append((minute, gold_diff))

    return series


def _summarize_gold_series(series: List[Tuple[float, float]]) -> Dict[str, float]:
    """Compute early/mid gold stats + max lead/deficit from series."""
    if not series:
        return {
            "max_lead": 0.0,
            "max_deficit": 0.0,
            "early_minute": 10.0,
            "early_min": 0.0,
            "mid_minute": 20.0,
            "mid_max": 0.0,
        }

    times = [t for t, _ in series]
    diffs = [d for _, d in series]

    max_lead = max(diffs)
    max_deficit = min(diffs)

    # Early ~10 min (or last point before)
    early_target = 10.0
    early_minute = series[0][0]
    early_diff = series[0][1]
    for t, d in series:
        if t <= early_target:
            early_minute, early_diff = t, d
        else:
            break

    # Mid ~ half of game duration
    game_len = times[-1]
    mid_target = max(game_len * 0.5, early_minute + 1.0)
    mid_minute = series[-1][0]
    mid_diff = series[-1][1]
    for t, d in series:
        if t <= mid_target:
            mid_minute, mid_diff = t, d
        else:
            break

    return {
        "max_lead": float(max_lead),
        "max_deficit": float(max_deficit),
        "early_minute": float(early_minute),
        "early_min": float(early_diff),
        "mid_minute": float(mid_minute),
        "mid_max": float(mid_diff),
    }


def _collect_elite_monsters(
    match: Dict[str, Any], timeline: Dict[str, Any], puuid: str
) -> Dict[str, Any]:
    """Count dragons and barons taken by each team."""
    my_team, enemy_team, _ = _get_team_ids(match, puuid)
    frames = timeline.get("info", {}).get("frames", [])

    my_dragons = 0
    enemy_dragons = 0
    my_barons = 0
    enemy_barons = 0

    for frame in frames:
        for e in frame.get("events", []):
            if e.get("type") != "ELITE_MONSTER_KILL":
                continue
            killer_team = e.get("killerTeamId")
            mtype = e.get("monsterType", "")
            if mtype == "DRAGON":
                if killer_team == my_team:
                    my_dragons += 1
                elif killer_team == enemy_team:
                    enemy_dragons += 1
            elif mtype == "BARON_NASHOR":
                if killer_team == my_team:
                    my_barons += 1
                elif killer_team == enemy_team:
                    enemy_barons += 1

    return {
        "my_dragons": my_dragons,
        "enemy_dragons": enemy_dragons,
        "dragon_gap": my_dragons - enemy_dragons,
        "my_barons": my_barons,
        "enemy_barons": enemy_barons,
        "baron_gap": my_barons - enemy_barons,
    }


def _detect_picks_before_objectives(
    match: Dict[str, Any], timeline: Dict[str, Any], puuid: str
) -> Dict[str, int]:
    """Very coarse detection of 'got picked before objective' moments.

    We look for CHAMPION_KILL events where:
      - victim is on my team
      - death occurs shortly (~25 seconds) before an enemy dragon/baron take.
    """
    my_team, enemy_team, my_pid = _get_team_ids(match, puuid)
    frames = timeline.get("info", {}).get("frames", [])
    events = _flatten_events(timeline)

    # Collect objective takes
    obj_takes: List[Tuple[int, str, int]] = []  # (timestamp_ms, monsterType, teamId)
    for e in events:
        if e.get("type") == "ELITE_MONSTER_KILL":
            ts = e.get("timestamp", 0)
            mtype = e.get("monsterType", "")
            killer_team = e.get("killerTeamId")
            obj_takes.append((ts, mtype, killer_team))

    window_ms = 25_000
    picked_before_obj = 0
    picked_self_before_obj = 0

    for e in events:
        if e.get("type") != "CHAMPION_KILL":
            continue
        ts = e.get("timestamp", 0)
        victim = e.get("victimId")
        if victim is None:
            continue

        # Only care about deaths on our team
        # Map participantId -> teamId
        team_by_pid = {p["participantId"]: p["teamId"] for p in match["info"]["participants"]}
        v_team = team_by_pid.get(victim)
        if v_team != my_team:
            continue

        # Check if an enemy objective happens soon after
        for obj_ts, _mtype, team_id in obj_takes:
            if team_id != enemy_team:
                continue
            if 0 < obj_ts - ts <= window_ms:
                picked_before_obj += 1
                if victim == my_pid:
                    picked_self_before_obj += 1
                break

    return {
        "picked_before_objective": picked_before_obj,
        "self_picked_before_objective": picked_self_before_obj,
    }


# ---------------------------------------------------------------------------
# 1) Loss classifier
# ---------------------------------------------------------------------------


def classify_loss_reason(
    match: Dict[str, Any], timeline: Dict[str, Any], puuid: str
) -> Optional[Dict[str, Any]]:
    """Return a loss classification dict, or None if this was a win.

    Returned format:

        {
            "primary_reason": str,
            "tags": [str, ...],
            "details": {
                "max_lead": float,
                "max_deficit": float,
                "early_minute": float,
                "early_min": float,
                "mid_minute": float,
                "mid_max": float,
                "my_dragons": int,
                "enemy_dragons": int,
                "dragon_gap": int,
                "my_barons": int,
                "enemy_barons": int,
                "baron_gap": int,
                "picked_before_objective": int,
                "self_picked_before_objective": int,
            },
        }

    This is intentionally coarse and designed to be *interpretable* rather
    than perfect. The AI coach + dashboard combines these signals with other
    stats to tell the player a more complete story.
    """
    info = match.get("info", {})
    player = _get_self_participant(match, puuid)
    did_win = bool(player.get("win", False))
    if did_win:
        return None

    gold_series = _compute_gold_diff_series(match, timeline, puuid)
    gold_stats = _summarize_gold_series(gold_series)
    obj_stats = _collect_elite_monsters(match, timeline, puuid)
    pick_stats = _detect_picks_before_objectives(match, timeline, puuid)

    max_lead = gold_stats["max_lead"]
    early_diff = gold_stats["early_min"]
    mid_diff = gold_stats["mid_max"]
    dragon_gap = obj_stats["dragon_gap"]
    baron_gap = obj_stats["baron_gap"]

    tags: List[str] = []

    # Heuristics
    if max_lead >= 2500 and (mid_diff < 0 or early_diff > mid_diff):
        tags.append("threw_lead")
    if early_diff <= -1500:
        tags.append("early_gap")
    if dragon_gap < 0 or baron_gap < 0:
        tags.append("objective_gap")
    if pick_stats["picked_before_objective"] > 0:
        tags.append("got_picked_before_objective")
    if not tags:
        tags.append("even_or_unclear")

    # Primary reason prioritization
    if "threw_lead" in tags:
        primary_reason = "threw_lead"
    elif "early_gap" in tags:
        primary_reason = "early_gap"
    elif "objective_gap" in tags:
        primary_reason = "objective_gap"
    elif "got_picked_before_objective" in tags:
        primary_reason = "got_picked_before_objective"
    else:
        primary_reason = tags[0]

    details = {}
    details.update(gold_stats)
    details.update(obj_stats)
    details.update(pick_stats)

    return {
        "primary_reason": primary_reason,
        "tags": tags,
        "details": details,
    }


# ---------------------------------------------------------------------------
# 2) Movement / roams / fights / position samples
# ---------------------------------------------------------------------------


@dataclass
class PosSample:
    ts_ms: int
    x: int
    y: int
    zone: str


def _zone_from_xy(x: int, y: int) -> str:
    """Very coarse zone classifier based on map coordinates.

    This is intentionally approximate but good enough for dashboard + coach
    to understand if a player is mostly side-laning, hugging river, etc.
    """
    if x is None or y is None:
        return "unknown"

    # Simple split into broad map regions
    if x < 6000 and y > 10000:
        return "top_quadrant"
    if x > 11000 and y < 6000:
        return "bot_quadrant"
    if 5000 < x < 11000 and 5000 < y < 11000:
        return "mid_jungle"
    if x < 5000 and y < 5000:
        return "blue_base"
    if x > 11000 and y > 11000:
        return "red_base"
    return "other"


def _build_position_series(
    timeline: Dict[str, Any], 
    my_pid: int,
    team_id: int,
    events: List[Dict[str, Any]] = None
) -> List[PosSample]:
    frames = timeline.get("info", {}).get("frames", [])
    series: List[PosSample] = []

    # 1. Frame-based positions (every 60s)
    for frame in frames:
        ts_ms = frame.get("timestamp", 0)
        pf = frame.get("participantFrames", {})
        pf_entry = pf.get(str(my_pid)) or pf.get(my_pid)
        if not pf_entry:
            continue

        pos = pf_entry.get("position") or {}
        x = pos.get("x")
        y = pos.get("y")
        if x is None or y is None:
            continue

        zone = _zone_from_xy(int(x), int(y))
        series.append(PosSample(ts_ms=int(ts_ms), x=int(x), y=int(y), zone=zone))

    # 2. Event-based positions (intermediate waypoints)
    if events:
        for e in events:
            # Item Purchase -> Snap to Fountain
            # This fixes "leaving base late" visuals
            if e.get("type") == "ITEM_PURCHASED" and e.get("participantId") == my_pid:
                ts_ms = e.get("timestamp", 0)
                # Blue Fountain: ~200, 200 | Red Fountain: ~14600, 14600
                # We'll use slightly safer values inside the platform
                fx, fy = (400, 400) if team_id == 100 else (14400, 14400)
                zone = "blue_base" if team_id == 100 else "red_base"
                series.append(PosSample(ts_ms=int(ts_ms), x=fx, y=fy, zone=zone))
                continue

            # Check if this event has position data
            pos = e.get("position")
            if not pos:
                continue
            
            x = pos.get("x")
            y = pos.get("y")
            if x is None or y is None:
                continue
                
            # Check if this event involves the player
            # We want to capture their position at this time
            involved = False
            
            # Creator (Wards)
            if e.get("creatorId") == my_pid:
                involved = True
            # Killer (Kills, Objectives, Wards)
            elif e.get("killerId") == my_pid:
                involved = True
            # Victim (Deaths) - Position is usually where they died
            elif e.get("victimId") == my_pid:
                involved = True
            # Assistant (Kills) - We don't know their exact pos, usually close but risky.
            # Let's skip assists to be safe, or maybe include if we are desperate.
            # For now, stick to direct involvement where pos is likely the player's pos.
            
            if involved:
                ts_ms = e.get("timestamp", 0)
                zone = _zone_from_xy(int(x), int(y))
                series.append(PosSample(ts_ms=int(ts_ms), x=int(x), y=int(y), zone=zone))

    # 3. Sort by timestamp and deduplicate
    series.sort(key=lambda s: s.ts_ms)
    
    # Simple dedupe (keep first if multiple at same ms)
    unique_series = []
    if series:
        unique_series.append(series[0])
        for s in series[1:]:
            if s.ts_ms > unique_series[-1].ts_ms:
                unique_series.append(s)
                
    return unique_series


def _detect_roams(
    role: str,
    pos_series: List[PosSample],
    events: List[Dict[str, Any]],
    my_pid: int,
) -> Dict[str, Any]:
    """Very coarse roam detection.

    For laners (TOP/MIDDLE/BOTTOM), we look for times when the player:
      - leaves their "home" lane region for > ~20 seconds
      - is involved in a kill or assist in another lane during that window

    We return counters like:
        {
            "total_roams": int,
            "successful_roams": int,
        }
    """
    role = (role or "").upper()
    if role not in {"TOP", "MIDDLE", "BOTTOM"}:
        return {"total_roams": 0, "successful_roams": 0}

    if not pos_series:
        return {"total_roams": 0, "successful_roams": 0}

    # Very rough lane zones based on Y coordinate
    def lane_for_y(y: int) -> str:
        if y > 9000:
            return "TOP"
        if y < 6000:
            return "BOTTOM"
        return "MIDDLE"

    # Build a simple time -> y mapping
    home_lane = lane_for_y(pos_series[0].y)
    roam_windows: List[Tuple[int, int]] = []  # (start_ms, end_ms)

    roaming = False
    roam_start: Optional[int] = None
    last_ts = pos_series[0].ts_ms

    for sample in pos_series:
        lane = lane_for_y(sample.y)
        if lane != home_lane:
            if not roaming:
                roaming = True
                roam_start = sample.ts_ms
        else:
            if roaming and roam_start is not None:
                # End roam
                roam_end = last_ts
                if roam_end - roam_start >= 20_000:  # at least ~20 seconds
                    roam_windows.append((roam_start, roam_end))
                roaming = False
                roam_start = None
        last_ts = sample.ts_ms

    # If still roaming at end of game
    if roaming and roam_start is not None:
        roam_end = last_ts
        if roam_end - roam_start >= 20_000:
            roam_windows.append((roam_start, roam_end))

    total_roams = len(roam_windows)
    if total_roams == 0:
        return {"total_roams": 0, "successful_roams": 0}

    # Count roams that resulted in a kill/assist for us while away
    successful_roams = 0
    for start_ms, end_ms in roam_windows:
        for e in events:
            if e.get("type") != "CHAMPION_KILL":
                continue
            ts = e.get("timestamp", 0)
            if not (start_ms <= ts <= end_ms):
                continue
            killer = e.get("killerId")
            assisters = e.get("assistingParticipantIds", []) or []
            if killer == my_pid or my_pid in assisters:
                successful_roams += 1
                break

    return {"total_roams": total_roams, "successful_roams": successful_roams}


def _analyze_jungle_ganks(
    role: str,
    events: List[Dict[str, Any]],
    my_pid: int,
) -> Optional[Dict[str, Any]]:
    """Very coarse jungle early gank tracking."""
    role = (role or "").upper()
    if role != "JUNGLE":
        return None

    # Count early (<10 min) kills/assists by lane of victim
    lane_kills = {"TOP": 0, "MIDDLE": 0, "BOTTOM": 0}
    cutoff_ms = 10 * 60 * 1000

    def lane_for_y(y: int) -> str:
        if y > 9000:
            return "TOP"
        if y < 6000:
            return "BOTTOM"
        return "MIDDLE"

    for e in events:
        if e.get("type") != "CHAMPION_KILL":
            continue
        ts = e.get("timestamp", 0)
        if ts > cutoff_ms:
            continue

        killer = e.get("killerId")
        assisters = e.get("assistingParticipantIds", []) or []
        if killer != my_pid and my_pid not in assisters:
            continue

        pos = e.get("position") or {}
        y = pos.get("y")
        if y is None:
            continue

        lane = lane_for_y(int(y))
        lane_kills[lane] += 1

    return {
        "early_kills_by_lane": lane_kills,
    }


def _cluster_fights(events: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """Cluster CHAMPION_KILL events into fights based on time proximity."""
    kills = [e for e in events if e.get("type") == "CHAMPION_KILL"]
    if not kills:
        return []

    kills.sort(key=lambda e: e.get("timestamp", 0))
    clusters: List[List[Dict[str, Any]]] = []
    window_ms = 10_000  # ~10 seconds

    current: List[Dict[str, Any]] = [kills[0]]
    last_ts = kills[0].get("timestamp", 0)

    for e in kills[1:]:
        ts = e.get("timestamp", 0)
        if ts - last_ts <= window_ms:
            current.append(e)
        else:
            clusters.append(current)
            current = [e]
        last_ts = ts

    clusters.append(current)
    return clusters


def _dist_sq(p1: Tuple[int, int], p2: Tuple[int, int]) -> int:
    dx = p1[0] - p2[0]
    dy = p1[1] - p2[1]
    return dx * dx + dy * dy


def _analyze_fights(
    match: Dict[str, Any],
    events: List[Dict[str, Any]],
    pos_series: List[PosSample],
    my_team: int,
    enemy_team: int,
    my_pid: int,
) -> Dict[str, Any]:
    """
    Analyze fights:
      - classify clusters into picks / skirmishes / teamfights
      - check if player was present (position OR on scoreboard)

    Returns:
        {
            "teamfights": int,
            "teamfights_present": int,
            "teamfights_absent": int,
            "skirmishes": int,
            "skirmishes_present": int,
            "picks": int,
            "picks_present": int,
        }
    """
    participants = match.get("info", {}).get("participants", [])
    team_by_pid = {int(p["participantId"]): int(p["teamId"]) for p in participants}

    fights = _cluster_fights(events)
    if not fights:
        return {
            "teamfights": 0,
            "teamfights_present": 0,
            "teamfights_absent": 0,
            "skirmishes": 0,
            "skirmishes_present": 0,
            "picks": 0,
            "picks_present": 0,
        }

    # Precompute compact positions (timestamp -> (x, y))
    pos_compact: List[Tuple[int, int, int]] = [(p.ts_ms, p.x, p.y) for p in pos_series]

    def get_pos_at(ts: int) -> Optional[Tuple[int, int]]:
        if not pos_compact:
            return None
        last: Optional[Tuple[int, int]] = None
        for t, x, y in pos_compact:
            if t > ts:
                break
            last = (x, y)
        return last

    def avg_position(cluster: List[Dict[str, Any]]) -> Optional[Tuple[int, int]]:
        xs: List[int] = []
        ys: List[int] = []
        for e in cluster:
            pos = e.get("position") or {}
            x = pos.get("x")
            y = pos.get("y")
            if x is not None and y is not None:
                xs.append(int(x))
                ys.append(int(y))
        if not xs:
            return None
        return sum(xs) // len(xs), sum(ys) // len(ys)

    teamfights = 0
    teamfights_present = 0
    skirmishes = 0
    skirmishes_present = 0
    picks = 0
    picks_present = 0

    for cluster in fights:
        # Build participants per team
        team_units = {my_team: set(), enemy_team: set()}
        for e in cluster:
            killer = e.get("killerId")
            victim = e.get("victimId")
            assisters = e.get("assistingParticipantIds", []) or []

            if killer and killer in team_by_pid:
                team_units[team_by_pid[killer]].add(killer)
            if victim and victim in team_by_pid:
                team_units[team_by_pid[victim]].add(victim)
            for a in assisters:
                if a in team_by_pid:
                    team_units[team_by_pid[a]].add(a)

        my_count = len(team_units[my_team])
        enemy_count = len(team_units[enemy_team])
        max_side = max(my_count, enemy_count)

        # Classify fight size
        if max_side >= 4:
            fight_type = "teamfight"
        elif max_side >= 3:
            fight_type = "skirmish"
        else:
            fight_type = "pick"

        # Location/time
        start_ts = cluster[0].get("timestamp", 0)
        center = avg_position(cluster)

        # Check our presence: scoreboard or location proximity
        on_scoreboard = any(
            (e.get("killerId") == my_pid)
            or (my_pid in (e.get("assistingParticipantIds") or []))
            or (e.get("victimId") == my_pid)
            for e in cluster
        )

        present = False
        if on_scoreboard:
            present = True
        elif center is not None:
            my_pos = get_pos_at(start_ts)
            if my_pos is not None and _dist_sq(center, my_pos) <= (3000 ** 2):
                present = True

        if fight_type == "teamfight":
            teamfights += 1
            if present:
                teamfights_present += 1
        elif fight_type == "skirmish":
            skirmishes += 1
            if present:
                skirmishes_present += 1
        else:
            picks += 1
            if present:
                picks_present += 1

    return {
        "teamfights": teamfights,
        "teamfights_present": teamfights_present,
        "teamfights_absent": teamfights - teamfights_present,
        "skirmishes": skirmishes,
        "skirmishes_present": skirmishes_present,
        "picks": picks,
        "picks_present": picks_present,
    }


# ---------------------------------------------------------------------------
# Public: analyze_timeline_movement
# ---------------------------------------------------------------------------


def _extract_skill_order(events: List[Dict[str, Any]], pid: int) -> List[Dict[str, Any]]:
    """Extract skill level up order."""
    skills = []
    for e in events:
        if e.get("type") == "SKILL_LEVEL_UP" and e.get("participantId") == pid:
            skills.append({
                "timestamp": e.get("timestamp", 0),
                "skillSlot": e.get("skillSlot", 0),
                "level_up_type": e.get("levelUpType", "NORMAL")
            })
    return skills


def _extract_item_build(events: List[Dict[str, Any]], pid: int) -> List[Dict[str, Any]]:
    """Extract item purchase history."""
    items = []
    for e in events:
        if e.get("participantId") != pid:
            continue
        
        etype = e.get("type")
        if etype in ("ITEM_PURCHASED", "ITEM_SOLD", "ITEM_UNDO"):
            items.append({
                "timestamp": e.get("timestamp", 0),
                "type": etype,
                "itemId": e.get("itemId", 0),
                "afterId": e.get("afterId", 0), # For undo
                "beforeId": e.get("beforeId", 0) # For undo
            })
    return items


def _extract_all_item_builds(events: List[Dict[str, Any]]) -> Dict[int, List[Dict[str, Any]]]:
    """Extract item purchase history for ALL participants."""
    builds = defaultdict(list)
    for e in events:
        etype = e.get("type")
        if etype in ("ITEM_PURCHASED", "ITEM_SOLD", "ITEM_UNDO", "ITEM_DESTROYED"):
            pid = e.get("participantId")
            if pid:
                builds[pid].append({
                    "timestamp": e.get("timestamp", 0),
                    "type": etype,
                    "itemId": e.get("itemId", 0),
                    "afterId": e.get("afterId", 0),
                    "beforeId": e.get("beforeId", 0)
                })
    return dict(builds)


def _snap_to_hotspot(player_x: int, player_y: int) -> Dict[str, int]:
    """
    Estimate ward position based on player location and known hotspots.
    
    Logic:
    1. Wards are typically placed at max range (~600 units).
    2. Hotspots within ~600-800 units of the player are strong candidates.
    3. If multiple hotspots are in range, pick the one closest to the 'max range ring'.
    4. If no hotspot is found, return the player position (fallback).
    """
    if not WARD_HOTSPOTS:
        return {"x": player_x, "y": player_y}
        
    MAX_WARD_RANGE = 600
    BUFFER = 200 # Allow some leeway for movement/interpolation error
    SEARCH_RADIUS = MAX_WARD_RANGE + BUFFER
    
    best_spot = None
    best_score = float('-inf')
    
    for spot in WARD_HOTSPOTS:
        sx, sy = spot['x'], spot['y']
        dist_sq = (player_x - sx)**2 + (player_y - sy)**2
        dist = dist_sq ** 0.5
        
        # Filter impossible spots
        if dist > SEARCH_RADIUS:
            continue
            
        # Score based on how close it is to max range
        # We assume players want to ward as far as possible (or over walls)
        # Score is higher if dist is closer to MAX_WARD_RANGE
        # Penalty for being too close (dropping ward at feet) or too far (impossible)
        
        # Simple score: 1 / (|dist - MAX_WARD_RANGE| + epsilon)
        # But we also want to favor spots that are "over walls" which often means
        # they are near the max range limit.
        
        score = 1000 - abs(dist - MAX_WARD_RANGE)
        
        if score > best_score:
            best_score = score
            best_spot = spot
            
    if best_spot:
        return {"x": best_spot['x'], "y": best_spot['y']}
        
    return {"x": player_x, "y": player_y}


def _extract_ward_events(events: List[Dict[str, Any]], frames: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Extract ward placement and kill events."""
    ward_events = []
    
    # Build a quick lookup for participant positions by timestamp
    # frames is a list of {timestamp, participantFrames: {1: {position: {x, y}}, ...}}
    # We want to find the frame closest to the event timestamp (<=)
    
    for e in events:
        etype = e.get("type")
        if etype in ("WARD_PLACED", "WARD_KILL"):
            pos = e.get("position")
            
            # Fallback if position is missing for WARD_PLACED
            if etype == "WARD_PLACED" and not pos and frames:
                ts = e.get("timestamp", 0)
                creator_id = e.get("creatorId")
                
                # Find the two frames bounding this timestamp for interpolation
                prev_frame = None
                next_frame = None
                
                for f in frames:
                    fts = f["timestamp"]
                    if fts <= ts:
                        prev_frame = f
                    else:
                        next_frame = f
                        break
                
                # If we have both frames, interpolate
                if prev_frame and next_frame and creator_id:
                    t1 = prev_frame["timestamp"]
                    t2 = next_frame["timestamp"]
                    
                    p1_data = prev_frame.get("participantFrames", {}).get(str(creator_id), {}).get("position")
                    p2_data = next_frame.get("participantFrames", {}).get(str(creator_id), {}).get("position")
                    
                    if p1_data and p2_data and t2 > t1:
                        ratio = (ts - t1) / (t2 - t1)
                        pos = {
                            "x": int(p1_data["x"] + (p2_data["x"] - p1_data["x"]) * ratio),
                            "y": int(p1_data["y"] + (p2_data["y"] - p1_data["y"]) * ratio)
                        }
                
                # Fallback to nearest if interpolation failed (e.g. end of game)
                if not pos and prev_frame and creator_id:
                     p_data = prev_frame.get("participantFrames", {}).get(str(creator_id), {})
                     if "position" in p_data:
                         pos = p_data["position"]

            is_estimated = bool(etype == "WARD_PLACED" and not e.get("position"))
            
            # Snap to nearest hotspot if estimated
            if is_estimated and pos:
                # Pass player position (pos) to snapping logic
                snapped = _snap_to_hotspot(pos['x'], pos['y'])
                pos = snapped

            ward_events.append({
                "timestamp": e.get("timestamp", 0),
                "type": etype,
                "wardType": e.get("wardType", "UNKNOWN"),
                "creatorId": e.get("creatorId", 0),  # For WARD_PLACED
                "killerId": e.get("killerId", 0),    # For WARD_KILL
                "position": pos,
                "isEstimated": is_estimated
            })
    return ward_events


def _extract_kill_events(events: List[Dict[str, Any]], match: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract all champion kills with positions and participant info."""
    kills = []
    
    # Map pid to champion name and team
    pid_map = {}
    for p in match.get("info", {}).get("participants", []):
        pid_map[p["participantId"]] = {
            "championName": p.get("championName"),
            "teamId": p.get("teamId"),
            "riotId": f"{p.get('riotIdGameName', '')}#{p.get('riotIdTagline', '')}"
        }

    for e in events:
        if e.get("type") == "CHAMPION_KILL":
            killer_id = e.get("killerId", 0)
            victim_id = e.get("victimId", 0)
            assisting_ids = e.get("assistingParticipantIds", [])
            
            pos = e.get("position", {})
            
            kills.append({
                "timestamp": e.get("timestamp", 0),
                "killerId": killer_id,
                "victimId": victim_id,
                "assistingParticipantIds": assisting_ids,
                "position": {"x": pos.get("x"), "y": pos.get("y")},
                "killer": pid_map.get(killer_id),
                "victim": pid_map.get(victim_id)
            })
    return kills


def _extract_building_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract building kill events (towers, inhibitors)."""
    building_events = []
    for e in events:
        if e.get("type") == "BUILDING_KILL":
            building_events.append({
                "timestamp": e.get("timestamp", 0),
                "type": "BUILDING_KILL",
                "teamId": e.get("teamId", 0),
                "buildingType": e.get("buildingType"), # TOWER_BUILDING, INHIBITOR_BUILDING
                "laneType": e.get("laneType"),         # TOP_LANE, MID_LANE, BOT_LANE
                "towerType": e.get("towerType"),       # OUTER_TURRET, INNER_TURRET, BASE_TURRET, NEXUS_TURRET
                "position": e.get("position")
            })
    return building_events


def analyze_timeline_movement(
    match: Dict[str, Any], timeline: Dict[str, Any], puuid: str
) -> Dict[str, Any]:
    """
    High-level movement + positioning analysis for a *single game*.

    Returns a dict like:
        {
          "match_id": "...",
          "champion": "...",
          "role": "MIDDLE" | "JUNGLE" | ...,
          "duration_min": float,
          "roams": {...},
          "jungle_pathing": {...} or None,
          "fight_presence": {...},
          "position_samples": [...],
          "skill_order": [...],
          "item_build": [...],
          "kill_events": [...]
        }

    The `position_samples` list is specifically designed for the dashboard
    to draw movement paths and heatmaps.
    """
    info = match.get("info", {})
    meta = match.get("metadata", {})
    my_team, enemy_team, my_pid = _get_team_ids(match, puuid)

    # Basic identity
    participants = info.get("participants", [])
    my_part = None
    for p in participants:
        if int(p.get("participantId", 0) or 0) == my_pid:
            my_part = p
            break
    if my_part is None:
        raise ValueError("Could not find self participant by participantId")

    champ = my_part.get("championName", "Unknown")
    role = my_part.get("teamPosition") or my_part.get("individualPosition") or "UNKNOWN"
    duration_s = info.get("gameDuration", 0)
    duration_min = float(duration_s) / 60.0 if duration_s else 0.0

    # Core series
    events = _flatten_events(timeline)
    pos_series = _build_position_series(timeline, my_pid, my_team, events)

    # Roams (laners)
    roams = _detect_roams(role, pos_series, events, my_pid)

    # Jungle pathing / early ganks
    jungle_pathing = _analyze_jungle_ganks(role, events, my_pid)
    
    # Fight analysis
    fight_presence = _analyze_fights(match, events, pos_series, my_team, enemy_team, my_pid)
    
    # Detailed timeline extractions for dashboard
    skill_order = _extract_skill_order(events, my_pid)
    item_build = _extract_item_build(events, my_pid)
    all_item_builds = _extract_all_item_builds(events)
    kill_events = _extract_kill_events(events, match)
    ward_events = _extract_ward_events(events, timeline.get("info", {}).get("frames", []))
    building_events = _extract_building_events(events)
    
    # Graph data
    gold_xp_series = _extract_gold_xp_series(timeline, my_pid)
    # Re-compute gold diff series for this match context
    gold_diff_series_raw = _compute_gold_diff_series(match, timeline, puuid)
    team_gold_diff = [{"time_min": t, "gold_diff": d} for t, d in gold_diff_series_raw]

    # Sample positions for dashboard (every ~1 min)
    # We already have pos_series which is every frame (~1 min usually).
    # Just convert to dicts.
    # Sample positions for dashboard (every ~1 min)
    # We already have pos_series which is every frame (~1 min usually).
    # Just convert to dicts.
    position_samples = [
        {"time_min": p.ts_ms / 60000.0, "x": p.x, "y": p.y, "zone": p.zone}
        for p in pos_series
    ]
    
    # Extract ALL participant positions for the timeline map
    all_positions = _extract_all_positions(timeline)

    return {
        "match_id": meta.get("matchId", "UNKNOWN"),
        "champion": champ,
        "role": role,
        "duration_min": duration_min,
        "roams": roams,
        "jungle_pathing": jungle_pathing,
        "fight_presence": fight_presence,
        "position_samples": position_samples,
        "all_positions": all_positions, # NEW
        "skill_order": skill_order,
        "item_build": item_build,
        "all_item_builds": all_item_builds,
        "kill_events": kill_events,
        "ward_events": ward_events,
        "building_events": building_events,
        "gold_xp_series": gold_xp_series,
        "team_gold_diff": team_gold_diff
    }

def _extract_all_positions(timeline: Dict[str, Any]) -> Dict[int, List[Dict[str, Any]]]:
    """
    Extract position history for ALL participants.
    Returns: { participantId: [ {time_min, x, y}, ... ] }
    """
    frames = timeline.get("info", {}).get("frames", [])
    all_pos = defaultdict(list)
    
    for f in frames:
        ts = f.get("timestamp", 0)
        time_min = ts / 60000.0
        p_frames = f.get("participantFrames", {})
        
        for pid_str, data in p_frames.items():
            # pid_str is "1", "2", etc.
            try:
                pid = int(pid_str)
                pos = data.get("position")
                if pos:
                    all_pos[pid].append({
                        "t": time_min,
                        "x": pos["x"],
                        "y": pos["y"]
                    })
            except ValueError:
                continue
                
    return dict(all_pos)


def _extract_gold_xp_series(timeline: Dict[str, Any], pid: int) -> List[Dict[str, Any]]:
    """Extract minute-by-minute gold and XP for the player."""
    frames = timeline.get("info", {}).get("frames", [])
    series = []
    
    for frame in frames:
        ts_ms = frame.get("timestamp", 0)
        pf = frame.get("participantFrames", {})
        p_data = pf.get(str(pid)) or pf.get(pid)
        
        if not p_data:
            continue
            
        series.append({
            "time_min": ts_ms / 60000.0,
            "total_gold": p_data.get("totalGold", 0),
            "xp": p_data.get("xp", 0),
            "level": p_data.get("level", 1),
            "minions_killed": p_data.get("minionsKilled", 0) + p_data.get("jungleMinionsKilled", 0)
        })
        
    return series
