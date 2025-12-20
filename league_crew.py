# league_crew.py

import os
import json
import hashlib
from pathlib import Path
from typing import Any, Dict, List

from openai import OpenAI
import requests
from functools import lru_cache
from lolalytics_client import Lolalytics
from dotenv import load_dotenv

# --- Configuration ---
SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

api_key = os.environ.get("OPENAI_API_KEY")
if api_key:
    # Print first 5 chars to verify key is definitely loaded
    print(f"DEBUG: Found OPENAI_API_KEY starting with: {api_key[:5]}...")
else:
    print(f"DEBUG: ERROR - OPENAI_API_KEY not found in environment. Checked {SCRIPT_DIR / '.env'}")
    # Try one level up just in case
    parent_env = SCRIPT_DIR.parent / ".env"
    if parent_env.exists():
        print(f"DEBUG: Found .env in parent: {parent_env}, loading...")
        load_dotenv(parent_env)

CACHE_DIR = SCRIPT_DIR / "saves" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

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

import time

# ...

@lru_cache(maxsize=1)
def _get_item_map(version: str) -> Dict[str, str]:
    """Fetch item map from Meraki Analytics (Cached)."""
    cache_file = CACHE_DIR / "meraki_items.json"
    
    # Try Cache
    if cache_file.exists():
        if time.time() - cache_file.stat().st_mtime < 86400:
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return {k: v["name"] for k, v in data.items()}
            except Exception:
                pass
                
    # Fetch
    try:
        url = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/items.json"
        
        # Note: Meraki format is { "1001": { "name": "Boots", ... } }
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            
            # Save Cache
            try:
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(data, f)
            except Exception:
                pass

            return {k: v["name"] for k, v in data.items()}
            
    except Exception as e:
        print(f"Warning: Failed to fetch Meraki items: {e}")
        pass
        
    return {}

def _get_item_name(item_id: int) -> str:
    if not item_id or item_id == 0:
        return "Empty Slot"
    
    # Version is ignored by Meraki fetcher but kept for signature/caching
    version = _get_latest_ddragon_version()
    item_map = _get_item_map(version)
    
    return item_map.get(str(item_id), f"Item {item_id}")



def _fetch_meta_context(champion: str, role: str, vs_champion: str | None = None) -> str:
    """
    Fetch meta context (winrates, top items) from Lolalytics.
    Returns a summarized string for the LLM.
    """
    try:
        if not champion or champion == "Unknown":
            return "No meta data available (Champion Unknown)."
        
        # Map Riot role names to Lolalytics role names
        role_map = {
            "TOP": "top",
            "JUNGLE": "jungle",
            "MIDDLE": "mid",
            "BOTTOM": "adc",
            "UTILITY": "support"
        }
        lane = role_map.get(role, "mid") # Default to mid if unknown

        # Fetch data
        data = Lolalytics.get_champion_data(champion, lane=lane, vs_champion=vs_champion)
        
        if not data:
             return f"No stats found for {champion} in {lane}."

        # Extract key insights (Safely)
        context_str = f" ({lane})" if not vs_champion else f" ({lane} vs {vs_champion})"
        summary = f"**Current Meta for {champion}{context_str}**:\n"
        summary += f"- Tier: {getattr(data, 'tier', 'Unknown')}\n"
        summary += f"- Win Rate: {getattr(data, 'win_rate', 'N/A')}%\n"
        
        # Add Keystone (Vital for checking against removed runes)
        if getattr(data, 'keystone', None):
            summary += f"- Core Keystone: {data.keystone}\n"
        
        # Resolve Items
        build_ids = getattr(data, 'popular_build', [])
        if build_ids:
            item_names = [_get_item_name(iid) for iid in build_ids]
            summary += f"- Core Build: {', '.join(item_names)}\n"
        
        return summary
    except Exception as e:
        return f"Could not fetch meta data: {str(e)}"


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


@lru_cache(maxsize=1)
def _get_home_model_name() -> str:
    """Returns the cost-efficient model for broad summaries."""
    # CRITICAL: DO NOT CHANGE DEFAULT. User has specific access to gpt-5-mini.
    return os.getenv("OPENAI_HOME_MODEL", "gpt-5-mini")

@lru_cache(maxsize=1)
def _get_deep_dive_model_name() -> str:
    """Returns the flagship model for deep reasoning."""
    # CRITICAL: DO NOT CHANGE DEFAULT. User has specific access to gpt-5.1.
    return os.getenv("OPENAI_DEEP_DIVE_MODEL", "gpt-5.1")


OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
# Using gpt-5-mini for home page coaching (fast/cheap)
OPENAI_HOME_MODEL = "gpt-5-mini"
# Using gpt-5-mini for routine match classification (fast/cheap)
OPENAI_TAGGING_MODEL = "gpt-5-mini" # Fallback/Tagging model
OPENAI_DEEP_DIVE_MODEL = "gpt-5.1"

@lru_cache(maxsize=1)
def _get_openai_client() -> OpenAI:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
         print("CRITICAL: OPENAI_API_KEY missing when initializing client.")
    return OpenAI(api_key=key)


def _build_crew_prompt(agent_payload: Dict[str, Any], match_id: str | None = None) -> str:
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
    
    # --- RUNE AGGREGATION LOGIC (Prevent Hallucinations) ---
    # We iterate through detailed_matches to find what Keystones the player ACTUALLY uses.
    detailed_matches = agent_payload.get("analysis", {}).get("detailed_matches", [])
    
    # Map: Champion -> { RuneName: count }
    champ_rune_counts = {}
    
    # Helper to resolve rune name from ID (using basic known map or just ID if fetch fails)
    # We'll use a local map for common keystones since fetching external data in this loop is risky/slow
    keystone_map = {
        8005: "Press the Attack", 8008: "Lethal Tempo", 8021: "Fleet Footwork", 8010: "Conqueror",
        8112: "Electrocute", 8124: "Predator", 8128: "Dark Harvest", 9923: "Hail of Blades",
        8214: "Summon Aery", 8229: "Arcane Comet", 8230: "Phase Rush",
        8437: "Grasp of the Undying", 8439: "Aftershock", 8465: "Guardian",
        8351: "Glacial Augment", 8360: "Unsealed Spellbook", 8369: "First Strike"
    }

    for dm in detailed_matches:
        self_p = next((p for p in dm.get("participants", []) if p.get("is_self")), None)
        if self_p:
            champ = self_p.get("champion_name", "Unknown")
            # Extract Keystone (Perk 0)
            styles = self_p.get("perks", {}).get("styles", [])
            if styles:
                # Primary Style -> First Selection -> Perk ID
                try:
                    keystone_id = styles[0]["selections"][0]["perk"]
                    keystone_name = keystone_map.get(keystone_id, f"Keystone {keystone_id}")
                    
                    if champ not in champ_rune_counts:
                        champ_rune_counts[champ] = {}
                    
                    champ_rune_counts[champ][keystone_name] = champ_rune_counts[champ].get(keystone_name, 0) + 1
                except (KeyError, IndexError):
                    pass
    
    # Format "Rune Profile" string
    rune_profile_lines = []
    for champ, counts in champ_rune_counts.items():
        # Find most common
        top_rune = max(counts, key=counts.get)
        count = counts[top_rune]
        total = sum(counts.values())
        pct = int((count / total) * 100)
        rune_profile_lines.append(f"- **{champ}**: Prefers **{top_rune}** in {pct}% of games.")
        
    rune_context = "\n".join(rune_profile_lines)
    
    # --- ITEM & MATCHUP AGGREGATION LOGIC ---
    champ_items = {} # Champ -> { ItemName: count }
    champ_matchups = {} # Champ -> { VsChamp: [wins, losses] }
    
    for dm in detailed_matches:
        participants = dm.get("participants", [])
        self_p = next((p for p in participants if p.get("is_self")), None)
        
        if not self_p: continue
        
        my_champ = self_p.get("champion_name", "Unknown")
        my_role = self_p.get("teamPosition", "UNKNOWN")
        win = self_p.get("win", False)
        
        # 1. Item Counting
        # We only care about completed items, but scraping all non-boot/starter items is a good proxy.
        # We'll rely on our _get_item_name helper.
        if my_champ not in champ_items: champ_items[my_champ] = {}
        
        # Riot API returns separate "item0"..."item6" or "item_build" list if enriched.
        # Check standard Riot fields first
        items_found = []
        for i in range(7):
            iid = self_p.get(f"item{i}", 0)
            if iid and iid > 0:
                name = _get_item_name(iid)
                # Filter out obvious non-core items (Boots, Potions, Wards)
                # Keep it simple: valid names only. Coach can filter context.
                if "Potion" not in name and "Ward" not in name and "Biscuit" not in name:
                    items_found.append(name)
        
        for iname in items_found:
            champ_items[my_champ][iname] = champ_items[my_champ].get(iname, 0) + 1

        # 2. Matchup Tracking
        if my_role and my_role != "UTILITY": # Skip support matchups for now (too chaotic)
             opponent = next((p for p in participants 
                              if p.get("teamPosition") == my_role 
                              and p.get("teamId") != self_p.get("teamId")), None)
             
             if opponent:
                 vs_champ = opponent.get("champion_name", "Unknown")
                 if my_champ not in champ_matchups: champ_matchups[my_champ] = {}
                 if vs_champ not in champ_matchups[my_champ]: champ_matchups[my_champ][vs_champ] = [0, 0] # [W, L]
                 
                 if win: champ_matchups[my_champ][vs_champ][0] += 1
                 else: champ_matchups[my_champ][vs_champ][1] += 1

    # Format Item Profile
    item_profile_lines = []
    for champ, item_counts in champ_items.items():
        # Get top 5 most frequent items
        sorted_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        top_items_str = ", ".join([f"{name} ({count})" for name, count in sorted_items])
        item_profile_lines.append(f"- **{champ}** Core: {top_items_str}")
    item_context = "\n".join(item_profile_lines)
    
    # Format Matchup Profile (Only significant data: >0 games)
    matchup_profile_lines = []
    for champ, opponents in champ_matchups.items():
        significant_opps = []
        for opp, record in opponents.items():
            wins, losses = record
            total = wins + losses
            if total >= 1: # Log all for context, AI can filter
                wr = int((wins / total) * 100)
                significant_opps.append(f"vs {opp} ({wins}W-{losses}L, {wr}%)")
        
        if significant_opps:
            matchup_profile_lines.append(f"- **{champ}**: {', '.join(significant_opps)}")
            
    matchup_context = "\n".join(matchup_profile_lines)
    # -------------------------------------------------------

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
    summary_json = json.dumps(summary, ensure_ascii=False, separators=(',', ':'))
    per_champ_json = json.dumps(per_champion, ensure_ascii=False, separators=(',', ':'))
    loss_patterns_json = json.dumps(loss_patterns, ensure_ascii=False, separators=(',', ':'))
    baseline_json = json.dumps(baseline, ensure_ascii=False, separators=(',', ':'))
    you_vs_team_json = json.dumps(you_vs_team, ensure_ascii=False, separators=(',', ':'))
    per_game_loss_json = json.dumps(per_game_loss, ensure_ascii=False, separators=(',', ':'))
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

    prompt = f"""
You are a **High-Elo League of Legends Analyst & Performance Psychologist**.
Your goal is NOT to summarize games, but to **DIAGNOSE the player's fundamental identity and bottlenecks**.
You are analyzing their "Quarterly Performance Review" based on their last 20 ranked games.

Data schema version: {schema_version}

**Your Analysis Strategy**:
1.  **Identity Profiling (The "Archetype")**:
    - Look at KDA, Damage Share, and Vision.
    - Are they "The KDA Saver" (High KDA, Low Dmg)?
    - Are they "The Coinflip Carry" (High Kills, High Deaths)?
    - Are they "The Lane Kingdom" (High CS/Gold, but Low Winrate)?
    - **Assign them a creative, descriptive Archetype name.**

2.  **Root Cause Analysis (The "Why")**:
    - Don't just list symptoms ("You die too much"). Start with the symptom and find the cause.
    - Example: "You have high deaths because you fight for Tier 2 towers without vision (Macro Discipline)."
    - Example: "You lose games because you pick early-game champs but play for late-game scaling (Identity Mismatch)."

3.  **The "One Big Thing"**:
    - Identify the single biggest factor stopping them from climbing. Is it CS? Vision? Mental?

---
## Player Context
- Riot ID: **{riot_id}**
- Role: **{primary_role}**
- Rank: **{player_rank}**
- Notes: "{notes_for_coach}"

## Data (JSON)
1. Summary:
```json
{summary_json}
```

2. Per-Champion:
```json
{per_champ_json}
```

3. Loss Patterns:
```json
{loss_patterns_json}
```

4. Baseline & Responsibility:
```json
{baseline_json}
```
You vs Team:
```json
{you_vs_team_json}
```

5. Loss Details:
```json
{per_game_loss_json}
```

6. Macro Profile (Objectives & Throws):
```json
{json.dumps(macro_profile, ensure_ascii=False)}
```

7. Champion Profiles:
```json
{json.dumps(champion_profiles, ensure_ascii=False)}
```

8. Recent Patch Context:
```json
{json.dumps(patch_summary, ensure_ascii=False)}
```

9. Actual Item Preference (DO NOT HALLUCINATE):
```text
{item_context}
```

10. Actual Matchup Data (Win/Loss vs Specific Champs):
```text
{matchup_context}
```

11. Actual Rune Preference (DO NOT HALLUCINATE):
```text
{rune_context}
```

---

## Required JSON Output
Start response with {{{{ and end with }}}}. Output ONLY valid JSON.
format:
{{{{
  "overview": "**The Diagnosis**.\n\n1. **Your Archetype**: [Name]. Explain who they are as a player based on the data.\n2. **The Root Cause**: Explain the underlying habit or mindset issue causing their losses.\n3. **The 'One Big Thing'**: The single most critical focus area.",
  "champion_feedback": "**Champion-Specific Adjustments**\n\n(Identify specific identity shifts or mechanical corrections for their top champions. Use '### ChampionName' headers.)",
  "itemization_tips": "**Build Efficiency**\n\n(Analyze static build path errors or rune mistakes. Be specific.)",
  "goals": "**Top 5 Strategic Priorities**\n\n(A ranked list of 5 concrete, actionable habits.)"
}}}}
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



    # Use the efficiently priced mini model for the 20-game summary
    model_name = _get_home_model_name()
    prompt = _build_crew_prompt(agent_payload)
    if not isinstance(prompt, str):
        prompt = str(prompt)

    # --- Caching Strategy ---
    # We hash the full prompt. If we've seen this exact context before, reuse the result.
    try:
        prompt_hash = hashlib.md5(prompt.encode("utf-8")).hexdigest()
        cache_file = CACHE_DIR / f"crew_{prompt_hash}.json"

        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    print(f"   [AI] Cache Hit! Loading {cache_file.name}")
                    return json.load(f)
            except Exception:
                print("   [AI] Cache Corrupted, re-running...")
    except Exception as e:
        print(f"   [AI] Caching Error (skipping cache): {e}")
        # Continue without caching if hashing or path fails

    client = OpenAI(api_key=api_key)

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
        
        # Save to cache if successful
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(coaching_json, f, indent=2)
        except Exception as e:
            print(f"[AI] Error saving cache: {e}")

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
            
            # If opponent has 12% more gold and good KDA while you struggled
            if opp_gold > my_gold * 1.12 and opp_kda > 2.5 and kda < 2.0:
                opponent_gap = True

        # 2. Objective Death Analysis
        bad_death = False
        if "got_picked_before_objective" in loss_tags:
            bad_death = True

        if is_win:
            # Hyper Carry: High stats OR Massive Damage Carry
            if (kda > 4.0 and kp > 0.50 and dmg_share > 0.22) or (dmg_share > 0.30 and kda > 2.5):
                tags.append("Hyper Carry")
            # Passenger: Low KDA/KP AND Low Damage (Exempts split pushers)
            elif kda < 1.8 and kp < 0.40 and dmg_share < 0.15:
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
            elif (kp > 0.45 and kda > 2.2) or (dmg_share > 0.28 and kda > 1.8): 
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
            
            # Feeding Check (Nuanced: High dmg/kp exempts you)
            # Relaxed thresholds to avoid flagging players who are trading kills or dealing average damage
            if deaths >= 7 and kda < 1.45 and dmg_share < 0.19 and kp < 0.40:
                tags.append("Feeding")
                reasons.append(f"High Deaths ({int(deaths)}) with low impact")
            
            # Invisible Check
            # Supports allowed lower damage, but need decent KP
            kp_thresh = 0.35 if is_support else 0.25
            dmg_thresh = 0.05 if is_support else 0.15
            
            # Invisible Check removed per user preference
            # if kp < kp_thresh and dmg_share < dmg_thresh:
            #     tags.append("Invisible")
            #     reasons.append("Low Participation & Impact")
            
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


def _build_single_game_prompt(match_data: Dict[str, Any], champion_pool: List[str] = []) -> str:
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

    # --- 0. Meta Context ---
    # We need to find the lane opponent name efficiently FIRST before calling this
    # So we move this call to AFTER the participant loop
    meta_context = "" # Placeholder
    
    # --- 1. Team Context ---
    your_team_id = self_p.get("team_id")
    your_team = []
    enemy_team = []
    lane_opponent_str = None
    lane_opponent_name = None
    
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
                lane_opponent_str = f"{p_name} ({p_kda})"
                lane_opponent_name = p_name

    # Now fetch meta with known opponent
    meta_context = _fetch_meta_context(champion, role, vs_champion=lane_opponent_name)

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
You are a **High-Elo League of Legends Analyst & Educator**.
Your job is to provide constructive, deep insights into *why* the game resulted in a win or loss.
**TONE**: Professional, Encouraging, but Fact-Based. Avoid vague fluff ("In a challenging match..."). 
Instead, explain the interaction between items, champions, and game state.

**Match Context**:
- Result: {result}
- Champion: {champion} ({role})
- KDA: {kda}
- Duration: {match_data.get("game_duration", 0) // 60} minutes
    - Lane Opponent: {lane_opponent_str or "Unknown"}

**Meta Data (Live Winrates)**:
{meta_context}

**Your Goal**:
Analyze this game holistically. We are not just analyzing the gameplay, but the **Draft**, the **Pick**, and the **Build**.

**Champion Pool Context (Top Champs)**:
{chr(10).join([f"- {x}" for x in champion_pool])}

**CRITICAL**: You must cross-reference your advice with the **Meta Data** above.
- The Meta Data comes from a live Lolalytics scrape. It is the GROUND TRUTH for the current patch.
- **NEVER** recommend removed runes (e.g., **Predator**, **Lethal Tempo**). If in doubt, use the 'Core Keystone' from the Meta Data.
- **NEVER** recommend removed items (e.g., **Divine Sunderer**, **Galeforce**, **Everfrost**).
- **ALWAYS** start your build recommendation with the 'Core Build' listed in the Meta Data. Only deviate if the enemy comp demands it (e.g. Anti-Heal), but explain why.

**Deep Dive Analysis Required**:

1. **Draft Warfare (Team Comps)**:
   - Categorize both teams (e.g. "Poke Heavy", "Dive Comp", "Scaling").
   - **Win Condition**: Who *should* win on paper? Why?

2. **Smart Pick Critique (Identity)**:
   - Given the Enemy Team and the available **Champion Pool**, was {champion} the best pick?
   - If NO, which champion from their pool would have been better?
   - If their pool has a hole, **Recommend ONE new champion** to learn that covers this specific weakness.

3. **Smart Itemization Engine**:
   - Synthesize the **Objective Best Build** for this specific game state.
   - Combine the **Lolalytics Meta Trio** (Baseline) with **Necessary Adaptations** (e.g. anti-heal vs Soraka, Serpent's Fang vs multiple shields).
   - List the 5-6 item final build.

4. **Gameplay Root Cause**:
   - Identify the primary in-game reason for the result (Macro, Vision, Mechanics).



**Data**:

### Your Team
{chr(10).join([f"- {x}" for x in your_team])}

### Enemy Team
{chr(10).join([f"- {x}" for x in enemy_team])}

### Timeline Events (Items, Kills, Objectives, Location)
{timeline_str}

### Output Format
Return a **valid JSON object** with the following keys. Each value must be a Markdown string.

{{{{
  "draft_analysis": "Markdown. **Draft & Win Condition**. Analyze team comps. Who has the edge? Why?",
  "pick_quality": "Markdown. **Pick Critique**. Was {champion} the best choice from their pool? If not, who? If pool is lacking, suggest a **New Champion** to learn.",
  "story": "Markdown string. **The Turning Point**. What decided the game?",
  "ideal_build": "Markdown. **Objective Best Build**. List the specific items associated with the highest winrate for this scenario.",
  "build_vision": "Markdown string. **Build Critique**. Compare their actual build to the Ideal Build. Explain WHY the ideal items are better in this specific match.",
  "mistakes": "Markdown string. **Critical Mistakes & Bad Habits**. Two parts: 1) What specifically lost THIS game? 2) What 'Silent Killer' mistakes did they make (e.g. facechecking) that they didn't get punished for this time, but will hurt their climb?",
  "verdict": "Markdown string. **Final Verdict**. One sentence summary."
}}}}

**Formatting Guidelines (CRITICAL)**:
- **EXTREMELY CONCISE**. fit in small cards.
- **Bullet points ONLY** where possible.
- Max 2-3 short bullet points per section.
- NO intro/outro fluff. Go straight to the point.
"""
    return prompt.strip()


def analyze_specific_game(match_id: str, full_match_data: Dict[str, Any], champion_pool: List[str] = []) -> Dict[str, str]:
    """
    Run a deep-dive analysis on a single game using OpenAI.
    Returns a structured dict with keys: story, mistakes, build_vision, verdict.
    """
    if not full_match_data:
        return {"story": "Error: No match data provided.", "mistakes": "", "build_vision": "", "verdict": ""}
        
    prompt = _build_single_game_prompt(full_match_data, champion_pool=champion_pool)
    
    # --- Caching Strategy ---
    prompt_hash = hashlib.md5(prompt.encode("utf-8")).hexdigest()
    # Include match_id in filename for easier manual inspection if needed
    cache_file = CACHE_DIR / f"game_{match_id}_{prompt_hash}.json"

    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                print(f"   [AI] Game Cache Hit! Loading {cache_file.name}")
                return json.load(f)
        except Exception:
            pass

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"story": "Error: OPENAI_API_KEY not set.", "mistakes": "", "build_vision": "", "verdict": ""}
        
    client = OpenAI(api_key=api_key)
    # Use the flagship model for deep dives
    model_name = _get_deep_dive_model_name()
    
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
        
        result = {}
        if data:
            result = {
                "draft_analysis": data.get("draft_analysis", ""),
                "pick_quality": data.get("pick_quality", ""),
                "story": data.get("story", text),
                "ideal_build": data.get("ideal_build", ""),
                "build_vision": data.get("build_vision", ""),
                "mistakes": data.get("mistakes", ""),
                "verdict": data.get("verdict", "")
            }
        else:
            # Fallback if no JSON found
            return {
                "draft_analysis": "",
                "pick_quality": "",
                "story": "", 
                "mistakes": "", 
                "ideal_build": "",
                "build_vision": "", 
                "verdict": ""
            }

        # Save to cache
        try:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
        except Exception as e:
            print(f"[AI] Error saving game cache: {e}")
            
        return result
            
    except Exception as e:
        return {
            "draft_analysis": f"Error calling OpenAI: {e}",
            "pick_quality": "",
            "story": "",
            "ideal_build": "",
            "mistakes": "",
            "build_vision": "",
            "verdict": ""
        }

    if not coaching_text:
        return {
            "draft_analysis": "Error: Empty response",
            "pick_quality": "",
            "story": "",
            "ideal_build": "",
            "mistakes": "",
            "build_vision": "",
            "verdict": ""
        }
