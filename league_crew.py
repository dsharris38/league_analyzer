# league_crew.py

import os
import json
from typing import Any, Dict

import google.generativeai as genai


def _get_gemini_model_name() -> str:
    """
    Get the Gemini model name from the environment, with a safe default.

    You *must* set GEMINI_MODEL_NAME in your .env to a valid model string
    for your google-generativeai version, e.g.:

      GEMINI_MODEL_NAME=gemini-2.5-flash

    If it's missing, we fall back to "gemini-2.5-flash".
    """
    return os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")


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
  "overview": "Markdown string. 2-4 paragraphs summarizing the player's identity, strengths, weaknesses, and main bottleneck (macro/micro/consistency).",
  "champion_feedback": "Markdown string. Specific advice for their most played champions. Discuss laning goals, power spikes, and mechanics. If available, use champion_profiles.",
  "itemization_tips": "Markdown string. Concrete itemization and rune advice based on their build patterns and the current patch. Discuss when to build what.",
  "goals": "Markdown string. A numbered list of 5-10 concrete, measurable drills or goals for the next 1-2 weeks."
}}}}

**REMINDER**: Start your response with {{{{ immediately. No preamble, no explanation, no code blocks.
"""
    return prompt.strip()


def call_league_crew(agent_payload: Dict[str, Any]) -> Dict[str, str]:
    """
    Call Gemini once with a multi-agent-style prompt and return the coaching dict.

    `agent_payload` should be the Python dict corresponding to the JSON you print
    between BEGIN/END LEAGUE ANALYZER JSON in main.py.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Please add it to your .env or environment."
        )

    genai.configure(api_key=api_key)

    model_name = _get_gemini_model_name()
    model = genai.GenerativeModel(model_name)
    # Force JSON response if supported by the model/lib version, otherwise we rely on prompt engineering
    # generation_config = {"response_mime_type": "application/json"} 
    
    prompt = _build_crew_prompt(agent_payload)

    try:
        response = model.generate_content(prompt)
        coaching_text = getattr(response, "text", "") or ""
        coaching_text = coaching_text.strip()
    except Exception as e:
        return {
            "overview": f"Error calling Gemini: {e}",
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

    # Attempt to parse JSON
    # Sometimes models wrap JSON in ```json ... ``` or add text before the JSON
    cleaned_text = coaching_text
    
    # Try to extract JSON from markdown code blocks
    if "```json" in cleaned_text:
        # Find the first ```json block
        parts = cleaned_text.split("```json", 1)
        if len(parts) > 1:
            # Get everything after ```json
            after_start = parts[1]
            # Find the closing ```
            if "```" in after_start:
                cleaned_text = after_start.split("```", 1)[0].strip()
    elif "```" in cleaned_text:
        # Generic code block
        parts = cleaned_text.split("```", 2)
        if len(parts) >= 3:
            cleaned_text = parts[1].strip()
    
    # Try to find JSON object boundaries if no code blocks
    if not cleaned_text.startswith("{"):
        # Look for the first { and last }
        start_idx = cleaned_text.find("{")
        end_idx = cleaned_text.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned_text = cleaned_text[start_idx:end_idx+1]

    try:
        coaching_json = json.loads(cleaned_text)
        if not isinstance(coaching_json, dict):
            raise ValueError("Response is not a JSON object")
        
        # Ensure all required keys exist
        required_keys = ["overview", "champion_feedback", "itemization_tips", "goals"]
        for key in required_keys:
            if key not in coaching_json:
                coaching_json[key] = ""
        
        return coaching_json
    except Exception as e:
        # Fallback: treat the whole text as overview
        return {
            "overview": f"**Parsing Error**: Could not extract structured coaching report. Raw response:\n\n{coaching_text[:500]}...",
            "champion_feedback": "",
            "itemization_tips": "",
            "goals": ""
        }
