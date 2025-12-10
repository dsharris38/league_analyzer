from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List
from concurrent.futures import ThreadPoolExecutor, as_completed

from rich.console import Console
from rich.table import Table

from riot_client import RiotClient
from analyzer import analyze_matches
from timeline_analyzer import classify_loss_reason, analyze_timeline_movement
from league_crew import call_league_crew, classify_matches_and_identify_candidates
from coach_data_enricher import enrich_coaching_data
from champion_profile_helper import load_champion_profiles, attach_champion_profiles


console = Console()

SCRIPT_DIR = Path(__file__).resolve().parent
SAVE_DIR = SCRIPT_DIR / "saves"
SAVE_DIR.mkdir(parents=True, exist_ok=True)


def print_human_summary(
    analysis: Dict[str, Any],
    timeline_loss_diagnostics: List[Dict[str, Any]],
) -> None:
    """Pretty, human-readable console output.

    This is mainly for quick CLI feedback. The dashboard uses the
    structured JSON saved at the end of main().
    """
    summary = analysis.get("summary", {})
    per_champion = analysis.get("per_champion", [])
    loss_patterns = analysis.get("loss_patterns", [])
    baseline = analysis.get("baseline_comparison", {})
    you_vs_team = analysis.get("you_vs_team", {})

    # --- Performance Summary table ---
    summary_table = Table(title="Performance Summary (Recent Games)")
    summary_table.add_column("Stat")
    summary_table.add_column("Value")

    games = summary.get("games", 0)
    wins = summary.get("wins", 0)
    losses = summary.get("losses", 0)
    winrate = summary.get("winrate", 0.0)
    avg_kda = summary.get("avg_kda", 0.0)
    avg_dmg_share = summary.get("avg_damage_share", 0.0)
    avg_gold_share = summary.get("avg_gold_share", 0.0)
    avg_cs = summary.get("avg_cs_per_min", 0.0)
    avg_kp = summary.get("avg_kp", 0.0)

    summary_table.add_row("Games", str(games))
    summary_table.add_row("Wins", str(wins))
    summary_table.add_row("Losses", str(losses))
    summary_table.add_row("Winrate", f"{winrate * 100:.1f}%")
    summary_table.add_row("Avg KDA", f"{avg_kda:.2f}")
    summary_table.add_row("Avg Damage Share", f"{avg_dmg_share * 100:.1f}%")
    summary_table.add_row("Avg Gold Share", f"{avg_gold_share * 100:.1f}%")
    summary_table.add_row("Avg CS / min", f"{avg_cs:.2f}")
    summary_table.add_row("Avg Kill Participation", f"{avg_kp * 100:.1f}%")

    console.print()
    console.print(summary_table)

    # --- Per-champion stats ---
    if per_champion:
        champ_table = Table(title="Per-Champion Stats (3+ games)")
        champ_table.add_column("Champion")
        champ_table.add_column("Games", justify="right")
        champ_table.add_column("Winrate", justify="right")
        champ_table.add_column("Avg KDA", justify="right")
        champ_table.add_column("CS/min", justify="right")
        champ_table.add_column("Dmg Share", justify="right")
        champ_table.add_column("KP", justify="right")

        for pc in per_champion:
            champ_table.add_row(
                pc.get("champion", "?"),
                str(pc.get("games", 0)),
                f"{pc.get('winrate', 0) * 100:.1f}%",
                f"{pc.get('avg_kda', 0):.2f}",
                f"{pc.get('cs_per_min', 0):.2f}",
                f"{pc.get('dmg_share', 0) * 100:.1f}%",
                f"{pc.get('avg_kp', 0) * 100:.1f}%",
            )

        console.print()
        console.print(champ_table)

    # --- Baseline comparison ---
    if baseline:
        base_table = Table(title="Diamond/Master Baseline Comparison")
        base_table.add_column("Metric")
        base_table.add_column("Your Value")
        base_table.add_column("Baseline")
        base_table.add_column("Status")

        mapping = [
            ("avg_cs_per_min", "CS / min"),
            ("avg_damage_share", "Damage Share"),
            ("avg_kda", "KDA"),
            ("avg_kp", "Kill Participation"),
        ]
        for key, label in mapping:
            if key not in baseline:
                continue
            entry = baseline[key]
            your_val = entry.get("your_value")
            base_val = entry.get("baseline")
            status = entry.get("status", "")
            if key in ("avg_damage_share", "avg_kp"):
                your_str = f"{your_val * 100:.1f}%"
                base_str = f"{base_val * 100:.1f}%"
            else:
                your_str = f"{your_val:.2f}"
                base_str = f"{base_val:.2f}"
            base_table.add_row(label, your_str, base_str, status)

        console.print()
        console.print(base_table)

    # --- Common loss patterns ---
    if loss_patterns:
        lp_table = Table(title="Common Loss Patterns")
        lp_table.add_column("Reason")
        lp_table.add_column("# Losses", justify="right")
        lp_table.add_column("% of Losses", justify="right")

        for lp in loss_patterns:
            lp_table.add_row(
                lp.get("reason", ""),
                str(lp.get("count", 0)),
                f"{lp.get('percent', 0) * 100:.0f}%",
            )

        console.print()
        console.print(lp_table)

    # --- You vs Team ---
    if you_vs_team:
        console.print("[bold]Big Picture: Is it you or your team?[/bold]")
        classification = you_vs_team.get("classification", "").strip()
        if classification:
            console.print(classification)
        if "overall_index" in you_vs_team and "losses_index" in you_vs_team:
            console.print(
                f"[dim]Internal responsibility index (overall): "
                f"{you_vs_team['overall_index']:+.2f}[/dim]"
            )
            console.print(
                f"[dim]Internal responsibility index (losses): "
                f"{you_vs_team['losses_index']:+.2f} "
                f"(higher = you often outperform team in losses).[/dim]"
            )
    else:
        console.print("No 'you vs team' data available.")

    console.print(
        "[dim]Section above is for you as a human player. "
        "The JSON payload (and dashboard) below is for the AI coach and visuals.[/dim]"
    )


def run_analysis_pipeline(
    riot_id: str,
    match_count: int = 20,
    use_timeline: bool = True,
    call_ai: bool = True,
    save_json: bool = True,
    open_dashboard: bool = False,
) -> Dict[str, Any]:
    """
    Programmatic entry point for the analysis pipeline.
    Returns the final agent_payload dictionary.
    """
    if "#" not in riot_id:
        raise ValueError("Invalid Riot ID format. Use Name#TAG.")

    game_name, tag_line = riot_id.split("#", 1)
    client = RiotClient()

    console.print("[bold]Looking up account...[/bold]")
    try:
        account = client.get_account_by_riot_id(game_name, tag_line)
    except Exception as e:
        msg = f"Failed to find account '{riot_id}'. Error: {e}"
        console.print(f"[red]{msg}[/red]")
        return {"error": msg}

    puuid = account["puuid"]
    console.print(
        f"Found account for [green]{account['gameName']}#{account['tagLine']}[/green]"
    )

    # Fetch Summoner Info (Level, Profile Icon) & Rank
    summoner = {}
    league_entries = []
    try:
        console.print("[bold]Fetching summoner profile...[/bold]")
        summoner = client.get_summoner_by_puuid(puuid)
        
        # Fetch League Info (Rank, LP)
        console.print("[bold]Fetching rank data...[/bold]")
        if "id" in summoner:
            league_entries = client.get_league_entries(summoner["id"])
            console.print(f"[dim]Debug: Found {len(league_entries)} league entries.[/dim]")
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to fetch summoner/rank data: {e}[/yellow]")
        # Non-critical, continue

    console.print(f"[bold]Fetching last {match_count} ranked matches...[/bold]")
    try:
        match_ids = client.get_recent_match_ids(puuid, match_count)
    except Exception as e:
        msg = f"Failed to fetch match IDs: {e}"
        console.print(f"[red]{msg}[/red]")
        return {"error": msg}
        
    console.print(f"Retrieved {len(match_ids)} match IDs.")

    matches: List[Dict[str, Any]] = []
    # Parallel Fetching of Matches
    matches: List[Dict[str, Any]] = [None] * len(match_ids)
    
    def fetch_match_safe(idx, m_id):
        try:
            return idx, client.get_match(m_id)
        except Exception as e:
            return idx, None

    # Use ThreadPoolExecutor for parallel fetching
    # Reduced to 3 workers to prevent OOM on small instances (Render free tier)
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(fetch_match_safe, i, mid): mid for i, mid in enumerate(match_ids)}
        for future in as_completed(futures):
            idx, match_data = future.result()
            matches[idx] = match_data
            console.print(f"Fetched match {idx+1}/{len(match_ids)}")

    # Filter out failed fetches
    matches = [m for m in matches if m is not None]

    if not matches:
        return {"error": "No matches found or all match fetches failed."}

    console.print("[bold]Analyzing your performance...[/bold]")
    try:
        base_analysis = analyze_matches(matches, puuid)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"Analysis failed: {e}"}

    if "error" in base_analysis:
        console.print(f"[red]{base_analysis['error']}[/red]")
        return base_analysis

    timeline_loss_diagnostics: List[Dict[str, Any]] = []
    movement_summaries: List[Dict[str, Any]] = []

    if use_timeline:
        console.print("[bold]Fetching timelines and analyzing movement... (Parallel)[/bold]")
        
        def process_timeline(idx, m_id, m_data):
            # Fetch timeline
            try:
                tl = client.get_match_timeline(m_id)
            except Exception as e:
                console.print(f"[yellow]Failed to fetch timeline for {m_id}: {e}[/yellow]")
                return None, None

            # Loss Analysis
            l_diag = None
            try:
                l_diag = classify_loss_reason(m_data, tl, puuid)
                if l_diag:
                    l_diag = {"match_id": m_id, **l_diag}
            except Exception:
                pass

            # Movement Analysis
            mov = None
            try:
                mov = analyze_timeline_movement(m_data, tl, puuid)
                if mov:
                    mov = {"match_id": m_id, **mov}
            except Exception:
                pass
                
            return l_diag, mov

        with ThreadPoolExecutor(max_workers=5) as executor:
            # zip matches with ids carefully (matches list aligns if we didn't filter? 
            # Wait, we filtered matches. We need to realign with match_ids.
            # Actually, `matches` objects contain metadata including matchId usually, 
            # but let's rely on the metadata inside specific match object or just be careful.)
            
            # Re-map matches to IDs.
            # matches is a list of dicts. matches[i]['metadata']['matchId'] usually exists.
            
            valid_tasks = []
            for m in matches:
                mid = m['metadata']['matchId']
                valid_tasks.append((mid, m))
            
            futures = [executor.submit(process_timeline, i, mid, m) for i, (mid, m) in enumerate(valid_tasks)]
            
            for future in as_completed(futures):
                l_diag, mov = future.result()
                if l_diag:
                    timeline_loss_diagnostics.append(l_diag)
                if mov:
                    movement_summaries.append(mov)
                    
        console.print(f"Processed {len(movement_summaries)} timelines.")

    # Enrich analysis with macro, comp, and itemization data
    analysis = enrich_coaching_data(
        matches=matches,
        match_ids=match_ids,
        puuid=puuid,
        analysis=base_analysis,
        timeline_loss_diagnostics=timeline_loss_diagnostics,
        movement_summaries=movement_summaries,
    )
    
    # Identify review candidates and classify matches
    review_candidates, match_tags = classify_matches_and_identify_candidates(analysis)
    analysis["review_candidates"] = review_candidates
    
    # Inject tags into detailed_matches for frontend
    if "detailed_matches" in analysis:
        for dm in analysis["detailed_matches"]:
            mid = dm.get("match_id")
            if mid in match_tags:
                dm["tags"] = match_tags[mid]

    # First: human section (uses enriched analysis where available)
    print_human_summary(analysis, timeline_loss_diagnostics)

    # Second: AI section – structured JSON payload
    summary = analysis.get("summary", {})
    agent_payload: Dict[str, Any] = {
        "schema_version": "C-enriched-1",
        "riot_id": riot_id,
        "game_name": account.get("gameName", game_name),
        "tag_line": account.get("tagLine", tag_line),
        "riot_id": riot_id,
        "game_name": account.get("gameName", game_name),
        "tag_line": account.get("tagLine", tag_line),
        "puuid": puuid,
        "summoner_info": {
            "level": summoner.get("summonerLevel", 0),
            "profile_icon_id": summoner.get("profileIconId", 0),
            "id": summoner.get("id", "")
        },
        "rank_info": league_entries,
        "match_count_requested": match_count,
        "match_ids": match_ids,
        "analysis": analysis,
        "timeline_loss_diagnostics": timeline_loss_diagnostics,
        "movement_summaries": movement_summaries,
        "meta": {
            "intended_role_focus": summary.get("primary_role", "FLEX"),
            "player_self_reported_rank": summary.get(
                "self_reported_rank", "Unknown"
            ),
            "notes_for_coach": (
                "Provide champion pool advice, itemization/runes guidance, and "
                "phase-of-game coaching (lane, mid game, late game) for my main "
                "champs in this role and similar picks."
            ),
        },
    }

    # Champion-aware coaching metadata
    try:
        profiles = load_champion_profiles()
        agent_payload = attach_champion_profiles(agent_payload, analysis, profiles)
    except Exception as e:  # noqa: BLE001
        console.print(
            f"[yellow]Warning: failed to attach champion profiles: {e}[/yellow]"
        )

    console.print(
        "[bold magenta]===== AI Coaching Payload (JSON) =====[/bold magenta]"
    )
    console.print(
        "This is the JSON the dashboard app reads and the League Coach crew uses."
    )
    # console.print("----- BEGIN LEAGUE ANALYZER JSON -----")
    # console.print(json.dumps(agent_payload, indent=2))
    # console.print("----- END LEAGUE ANALYZER JSON -----")

    # Optional: call the multi-agent League Coach crew (Gemini)
    if call_ai:
        console.print("Contacting League Coach Crew (Gemini)...")
        try:
            coaching_report = call_league_crew(agent_payload)
            
            if isinstance(coaching_report, dict):
                console.print("\n[bold]Coaching Overview:[/bold]")
                console.print(coaching_report.get("overview", "No overview provided."))
            else:
                console.print(coaching_report)

            # Embed the coaching report into the payload
            agent_payload["coaching_report"] = coaching_report
            # Legacy support: if it's a string, also put it here
            if isinstance(coaching_report, str):
                agent_payload["coaching_report_markdown"] = coaching_report
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]Failed to call League Coach Crew: {e}[/red]")

    # Save JSON for dashboard usage (into saves/ folder)
    if save_json:
        safe_riot_id = riot_id.replace("#", "_")
        filename = SAVE_DIR / f"league_analysis_{safe_riot_id}.json"
        try:
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(agent_payload, f, indent=2)
            console.print(f"[green]Saved JSON to {filename}[/green]")

            if open_dashboard:
                import webbrowser
                webbrowser.open("http://localhost:5173")
                console.print("[green]Opening dashboard in browser...[/green]")

        except Exception as e:  # noqa: BLE001
            console.print(f"[red]Failed to save JSON: {e}[/red]")

    return agent_payload


def main() -> None:
    console.print("[bold cyan]League Personal Analyzer[/bold cyan]")

    riot_id = console.input("Enter your Riot ID (e.g. SomeName#TAG): ").strip()
    if "#" not in riot_id:
        console.print("[red]Invalid Riot ID format. Use Name#TAG.[/red]")
        return

    match_count_str = console.input(
        "How many recent ranked games should I analyze? [default 20, max 50]: "
    ).strip()
    match_count = 20
    if match_count_str.isdigit():
        match_count = max(1, min(50, int(match_count_str)))

    # Ask whether to fetch timelines & movement diagnostics
    use_timeline = (
        console.input(
            "Fetch timelines & advanced movement diagnostics? [y/N]: "
        )
        .strip()
        .lower()
        == "y"
    )

    # Ask about AI Coach
    call_ai = (
        console.input(
            "Call the multi-agent League Coach crew now? [Y/n]: "
        )
        .strip()
        .lower()
        == "y"
    )

    # Ask about saving
    save_json = (
        console.input(
            "Save analyzer JSON (including coaching report, if any) for the dashboard? [Y/n]: "
        )
        .strip()
        .lower()
        == "y"
    )

    # Ask about opening dashboard
    open_dashboard = False
    if save_json:
        open_dashboard = (
            console.input(
                "Open the web dashboard now? [Y/n]: "
            )
            .strip()
            .lower()
            == "y"
        )

    try:
        run_analysis_pipeline(
            riot_id=riot_id,
            match_count=match_count,
            use_timeline=use_timeline,
            call_ai=call_ai,
            save_json=save_json,
            open_dashboard=open_dashboard,
        )
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


if __name__ == "__main__":
    main()
