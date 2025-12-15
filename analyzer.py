# analyzer.py
from typing import List, Dict, Any
from statistics import mean
from collections import defaultdict, Counter

# --- Helper functions --------------------------------------------------------


def extract_self_participant(match: Dict[str, Any], puuid: str) -> Dict[str, Any]:
    info = match["info"]
    for p in info["participants"]:
        if p["puuid"] == puuid:
            return p
    raise ValueError("PUUID not found in match participants")


def _safe_mean(values):
    vals = [v for v in values if v is not None]
    return mean(vals) if vals else 0.0


# --- Role-aware baselines & labels ------------------------------------------
# Riot teamPosition values are typically: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY

ROLE_BASELINES = {
    "MIDDLE": {
        "avg_cs_per_min": 7.5,
        "avg_damage_share": 0.25,
        "avg_kda": 3.0,
        "avg_kp": 0.65,
    },
    "TOP": {
        "avg_cs_per_min": 7.5,
        "avg_damage_share": 0.23,
        "avg_kda": 3.0,
        "avg_kp": 0.55,
    },
    "JUNGLE": {
        "avg_cs_per_min": 6.5,
        "avg_damage_share": 0.20,
        "avg_kda": 3.0,
        "avg_kp": 0.70,
    },
    "BOTTOM": {
        "avg_cs_per_min": 8.0,
        "avg_damage_share": 0.27,
        "avg_kda": 3.0,
        "avg_kp": 0.65,
    },
    "UTILITY": {
        "avg_cs_per_min": 1.5,
        "avg_damage_share": 0.15,
        "avg_kda": 3.0,
        "avg_kp": 0.70,
    },
}

ROLE_CS_LOW_THRESH = {
    "MIDDLE": 6.0,
    "TOP": 6.0,
    "JUNGLE": 5.0,
    "BOTTOM": 6.5,
    "UTILITY": 1.0,
    "DEFAULT": 5.5,
}

ROLE_LABEL_SINGULAR = {
    "MIDDLE": "mid laner",
    "TOP": "top laner",
    "JUNGLE": "jungler",
    "BOTTOM": "AD carry",
    "UTILITY": "support",
}

ROLE_LABEL_PLURAL = {
    "MIDDLE": "mid laners",
    "TOP": "top laners",
    "JUNGLE": "junglers",
    "BOTTOM": "bot laners",
    "UTILITY": "supports",
}


def _role_label_singular(role: str) -> str:
    return ROLE_LABEL_SINGULAR.get(role, "laner")


def _role_label_plural(role: str) -> str:
    return ROLE_LABEL_PLURAL.get(role, "players")


def _role_cs_threshold(role: str) -> float:
    return ROLE_CS_LOW_THRESH.get(role, ROLE_CS_LOW_THRESH["DEFAULT"])


def _detect_role(self_participant: Dict[str, Any]) -> str:
    """
    Detect role using heuristics to fix Riot API misclassifications (e.g. Karma Jungle).
    Priority:
    1. Smite -> JUNGLE
    2. Support Item in inventory -> UTILITY
    3. Specified teamPosition -> As-is
    4. Fallback -> MIDDLE
    """
    # 1. Check for Smite (Summoner 11)
    # Note: Placeholder for Ultimate Spellbook (54) or others could be added if needed
    summoners = [self_participant.get("summoner1Id"), self_participant.get("summoner2Id")]
    if 11 in summoners:
        return "JUNGLE"

    # 2. Check for Support Items (World Atlas tree)
    # 3862: World Atlas, 3863: Runic Compass, 3864: Bounty of Worlds, etc.
    # We check for the starter item mainly.
    support_items = {3862, 3863, 3864, 3850, 3851, 3853} # Expanded list just in case
    items = [self_participant.get(f"item{i}", 0) for i in range(7)]
    if any(item_id in support_items for item_id in items):
        return "UTILITY"

    # 3. Riot API Team Position
    pos = self_participant.get("teamPosition")
    if pos and pos != "Invalid":
        return pos

    # 4. Fallback
    return self_participant.get("individualPosition") or "MIDDLE"


# --- OP.GG Style Analytics ---------------------------------------------------

def analyze_teammates(matches: List[Dict[str, Any]], self_puuid: str, season_prefix: str = None) -> List[Dict[str, Any]]:
    """Identify frequent teammates (duos) and their performance, optionally filtered by season."""
    teammate_stats = defaultdict(lambda: {"games": 0, "wins": 0, "name": "", "tag": ""})
    
    for match in matches:
        info = match["info"]
        
        # Season Filter
        if season_prefix:
            game_version = info.get("gameVersion", "")
            if not game_version.startswith(season_prefix):
                continue

        self_p = extract_self_participant(match, self_puuid)
        my_team = self_p["teamId"]
        win = self_p["win"]
        
        for p in info["participants"]:
            if p["teamId"] == my_team and p["puuid"] != self_puuid:
                # Key by PUUID for uniqueness
                ts = teammate_stats[p["puuid"]]
                ts["games"] += 1
                if win:
                    ts["wins"] += 1
                ts["name"] = p.get("riotIdGameName", p["summonerName"])
                ts["tag"] = p.get("riotIdTagLine", "")
                ts["icon"] = p.get("profileIcon", 0)

    # Convert to list and sort by games played
    results = []
    for puuid, stats in teammate_stats.items():
        if stats["games"] > 1: # Only show repeat teammates
            results.append({
                "puuid": puuid,
                "name": stats["name"],
                "tag": stats["tag"],
                "games": stats["games"],
                "wins": stats["wins"],
                "winrate": round(stats["wins"] / stats["games"], 2),
                "icon": stats.get("icon", 0)
            })
            
    return sorted(results, key=lambda x: x["games"], reverse=True)[:5]



def analyze_recent_performance(matches: List[Dict[str, Any]], self_puuid: str, days: int = 7) -> List[Dict[str, Any]]:
    """Calculate winrate per champion over the last N days."""
    import time
    cutoff_ms = (time.time() - (days * 24 * 3600)) * 1000
    
    recent_stats = defaultdict(lambda: {"wins": 0, "losses": 0, "games": 0})
    
    for match in matches:
        info = match["info"]
        end_time = info.get("gameEndTimestamp")
        if not end_time or end_time < cutoff_ms:
            continue
            
        self_p = extract_self_participant(match, self_puuid)
        champ = self_p["championName"]
        win = self_p["win"]
        
        recent_stats[champ]["games"] += 1
        if win:
            recent_stats[champ]["wins"] += 1
        else:
            recent_stats[champ]["losses"] += 1
            
    results = []
    for champ, stats in recent_stats.items():
        results.append({
            "champion": champ,
            "games": stats["games"],
            "wins": stats["wins"],
            "losses": stats["losses"],
            "winrate": round(stats["wins"] / stats["games"], 2)
        })
        
    return sorted(results, key=lambda x: x["games"], reverse=True)


# --- Core analysis -----------------------------------------------------------



def analyze_matches(
    matches: List[Dict[str, Any]],
    puuid: str,
) -> Dict[str, Any]:
    """
    Main entrypoint: analyze a set of matches for a given player.

    Returns a dictionary with:
      - summary: overall stats
      - per_champion: list of per-champion stats (for champs with 3+ games)
      - loss_patterns: aggregated "why you lost" reasons
      - baseline_comparison: how you compare to Diamond/Master baselines (role-aware)
      - you_vs_team: high-level 'is it you or your team' verdict
      - per_game_loss_details: per-loss tags and diagnostics
      - primary_role: most common role across analyzed games (e.g. 'MIDDLE', 'JUNGLE')
    """
    # --- Helper to extract season (major version) ----------------------------
    def _get_season_from_version(game_version: str) -> str:
        if not game_version:
            return "0"
        return game_version.split(".")[0]

    # --- Core analysis -----------------------------------------------------------

    match_count = len(matches)
    use_weighted = match_count > 50
    current_season_prefix = "15" # Default fallback
    
    # Detect most recent season from the latest game
    if matches:
        latest_ver = matches[0]["info"].get("gameVersion", "15.1")
        current_season_prefix = _get_season_from_version(latest_ver)

    kdas_weighted = []
    dmg_shares_weighted = []
    gold_shares_weighted = []
    cs_per_min_weighted = []
    kp_weighted = []
    vis_score_weighted = []
    dpm_weighted = []
    
    total_weight = 0.0

    wins = 0
    losses = 0

    # per-champion accumulator
    champ_data = defaultdict(
        lambda: {
            "games": 0,
            "wins": 0,
            "total_kda": 0.0,
            "total_cs_per_min": 0.0,
            "total_dmg_share": 0.0,
            "total_kp": 0.0,
        }
    )

    # loss pattern accumulator (non-timeline based)
    loss_reason_counter = Counter()
    per_game_loss_details = []

    # "is it me or my team" scoring across games
    you_vs_team_scores_all = []
    you_vs_team_scores_losses = []

    # Track your role across games for role-aware benchmarks
    role_counter = Counter()
    patch_counter = Counter()

    for match in matches:
        info = match["info"]
        game_version = info.get("gameVersion", "")
        patch = ".".join(game_version.split(".")[:2]) if game_version else "unknown"
        season = _get_season_from_version(game_version)
        
        # Weighting Logic
        # If use_weighted is True (batch > 50), current season games get weight 2.0, others 1.0
        # Exception: For Champion pool, we might want STRICT filtering? 
        # User said: "For champion specific analysis please limit it to just the top champions played this season specifically."
        # So for champ_data, we ONLY process if season == current_season (if use_weighted is on).
        
        weight = 1.0
        is_current_season = (season == current_season_prefix)
        
        if use_weighted:
            if is_current_season:
                weight = 2.0
            else:
                weight = 1.0
        
        patch_counter[patch] += 1
        duration = info.get("gameDuration", 0)  # seconds
        duration_minutes = max(duration / 60, 1)

        self_p = extract_self_participant(match, puuid)
        
        # ... (rest of extraction logic remains similar, but we apply weights to lists)
        
        team_id = self_p.get("teamId")
        game_role = _detect_role(self_p)
        role_counter[game_role] += 1

        team_participants = [p for p in info["participants"] if p["teamId"] == team_id]
        enemy_participants = [p for p in info["participants"] if p["teamId"] != team_id]

        # Basic stats
        kills = self_p.get("kills", 0)
        deaths = self_p.get("deaths", 0)
        assists = self_p.get("assists", 0)
        cs = self_p.get("totalMinionsKilled", 0) + self_p.get("neutralMinionsKilled", 0)
        damage = self_p.get("totalDamageDealtToChampions", 0)
        gold = self_p.get("goldEarned", 0)
        champ_name = self_p.get("championName", "Unknown")

        # Team aggregates
        team_kills = sum(p.get("kills", 0) for p in team_participants)
        enemy_kills = sum(p.get("kills", 0) for p in enemy_participants)
        team_damage = sum(p.get("totalDamageDealtToChampions", 0) for p in team_participants)
        team_gold = sum(p.get("goldEarned", 0) for p in team_participants)

        team_cs_per_min = []
        for p in team_participants:
            p_cs = p.get("totalMinionsKilled", 0) + p.get("neutralMinionsKilled", 0)
            team_cs_per_min.append(p_cs / duration_minutes)

        # Metrics
        kda = (kills + assists) / max(deaths, 1) if deaths > 0 else (kills + assists)
        cs_per_min = cs / duration_minutes
        dmg_share = damage / team_damage if team_damage > 0 else 0.0
        gold_share = gold / team_gold if team_gold > 0 else 0.0
        kp = (kills + assists) / team_kills if team_kills > 0 else 0.0

        # Win/Loss
        win = bool(self_p.get("win", False))
        if win:
            wins += 1
        else:
            losses += 1

        # Global Accumulation (Weighted)
        kdas_weighted.append(kda * weight)
        dmg_shares_weighted.append(dmg_share * weight)
        gold_shares_weighted.append(gold_share * weight)
        cs_per_min_weighted.append(cs_per_min * weight)
        kp_weighted.append(kp * weight)
        
        vis_score = self_p.get("visionScore", 0)
        dpm = damage / duration_minutes if duration_minutes > 0 else 0
        vis_score_weighted.append(vis_score * weight)
        dpm_weighted.append(dpm * weight)

        total_weight += weight

        # Champion Accumulation
        # Rule: "limit it to just the top champions played this season specifically" (if large batch)
        should_process_champ = True
        if use_weighted and not is_current_season:
            should_process_champ = False
            
        if should_process_champ:
            cd = champ_data[champ_name]
            cd["games"] += 1
            if win:
                cd["wins"] += 1
            cd["total_kda"] += kda
            cd["total_cs_per_min"] += cs_per_min
            cd["total_dmg_share"] += dmg_share
            cd["total_kp"] += kp

        # Your vs Team (Keep unweighted for now, or implicit via filtered lists if we wanted)
        # We'll just run standard logic here as it's per-game
        
        # ... (You vs Team Logic - simplified for replacement) ...
        # Ranks
        team_damages = [p.get("totalDamageDealtToChampions", 0) for p in team_participants]
        team_golds = [p.get("goldEarned", 0) for p in team_participants]
        
        # Rank Helper
        def rank_desc(values, your_value):
            sorted_vals = sorted(values, reverse=True)
            try: return sorted_vals.index(your_value) + 1
            except: return len(sorted_vals)

        your_damage_rank = rank_desc(team_damages, damage)
        your_gold_rank = rank_desc(team_golds, gold)
        your_cs_rank = rank_desc(team_cs_per_min, cs_per_min)

        # Team KP
        if team_kills > 0:
            team_kps = [(p.get("kills",0)+p.get("assists",0))/team_kills for p in team_participants]
            team_avg_kp = mean(team_kps) if team_kps else 0.0
        else:
            team_avg_kp = 0.0

        score = 0.0
        if your_damage_rank == 1: score += 1.0
        elif your_damage_rank >= 4: score -= 1.0
        if your_gold_rank == 1: score += 0.5
        elif your_gold_rank >= 4: score -= 0.5
        if your_cs_rank == 1: score += 0.5
        elif your_cs_rank >= 4: score -= 0.5
        if kp >= team_avg_kp + 0.10: score += 0.5
        elif kp <= team_avg_kp - 0.10: score -= 0.5
        if deaths <= 4: score += 0.5
        elif deaths >= 8: score -= 0.5

        you_vs_team_scores_all.append(score)
        if not win:
            you_vs_team_scores_losses.append(score)

        # Loss Patterns (Non-Timeline)
        if not win:
            # We enforce Season Check for "Loss Analysis"? User didn't specify, 
            # but usually "gameplay analysis" implies recent. 
            # We'll keep all losses for now to give more data points, 
            # unless it contradicts "gameplay analysis" rule.
            # "use the last 250 games with even weight for gameplay analysis" -> actually 
            # user said "if not [>50], even weight". If >50, "increased weight".
            # The prompt says "Identity" gets weight. Loss reasons are part of Identity? likely.
            # For simplicity, we count ALL losses but maybe we should weight them? 
            # Counter doesn't support float weights easily. We'll stick to count.

            team_obj = next((t.get("objectives", {}) for t in info.get("teams", []) if t.get("teamId") == team_id), {})
            enemy_obj = next((t.get("objectives", {}) for t in info.get("teams", []) if t.get("teamId") != team_id), {})
            
            def _obj_kills(o, k): return o.get(k, {}).get("kills", 0) if o else 0

            reasons = []
            if _obj_kills(enemy_obj, "dragon") >= _obj_kills(team_obj, "dragon") + 2:
                reasons.append("Fell behind in dragon control.")
            if _obj_kills(enemy_obj, "baron") > _obj_kills(team_obj, "baron"):
                reasons.append("Lost Baron control.")
            if _obj_kills(enemy_obj, "tower") >= _obj_kills(team_obj, "tower") + 3:
                reasons.append("Lost a lot of tower pressure.")

            cs_thresh = _role_cs_threshold(game_role)
            role_label = _role_label_singular(game_role)

            if cs_per_min < cs_thresh and duration_minutes > 20:
                reasons.append(f"Low CS/min for a {role_label}.")
            if dmg_share < 0.20:
                reasons.append("Low damage share relative to team.")
            if kp < 0.50:
                reasons.append("Low kill participation.")
            if deaths >= 8 and kda < 2.0:
                reasons.append("High deaths / low KDA.")

            if not reasons:
                reasons.append("Outscaled / lost extended teamfights.")

            for r in reasons:
                loss_reason_counter[r] += 1
            
            per_game_loss_details.append({
                "match_id": match["metadata"]["matchId"],
                "champion": champ_name,
                "game_length_min": round(duration_minutes, 1),
                "reasons": reasons,
                "role": game_role
            })

    # --- End Loop ---
    
    # Calculate Weighted Averages
    if total_weight > 0:
        avg_kda = sum(kdas_weighted) / total_weight
        avg_dmg_share = sum(dmg_shares_weighted) / total_weight
        avg_gold_share = sum(gold_shares_weighted) / total_weight
        avg_cs_per_min = sum(cs_per_min_weighted) / total_weight
        avg_kp = sum(kp_weighted) / total_weight
        avg_vis_score = sum(vis_score_weighted) / total_weight
        avg_dpm = sum(dpm_weighted) / total_weight
    else:
        avg_kda = avg_dmg_share = avg_gold_share = avg_cs_per_min = avg_kp = avg_vis_score = avg_dpm = 0.0

    summary = {
        "games": len(matches),
        "wins": wins,
        "losses": losses,
        "winrate": round(wins / len(matches), 2) if matches else 0.0,
        "avg_kda": round(avg_kda, 2),
        "avg_damage_share": round(avg_dmg_share, 3),
        "avg_gold_share": round(avg_gold_share, 3),
        "avg_cs_per_min": round(avg_cs_per_min, 2),
        "avg_kp": round(avg_kp, 3),
        "avg_vis_score": round(avg_vis_score, 1),
        "avg_dpm": round(avg_dpm, 0),
        "is_weighted": use_weighted,
        "season_filter": current_season_prefix if use_weighted else "ALL"
    }

    # --- Detect primary role across games ------------------------------------

    if role_counter:
        primary_role = role_counter.most_common(1)[0][0]
    else:
        primary_role = "MIDDLE"

    role_label_plural = _role_label_plural(primary_role)

    # --- Per-champion stats (3+ games) ---------------------------------------

    per_champion_stats = []
    for champ_name, data in champ_data.items():
        games = data["games"]
        # if games < 3:
        #     continue  # only show champs you’ve actually played a bit

        champ_entry = {
            "champion": champ_name,
            "games": games,
            "winrate": round(data["wins"] / games, 2) if games > 0 else 0.0,
            "avg_kda": round(data["total_kda"] / games, 2) if games > 0 else 0.0,
            "cs_per_min": round(data["total_cs_per_min"] / games, 2) if games > 0 else 0.0,
            "dmg_share": round(data["total_dmg_share"] / games, 3) if games > 0 else 0.0,
            "avg_kp": round(data["total_kp"] / games, 3) if games > 0 else 0.0,
        }
        per_champion_stats.append(champ_entry)

    # sort by games played desc
    per_champion_stats.sort(key=lambda x: x["games"], reverse=True)

    # --- Loss patterns summary -----------------------------------------------

    loss_patterns = []
    if losses > 0:
        for reason, count in loss_reason_counter.most_common():
            loss_patterns.append(
                {
                    "reason": reason,
                    "count": count,
                    "percent": count / losses,
                }
            )

    # --- Baseline comparison vs Diamond/Master (role-aware) ------------------

    def compare_to_baseline(stat_key: str, value: float, role: str):
        role_baselines = ROLE_BASELINES.get(role) or ROLE_BASELINES["MIDDLE"]
        baseline = role_baselines.get(stat_key, 0)
        if baseline <= 0:
            return {
                "your_value": value,
                "baseline": baseline,
                "status": "no baseline",
            }
        ratio = value / baseline
        if ratio >= 1.10:
            status = "above Diamond/Master baseline"
        elif ratio >= 0.90:
            status = "near Diamond/Master baseline"
        else:
            status = "below Diamond/Master baseline"
        return {
            "your_value": value,
            "baseline": baseline,
            "status": status,
        }

    baseline_comparison = {
        "avg_cs_per_min": compare_to_baseline(
            "avg_cs_per_min", summary["avg_cs_per_min"], primary_role
        ),
        "avg_damage_share": compare_to_baseline(
            "avg_damage_share", summary["avg_damage_share"], primary_role
        ),
        "avg_kda": compare_to_baseline("avg_kda", summary["avg_kda"], primary_role),
        "avg_kp": compare_to_baseline("avg_kp", summary["avg_kp"], primary_role),
    }

    # --- You vs team verdict --------------------------------------------------

    overall_index = _safe_mean(you_vs_team_scores_all)
    losses_index = _safe_mean(you_vs_team_scores_losses)

    if losses_index >= 0.5:
        responsibility_text = (
            "In your LOSSES, you're often one of the better-performing members of your team. "
            "That suggests many games are lost due to team macro, coordination, or scaling, "
            "rather than purely your lane/mechanical play."
        )
    elif losses_index <= -0.5:
        responsibility_text = (
            "In your LOSSES, you're frequently near the bottom of your team's performance. "
            "This points to your own mistakes (positioning, deaths, damage output, or CS) "
            "being a primary factor in many defeats."
        )
    else:
        responsibility_text = (
            "In your LOSSES, responsibility looks mixed. Sometimes you perform well yet still "
            "lose due to team issues; other times your own stats lag behind and contribute heavily "
            "to the loss."
        )

    # adjust tone if you're clearly below baselines
    below_baseline_flags = 0
    for key in ["avg_cs_per_min", "avg_damage_share", "avg_kda", "avg_kp"]:
        if baseline_comparison[key]["status"].startswith("below"):
            below_baseline_flags += 1

    if below_baseline_flags >= 3:
        responsibility_text += (
            f" Statistically, several of your core metrics are below typical Diamond/Master baselines "
            f"for {role_label_plural}, so there is significant room for personal improvement even when "
            "your team is struggling."
        )

    you_vs_team = {
        "overall_index": overall_index,
        "losses_index": losses_index,
        "classification": responsibility_text,
    }

    patch_summary = dict(patch_counter)

    return {
        "summary": summary,
        "patch_summary": patch_summary,
        "per_champion": per_champion_stats,
        "loss_patterns": loss_patterns,
        "baseline_comparison": baseline_comparison,
        "you_vs_team": you_vs_team,
        "per_game_loss_details": per_game_loss_details,
        "primary_role": primary_role,
        "teammates": analyze_teammates(matches, puuid, season_prefix=current_season_prefix if use_weighted else None),
        "recent_performance": analyze_recent_performance(matches, puuid),
    }