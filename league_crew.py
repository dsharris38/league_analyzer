# league_crew.py

import os
import json
from typing import Any, Dict, List

from openai import OpenAI
import requests
from functools import lru_cache

# --- Item Name Resolution Helpers ---

@lru_cache(maxsize=1)
def _get_latest_ddragon_version() -> str:
    try:
        resp = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=5)
        if resp.status_code == 200:
            return resp.json()[0]
    except Exception:
        pass
    return "14.23.1" # Fallback

@lru_cache(maxsize=1)
def _get_item_map(version: str) -> Dict[str, str]:
    try:
        url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/item.json"
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return {k: v["name"] for k, v in data["data"].items()}
    except Exception:
        pass
    return {}

def _get_item_name(item_id: int) -> str:
    if not item_id or item_id == 0:
        return "Empty Slot"
    
    version = _get_latest_ddragon_version()
    item_map = _get_item_map(version)
    
    return item_map.get(str(item_id), f"Item {item_id}")


def _extract_json_from_text(text: str) -> Dict[str, Any] | None:
    """
    Robustly extract the first valid JSON object from a text string.
    Handles multiple blocks, markdown wrapping, and trailing garbage.
    """
    text = text.strip()
    
    # Try direct parse
    try:
        return json.loads(text, strict=False)
    except Exception:
        pass

    start_idx = text.find('{')
    if start_idx != -1:
        # Strategy 1: First { to Last }
        end_idx = text.rfind('}')
        if end_idx != -1:
            try:
                candidate = text[start_idx : end_idx + 1]
                return json.loads(candidate, strict=False)
            except Exception:
                pass

        # Strategy 2: Iterative approach for nested/multiple checks
        balance = 0
        for i in range(start_idx, len(text)):
            char = text[i]
            if char == '{':
                balance += 1
            elif char == '}':
                balance -= 1
                if balance == 0:
                    try:
                        candidate = text[start_idx : i + 1]
                        return json.loads(candidate, strict=False)
                    except Exception:
                        pass
    
    # Fallback regex (rarely needed if above logic is good, but good redundancy)
    import re
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0), strict=False)
        except Exception:
            pass
            
    return None



def _get_openai_model_name() -> str:
    """
    Get the OpenAI model name from environment, default to gpt-4o-mini.
    """
    return os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini")


def _build_crew_prompt(agent_payload: Dict[str, Any]) -> str:
    """
    Build a single prompt that simulates a multi-agent coaching crew using
    the rich JSON output from the league_analyzer.

    The payload is exactly what main.py prints between
    BEGIN/END LEAGUE ANALYZER JSON.
    """

    # Basic convenience pulls (with robust .get usage so we never crash)
    schema_version = agent_payload.get("schema_version", "unknown")
    analysis = agent_payload.get("analysis", {})
    summary = analysis.get("summary", {})
    per_champion = analysis.get("per_champion", [])
    loss_patterns = analysis.get("loss_patterns", [])
    baseline = analysis.get("baseline_comparison", {})
    you_vs_team = analysis.get("you_vs_team", {})
    per_game_loss = analysis.get("per_game_loss_details", [])
    patch_summary = analysis.get("patch_summary", {})
    macro_profile = analysis.get("macro_profile", {})
    per_game_comp = analysis.get("per_game_comp", [])
    itemization_profile = analysis.get("itemization_profile", {})
    per_game_items = analysis.get("per_game_items", [])

    primary_role = analysis.get("primary_role", "UNKNOWN")

    timeline_diag = agent_payload.get("timeline_loss_diagnostics", [])
    movement = agent_payload.get("movement_summaries", [])
    meta = agent_payload.get("meta", {})

    champion_profiles = agent_payload.get("champion_profiles", {})

    riot_id = agent_payload.get("riot_id", "Unknown#0000")
    intended_role = meta.get("intended_role_focus", primary_role)
    player_rank = meta.get("player_self_reported_rank", "Unknown")
    notes_for_coach = meta.get("notes_for_coach", "")

    # Serialize slices of the payload as compact JSON for the model to inspect.
    # This keeps the prompt deterministic and avoids giant walls of prose.
    summary_json = json.dumps(summary, ensure_ascii=False, indent=2)
    per_champ_json = json.dumps(per_champion, ensure_ascii=False, indent=2)
    loss_patterns_json = json.dumps(loss_patterns, ensure_ascii=False, indent=2)
    baseline_json = json.dumps(baseline, ensure_ascii=False, indent=2)
    you_vs_team_json = json.dumps(you_vs_team, ensure_ascii=False, indent=2)
    per_game_loss_json = json.dumps(per_game_loss, ensure_ascii=False, indent=2)
    # Filter movement summaries to remove heavy coordinate data not needed by LLM
    movement_for_llm = []
    for m in movement:
        # Create a shallow copy to modify
        clean_m = m.copy()
        # Remove heavy lists
        clean_m.pop("all_positions", None)
        clean_m.pop("position_samples", None)
        clean_m.pop("kill_events", None) # LLM uses per_game_loss_details for kills
        clean_m.pop("ward_events", None)
        clean_m.pop("building_events", None)
        # Strip other detailed timeline series to save tokens
        clean_m.pop("all_item_builds", None)
        clean_m.pop("item_build", None)
        clean_m.pop("gold_xp_series", None)
        clean_m.pop("team_gold_diff", None)
        movement_for_llm.append(clean_m)

    timeline_json = json.dumps(timeline_diag, ensure_ascii=False, indent=2)
    movement_json = json.dumps(movement_for_llm, ensure_ascii=False, indent=2)
    patch_summary_json = json.dumps(patch_summary, ensure_ascii=False, indent=2)
    champion_profiles_json = json.dumps(champion_profiles, ensure_ascii=False, indent=2)
    macro_profile_json = json.dumps(macro_profile, ensure_ascii=False, indent=2)
    per_game_comp_json = json.dumps(per_game_comp, ensure_ascii=False, indent=2)
    itemization_profile_json = json.dumps(itemization_profile, ensure_ascii=False, indent=2)
    per_game_items_json = json.dumps(per_game_items, ensure_ascii=False, indent=2)

    prompt = f"""
You are a **League of Legends multi-agent coaching crew** analyzing a player's recent ranked games.
You receive structured JSON exported from a local Python analyzer that already computed
advanced stats, loss reasons, and timeline-based movement summaries.

Data schema version: {schema_version}

You are NOT allowed to ask the user questions. Your job is to produce a single, clear,
actionable coaching report.

---

## Player & Context

- Riot ID: **{riot_id}**
- Intended role focus: **{intended_role}**
- Primary role inferred from data: **{primary_role}**
- Self-reported rank (may be missing or imprecise): **{player_rank}**
- Extra notes from player: "{notes_for_coach}"

---

## Available Data (JSON)

1. Summary (overall performance across recent games)

```json
{summary_json}
```

2. Per-champion stats (for this dataset)

```json
{per_champ_json}
```
Each entry has:
  - champion
  - games
  - winrate
  - avg_kda
  - cs_per_min
  - dmg_share
  - avg_kp

3. Loss patterns (aggregated classifiers)

```json
{loss_patterns_json}
```

4. Baseline comparison vs high-elo players

```json
{baseline_json}
```

5. "You vs team" responsibility index

```json
{you_vs_team_json}
```

6. Per-game loss details

```json
{per_game_loss_json}
```
Each entry may include:
  - match_id
  - champion
  - game_length_min
  - kills, deaths, assists
  - cs_per_min, dmg_share, kp
  - team_kills, enemy_kills
  - reasons[]
  - role

7. Timeline-based loss diagnostics (gold swings & objectives)

```json
{timeline_json}
```
Each item has:
  - match_id
  - primary_reason (e.g., "threw_lead", "early_gap", "objective_gap", etc.)
  - tags (threw_lead, early_gap, objective_gap, got_picked_before_objective, win)
  - details with:
      - max_lead, max_deficit
      - early_min (gold diff ~10 min)
      - mid_max (max lead around midgame)
      - dragon_gap, baron_gap
      - picked_before_objective (count)

8. Movement summaries (location-based behaviour)

```json
{movement_json}
```

9. Patch summary (if available)

```json
{patch_summary_json}
```

If present, this describes which game patches are most represented in the data.
When making build/rune recommendations and champion pool suggestions, you should
prioritize patterns that make sense for the **most recent or most represented patches**.

10. Champion Profiles (hand-authored metadata for specific champions)

```json
{champion_profiles_json}
```

Each profile (when present) includes:
  - recommended_roles: typical positions for this champ
  - archetype: high-level identity (e.g. "tempo jungler", "control mage")
  - strengths: what this champ is meant to do well
  - core_goals: a checklist of what a "good game" looks like for this champ

These profiles are only provided for champions the player actually used in the
analyzed games (plus an optional __meta__ entry). Use them heavily to make your
advice **champion-specific**, not just generic to the role.

11. Macro Profile (aggregated macro patterns)

```json
{macro_profile_json}
```

This aggregates how often different loss tags occur (e.g. threw_lead, early_gap,
objective_gap, got_picked_before_objective), and average leads/deficits and
dragon/baron gaps. Use this to anchor your macro coaching in specific numbers
(e.g., "you lose dragons in 70% of your losses" or "you often throw leads").

12. Per-Game Team Compositions

```json
{per_game_comp_json}
```

Each entry shows, per match:
  - match_id
  - your_champion, your_role
  - ally_champions
  - enemy_champions

Use this to comment on whether this player's **champion choices** fit what their
team needed (e.g. lack of frontline, lack of engage, no AP threats), and whether
alternative picks from their role & champ pool might have been better.

13. Itemization Data

```json
{itemization_profile_json}
```

```json
{per_game_items_json}
```

`itemization_profile` gives coarse stats (e.g., games without boots, 6-item completion).
`per_game_items` lists final builds per game, including item IDs and best-effort item names.
Use these to give concrete, champion-specific itemization coaching. Make sure your advice
is consistent with the patch context and the champion's intended strengths.

---

## Your Job

You are a **Holistic League of Legends Coaching System**. Your goal is to analyze the provided JSON data and generate a comprehensive, actionable report that covers all aspects of gameplay.

### Analysis Modules

You must mentally perform the following analyses before generating the report. **CRITICAL**: Use `champion_profiles` to adjust your expectations based on the champion's **archetype** and **core_goals**.

1.  **Laning & Farming Analysis**:
    - Check `cs_per_min`. **Contextualize this**: A "roaming support" or "river shen" will have lower CS than a "hyper-scaling marksman".
    - Is it above 7.0 for carries? If not, why?
    - Look at `per_game_loss_details`: are there "early_gap" tags?
    - **Output Target**: Put advice on CSing, wave management, and trading in **`champion_feedback`**.

2.  **Skirmishing & Dueling Analysis**:
    - Check `avg_kda` and `avg_damage_share`.
    - **Contextualize this**: An "engage tank" (e.g. Nautilus) may have high deaths but high assists. A "reset skirmisher" (e.g. Viego) needs kills.
    - High damage but low kills? (Struggling to finish). High deaths? (Over-aggressive).
    - **Output Target**: Put advice on mechanics, power spikes, and 1v1s in **`champion_feedback`**.

3.  **Teamfighting & Positioning Analysis**:
    - Check `avg_kp` (Kill Participation). < 50% usually means splitting too much or late to fights.
    - Check `deaths` in `summary`. High avg deaths (> 5) often indicates poor positioning in fights.
    - **Output Target**: Put advice on grouping, flanking, and peel in **`overview`**.

4.  **Objective & Macro Control Analysis**:
    - **CRITICAL**: Check `macro_profile`.
    - `avg_dragon_gap` / `avg_baron_gap`: Positive means good control, negative means getting out-macro'd.
    - `tag_rates`: High "threw_lead"? (Mid-game throws). High "objective_gap"? (Giving up neutral objectives).
    - **Contextualize this**: A "split-push skirmisher" (e.g. Fiora) should pressure side lanes, while a "control mage" (e.g. Orianna) should group for objectives.
    - **Output Target**: Put high-level game plans and map control advice in **`overview`**.

5.  **Draft & Composition Analysis**:
    - Check `per_game_comp`. Does the player pick full AD into armor stackers? Do they pick no-CC champs when the team needs engage?
    - **Output Target**: Put draft and identity advice in **`overview`** or **`champion_feedback`** as appropriate.

6.  **Itemization & Rune Analysis**:
    - Check `per_game_items` and `itemization_profile`.
    - Are they building static builds every game?
    - Are they skipping boots?
    - Do they buy anti-heal vs healers?
    - **Output Target**: Put specific build corrections in **`itemization_tips`**.

---

## Report Generation

Synthesize your findings into the following 4 sections. **Be specific. Cite numbers.**

---

## Report Structure (JSON)

**CRITICAL INSTRUCTIONS**:
1. You must output a **valid JSON object** containing exactly these 4 keys.
2. Each value must be a Markdown string.
3. **DO NOT** include any thought process, reasoning, or explanations before the JSON.
4. **DO NOT** wrap the JSON in markdown code blocks (no ```json).
5. Your response must START with {{ and END with }}.
6. Output ONLY the JSON object, nothing else.

Expected format:

{{{{
  "overview": "Markdown string. 2-4 paragraphs summarizing the player's identity, strengths, weaknesses, and main bottleneck. Use **bold** for key terms. Use > Blockquotes for critical takeaways.",
  "champion_feedback": "Markdown string. Specific advice for their most played champions. Use **bullet points** for readability. Bold key stats or mechanics.",
  "itemization_tips": "Markdown string. Concrete itemization and rune advice. Use **concise bullet points**. Use > Blockquotes for 'Golden Rules' of building.",
  "goals": "Markdown string. A numbered list of 5-10 concrete, measurable drills or goals."
}}}}

**Formatting Guidelines (NN/g Style)**:
1. **Summaries**: Start each section with a 1-sentence summary in *italics*.
2. **Bullet Points**: Use bullet points for lists to improve scannability. Avoid walls of text.
3. **Bold**: Bold important concepts, but do not exceed 30% of the text.
4. **Callouts**: Use blockquotes (>) to highlight critical insights or "Aha!" moments.
5. **Short Paragraphs**: Keep paragraphs under 3-4 lines.

**REMINDER**: Start your response with {{{{ immediately. No preamble, no explanation, no code blocks.
"""
    return prompt.strip()


def call_league_crew(agent_payload: Dict[str, Any]) -> Dict[str, str]:
    """
    Call OpenAI once with a multi-agent-style prompt and return the coaching dict.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Fallback to verify if GEMINI key is still around? No, we switched.
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Please add it to your .env or environment."
        )

    client = OpenAI(api_key=api_key)
    model_name = _get_openai_model_name()
    
    prompt = _build_crew_prompt(agent_payload)

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"} # GPT-4o supports this for guaranteed strict JSON
        )
        coaching_text = response.choices[0].message.content or ""
        coaching_text = coaching_text.strip()
    except Exception as e:
        return {
            "overview": f"Error calling OpenAI: {e}",
            "champion_feedback": "",
            "itemization_tips": "",
            "goals": ""
        }

    if not coaching_text:
        return {
            "overview": "The coaching crew did not return any text. Please try again.",
            "champion_feedback": "",
            "itemization_tips": "",
            "goals": ""
        }

    # Attempt to parse JSON using helper
    coaching_json = _extract_json_from_text(coaching_text)
    
    if coaching_json and isinstance(coaching_json, dict):
        # Ensure all required keys exist
        required_keys = ["overview", "champion_feedback", "itemization_tips", "goals"]
        for key in required_keys:
            if key not in coaching_json:
                coaching_json[key] = ""
        return coaching_json

    # Fallback: treat the whole text as overview
    return {
        "overview": f"**Parsing Error**: Could not extract structured coaching report. Raw response:\n\n{coaching_text}",
        "champion_feedback": "",
        "itemization_tips": "",
        "goals": ""
    }


def classify_matches_and_identify_candidates(analysis: Dict[str, Any]) -> tuple[List[Dict[str, Any]], Dict[str, List[str]]]:
    """
    Classify ALL matches with descriptive tags and identify high-value review candidates.
    
    Returns:
        candidates: List of matches worth reviewing.
        match_tags: Dict mapping match_id to a list of descriptive tags.
    """
    candidates = []
    match_tags = {}
    
    # We need per-game details
    # per_game_loss usually only has losses. We should use detailed_matches for ALL games.
    detailed_matches = analysis.get("detailed_matches", [])
    timeline_diag = analysis.get("timeline_loss_diagnostics", [])
    
    # Create a map for easy lookup
    timeline_map = {t["match_id"]: t for t in timeline_diag}
    
    for d_match in detailed_matches:
        mid = d_match.get("match_id")
        if not mid:
            continue
            
        tags = []
        reasons = []
        
        # Find self participant
        self_p = next((p for p in d_match["participants"] if p.get("is_self")), None)
        if not self_p:
            continue

        # Stats
        kills = float(self_p.get("kills", 0))
        deaths = float(self_p.get("deaths", 0))
        assists = float(self_p.get("assists", 0))
        kda = (kills + assists) / max(1, deaths)
        
        # Calculate KP and Dmg Share if not directly available in self_p
        challenges = self_p.get("challenges", {})
        kp = challenges.get("killParticipation", 0.0)
        dmg_share = challenges.get("teamDamagePercentage", 0.0)
        
        # Fallback calculation if challenges are missing (common in some data exports)
        if kp == 0.0 or dmg_share == 0.0:
            team_id = self_p.get("teamId")
            teammates = [p for p in d_match["participants"] if p.get("teamId") == team_id]
            
            team_kills = sum(p.get("kills", 0) for p in teammates)
            team_dmg = sum(p.get("totalDamageDealtToChampions", 0) for p in teammates)
            
            if team_kills > 0:
                kp = (kills + assists) / team_kills
                
            if team_dmg > 0:
                my_dmg = self_p.get("totalDamageDealtToChampions", 0)
                dmg_share = my_dmg / team_dmg
        
        # Timeline stats
        t_data = timeline_map.get(mid, {})
        loss_tags = t_data.get("tags", [])
        details = t_data.get("details", {})
        max_lead = float(details.get("max_lead", 0))
        early_min = float(details.get("early_min", 0))
        
        is_win = self_p.get("win", False)

        # --- TAGGING LOGIC ---

        # 1. Lane Opponent Analysis
        lane_opponent = None
        if self_p.get("teamPosition") != "UTILITY": # Skip for support for now as lane opponent is fuzzy
            lane_opponent = next((p for p in d_match["participants"] 
                                  if p.get("teamPosition") == self_p.get("teamPosition") 
                                  and p.get("teamId") != self_p.get("teamId")), None)
        
        opponent_gap = False
        if lane_opponent:
            opp_kda = (lane_opponent.get("kills", 0) + lane_opponent.get("assists", 0)) / max(1, lane_opponent.get("deaths", 0))
            opp_gold = lane_opponent.get("goldEarned", 0)
            my_gold = self_p.get("goldEarned", 0)
            
            # If opponent has 20% more gold and high KDA while you struggled
            if opp_gold > my_gold * 1.2 and opp_kda > 4.0 and kda < 2.0:
                opponent_gap = True

        # 2. Objective Death Analysis
        bad_death = False
        if "got_picked_before_objective" in loss_tags:
            bad_death = True

        if is_win:
            if kda > 4.0 and kp > 0.55 and dmg_share > 0.25:
                tags.append("Hyper Carry")
            elif kda < 2.0 and kp < 0.40:
                tags.append("Passenger") # You got carried
            elif max_lead > 5000 and d_match.get("game_duration", 0) < 1500: # < 25 min
                tags.append("Stomp")
            else:
                tags.append("Solid Win")
        else:
            # Losses
            
            # A. Throw Detection
            if "threw_lead" in loss_tags or max_lead > 2500:
                tags.append("Throw")
                reasons.append("Threw significant lead")
            
            # B. Ace in Defeat (High Agency)
            elif kp > 0.50 and kda > 2.5: 
                tags.append("Ace in Defeat") 
                reasons.append("High Agency Loss (Strong performance but lost)")
            
            # C. Lane Gap (Specific to laning phase)
            elif opponent_gap:
                tags.append("Lane Gap")
                reasons.append(f"Gap vs {lane_opponent.get('champion_name')} (Opponent snowballed)")

            # D. Bad Death (Objective)
            elif bad_death:
                tags.append("Bad Death")
                reasons.append("Died before key objective (Costly mistake)")

            # E. Early Game Deficit (Gold @ 10-15m)
            elif early_min < -1500:
                tags.append("Early Gap")
                reasons.append("Fell behind early (>1.5k gold deficit)")

            # F. High Blame / Weak Link (Nuanced)
            # Conditions:
            # 1. Feeding: High deaths AND low KDA
            # 2. Invisible: Low KP AND Low Damage (Role adjusted)
            
            is_support = self_p.get("teamPosition") == "UTILITY"
            
            # Feeding Check
            if deaths >= 11 and kda < 1.5:
                tags.append("Feeding")
                reasons.append(f"High Deaths ({int(deaths)}) with low impact")
            
            # Invisible Check
            # Supports allowed lower damage, but need decent KP
            kp_thresh = 0.35 if is_support else 0.25
            dmg_thresh = 0.05 if is_support else 0.15
            
            if kp < kp_thresh and dmg_share < dmg_thresh:
                tags.append("Invisible")
                reasons.append("Low Participation & Impact")
            
            # If no specific tag yet, but still a loss
            if not tags:
                if kda > 1.5 and kp > 0.30:
                    tags.append("Team Gap") # You did okay
                else:
                    tags.append("Tough Loss") # Generic bad game

        # Store tags
        match_tags[mid] = tags

        # --- CANDIDATE LOGIC ---
        if reasons:
            candidates.append({
                "match_id": mid,
                "champion": self_p.get("champion_name"),
                "reasons": reasons,
                "score": len(reasons) + (2 if "Lane Gap" in tags or "Feeding" in tags or "Bad Death" in tags else 0)
            })
            
    # Sort by score (most interesting first)
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates, match_tags


def _build_single_game_prompt(match_data: Dict[str, Any]) -> str:
    """Build a prompt for a deep-dive analysis of a single game."""
    
    participants = match_data.get("participants", [])
    self_p = next((p for p in participants if p.get("is_self")), None)
    
    if not self_p:
        return "Error: Could not find player in match data."
        
    win = self_p.get("win", False)
    result = "VICTORY" if win else "DEFEAT"
    champion = self_p.get("champion_name", "Unknown")
    role = self_p.get("teamPosition", "UNKNOWN")
    kda = f"{self_p.get('kills')}/{self_p.get('deaths')}/{self_p.get('assists')}"
    
    # --- 1. Team Context ---
    your_team_id = self_p.get("team_id")
    your_team = []
    enemy_team = []
    lane_opponent = None
    
    pid_map = {} # ID -> Name (Champ)
    
    for p in participants:
        p_name = p.get("champion_name", "Unknown")
        p_role = p.get("teamPosition", "UNKNOWN")
        p_kda = f"{p.get('kills')}/{p.get('deaths')}/{p.get('assists')}"
        pid_map[p.get("participant_id")] = p_name
        
        info = f"{p_name} ({p_role}) - {p_kda}"
        
        if p.get("team_id") == your_team_id:
            your_team.append(info)
        else:
            enemy_team.append(info)
            if p_role == role and role != "UNKNOWN":
                lane_opponent = f"{p_name} ({p_kda})"

    # --- 2. Rich Timeline Construction ---
    events = []
    
    # A. Items (with resolved names)
    for item in self_p.get("item_build", []):
        ts = item.get("timestamp", 0)
        ts_min = int(ts / 60000)
        item_id = item.get("itemId")
        etype = item.get("type")
        
        if etype == "ITEM_PURCHASED":
            item_name = _get_item_name(item_id)
            events.append({"t": ts, "msg": f"[{ts_min}m] BOUGHT {item_name}"})
            
    # B. Kills/Deaths
    for k in match_data.get("kill_events", []):
        ts = k.get("timestamp", 0)
        ts_min = int(ts / 60000)
        killer_id = k.get("killerId")
        victim_id = k.get("victimId")
        
        killer_name = pid_map.get(killer_id, "Minion/Tower")
        victim_name = pid_map.get(victim_id, "Unknown")
        
        if self_p["participant_id"] == killer_id:
            events.append({"t": ts, "msg": f"[{ts_min}m] KILL: You killed {victim_name}"})
        elif self_p["participant_id"] == victim_id:
            events.append({"t": ts, "msg": f"[{ts_min}m] DEATH: You were killed by {killer_name}"})
            
    # C. Objectives (Dragon, Baron, Herald, Towers)
    # Note: building_events and elite_monster_events might be in match_data if enriched, 
    # but standard Riot match DTO puts them in 'info.frames' which we might not have fully parsed here 
    # unless coach_data_enricher did it. 
    # Assuming match_data has 'building_events' and 'monster_events' from the enricher.
    
    for b in match_data.get("building_events", []):
        if b.get("type") == "BUILDING_KILL":
            ts = b.get("timestamp", 0)
            ts_min = int(ts / 60000)
            lane = b.get("laneType", "LANE")
            tower = b.get("towerType", "TURRET")
            team_id = b.get("teamId") # Team of the building (victim)
            
            victim_team = "Your" if team_id == your_team_id else "Enemy"
            events.append({"t": ts, "msg": f"[{ts_min}m] TOWER: {victim_team} {lane} {tower} Destroyed"})

    for m in match_data.get("monster_events", []): # Assuming we have this, or elite_monster_kills
         # If not present, we skip. The enricher needs to provide this.
         # Let's check if we have standard elite monster kills in participants? No, that's summary.
         # We'll rely on what's available. If 'monster_events' isn't there, we miss it.
         pass

    # D. Wards (Grouped & Filtered)
    ward_counts = {} # (minute) -> count
    for w in match_data.get("ward_events", []):
        if w.get("creatorId") == self_p["participant_id"] and w.get("type") == "WARD_PLACED":
            ts = w.get("timestamp", 0)
            ts_min = int(ts / 60000)
            ward_type = w.get("wardType", "WARD")
            
            # Only log Control Wards explicitly, group others
            if ward_type == "CONTROL_WARD":
                events.append({"t": ts, "msg": f"[{ts_min}m] VISION: Placed Control Ward"})
            else:
                # We'll summarize stealth wards later if needed, or just log them sparingly
                pass

    # E. Location Snapshots (Every 3 mins)
    # We need position data. match_data['all_positions'] has it?
    # Or self_p['position_history']?
    # The enricher puts 'all_positions' in the root usually.
    all_positions = match_data.get("all_positions", {}).get(str(self_p["participant_id"]), [])
    
    # Sort positions by time
    all_positions.sort(key=lambda x: x["t"])
    
    last_snapshot = -10
    for pos in all_positions:
        t_min = pos["t"]
        if t_min - last_snapshot >= 3.0: # Every 3 mins
            # Determine rough area
            x, y = pos["x"], pos["y"]
            area = "Base"
            if x < 3000 and y < 3000: area = "Blue Base"
            elif x > 12000 and y > 12000: area = "Red Base"
            elif x < 5000 and y > 10000: area = "Top Lane"
            elif x > 10000 and y < 5000: area = "Bot Lane"
            elif 5000 < x < 10000 and 5000 < y < 10000: area = "Mid Lane"
            else: area = "Jungle/River"
            
            events.append({"t": t_min * 60000, "msg": f"[{int(t_min)}m] LOCATION: {area}"})
            last_snapshot = t_min

    # Sort all events by timestamp
    events.sort(key=lambda x: x["t"])
    
    # Format for Prompt
    timeline_str = chr(10).join([e["msg"] for e in events])

    prompt = f"""
You are an expert League of Legends coach doing a **Deep Dive Analysis** of a single match.

**Match Context**:
- Result: {result}
- Champion: {champion} ({role})
- KDA: {kda}
- Duration: {match_data.get("game_duration", 0) // 60} minutes
- Lane Opponent: {lane_opponent or "Unknown"}

**Your Goal**:
Analyze this specific game to find the *root cause* of the result. 
Focus on:
1. **Build Adaptation**: Did the player build correctly for *this specific enemy comp*?
   - **CRITICAL RULE**: Do NOT recommend mutually exclusive items.
   - **Lifeline**: Shieldbow, Sterak's, and Maw are exclusive. Pick ONE.
   - **Spellblade**: Trinity, Lich Bane, and Iceborn are exclusive. Pick ONE.
   - **Last Whisper**: LDR, Mortal Reminder, and Serylda's are exclusive. Pick ONE.
   - **Hydra**: Ravenous, Titanic, and Profane are exclusive. Pick ONE.
2. **Macro & Rotation**: Look at their location snapshots. Were they in the right place?
3. **Vision**: Are they buying Control Wards?
4. **Key Turning Points**: Look at deaths and objective fights.

**Data**:

### Your Team
{chr(10).join([f"- {x}" for x in your_team])}

### Enemy Team
{chr(10).join([f"- {x}" for x in enemy_team])}

### Timeline Events (Items, Kills, Objectives, Location)
{timeline_str}

### Output Format
Return a **valid JSON object** with the following keys. Each value must be a Markdown string.
**DO NOT** include any thought process. Start with {{ and end with }}.

{{{{
  "story": "Markdown string. A brief narrative of what happened, citing specific times. Start with a 1-sentence summary in *italics*.",
  "mistakes": "Markdown string. Bulleted list of specific moments, deaths, or bad rotations. Use **bold** for timestamps.",
  "build_vision": "Markdown string. Critique of the item build vs this enemy team, and ward usage. Use > Callouts for major build errors.",
  "verdict": "Markdown string. Was this game winnable? Who is to blame? What is the ONE thing to fix?"
}}}}

**Formatting Guidelines (NN/g Style)**:
1. **Summaries**: Start each section with a 1-sentence summary in *italics*.
2. **Bullet Points**: Use bullet points for lists to improve scannability.
3. **Bold**: Bold important concepts (max 30% of text).
4. **Callouts**: Use blockquotes (>) to highlight critical insights.
5. **Short Paragraphs**: Keep paragraphs under 3-4 lines.
"""
    return prompt.strip()


def analyze_specific_game(match_id: str, full_match_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Run a deep-dive analysis on a single game using OpenAI.
    Returns a structured dict with keys: story, mistakes, build_vision, verdict.
    """
    if not full_match_data:
        return {"story": "Error: No match data provided.", "mistakes": "", "build_vision": "", "verdict": ""}
        
    prompt = _build_single_game_prompt(full_match_data)
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"story": "Error: OPENAI_API_KEY not set.", "mistakes": "", "build_vision": "", "verdict": ""}
        
    client = OpenAI(api_key=api_key)
    model_name = _get_openai_model_name()
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        text = response.choices[0].message.content or ""
        text = text.strip()
        
        # Attempt to parse JSON using helper
        data = _extract_json_from_text(text)
        
        if data:
            return {
                "story": data.get("story", text),
                "mistakes": data.get("mistakes", ""),
                "build_vision": data.get("build_vision", ""),
                "verdict": data.get("verdict", "")
            }

        # Fallback if no JSON found
        return {
            "story": text,
            "mistakes": "",
            "build_vision": "",
            "verdict": ""
        }
            
    except Exception as e:
        return {
            "story": f"Analysis failed: {str(e)}",
            "mistakes": "",
            "build_vision": "",
            "verdict": ""
        }
