from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List
from concurrent.futures import ThreadPoolExecutor, as_completed

from rich.console import Console
from rich.table import Table


from riot_client import RiotClient
from analyzer import analyze_matches, calculate_season_stats_from_db
from timeline_analyzer import classify_loss_reason, analyze_timeline_movement
from league_crew import call_league_crew, classify_matches_and_identify_candidates
from coach_data_enricher import enrich_coaching_data
from champion_profile_helper import load_champion_profiles, attach_champion_profiles
from stats_scraper import get_past_ranks

console = Console()

SCRIPT_DIR = Path(__file__).resolve().parent
SAVE_DIR = SCRIPT_DIR / "saves"
SAVE_DIR.mkdir(parents=True, exist_ok=True)




def backfill_match_history(puuid: str, region: str):
    """
    Background task to fetch up to 1000 matches for season stats.
    Only fetches matching IDs that are NOT in the database.
    """
    try:
        import time
        from riot_client import RiotClient
        from database import Database
        
        # 1. Setup
        client = RiotClient()
        db = Database()
        
        # 2. Get 1000 IDs (Fast)
        all_ids = client.get_recent_match_ids(puuid, count=1000)
        
        # 3. Check what we have (O(1) lookups via id index)
        cached_map = db.get_matches_bulk(all_ids) 
        missing_ids = [mid for mid in all_ids if mid not in cached_map]
        
        if not missing_ids:
            return

        console.print(f"[dim][Backfill] Found {len(missing_ids)} missing matches. Fetching in background...[/dim]")
        
        # 4. Fetch Missing (Sequential to be polite in background)
        for i, mid in enumerate(missing_ids):
            try:
                m_data = client.get_match(mid)
                if m_data:
                    db.save_match(m_data)
                # Sleep slightly to avoid rate limits if running long
                if i % 10 == 0:
                    time.sleep(0.5)
            except Exception:
                pass
                
    except Exception as e:
        console.print(f"[yellow][Backfill] Error: {e}[/yellow]")





def get_cached_past_ranks(puuid: str, game_name: str, tag_line: str, region: str) -> List[Dict[str, str]]:
    """Fetch past ranks with caching to avoid re-scraping static data."""
    cache_file = SAVE_DIR / f"cache_past_ranks_{puuid}.json"
    
    # Try to load from cache
    if cache_file.exists():
        try:
            with open(cache_file, "r") as f:
                data = json.load(f)
                if data: # valid data
                    return data
        except Exception:
            pass # ignore errors, re-fetch
            
    # Fetch fresh
    ranks = get_past_ranks(game_name, tag_line, region)
    
    # Save to cache if we found data
    if ranks:
        try:
            with open(cache_file, "w") as f:
                json.dump(ranks, f)
        except Exception as e:
            console.print(f"[yellow]Warning: Could not save cache: {e}[/yellow]")
            
    return ranks

def cleanup_local_cache_files(days: int = 90):
    """Delete local cache files (AI prompts) older than X days."""
    import time
    cache_dir = SCRIPT_DIR / "saves" / "cache"
    if not cache_dir.exists():
        return
        
    cutoff = time.time() - (days * 86400)
    count = 0
    try:
        for f in cache_dir.glob("*.json"):
            if f.stat().st_mtime < cutoff:
                f.unlink()
                count += 1
        if count > 0:
            console.print(f"[dim]Cleaned up {count} old AI cache files.[/dim]")
    except Exception as e:
        console.print(f"[yellow]Warning: Cache cleanup failed: {e}[/yellow]")



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
    match_count: int = 100,
    use_timeline: bool = True,
    call_ai: bool = True,
    save_json: bool = True,
    open_dashboard: bool = False,
    region_key: str = "NA",
    puuid: str = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """
    Programmatic entry point for the analysis pipeline.
    Returns the final agent_payload dictionary.
    """
    import time
    
    def log_debug(msg):
        try:
            with open("backend_debug.txt", "a") as f:
                f.write(f"[MAIN-PY] {msg}\n")
        except:
            pass

    t_start = time.time()
    log_debug(f"Pipeline Start for {riot_id} (AI={call_ai}, Region={region_key})")
    # console.print(f"[cyan]TIMING: Pipeline Start[/cyan]")

    client = RiotClient(region_key=region_key)

    # 1. Resolve Riot ID from PUUID if provided (Robust Navigation)
    if puuid:
        try:
            acc = client.get_account_by_puuid(puuid)
            raw_name = acc.get("gameName", "Unknown")
            raw_tag = acc.get("tagLine", "NA1")
            riot_id = f"{raw_name}#{raw_tag}"
            console.print(f"[green]Resolved PUUID to Riot ID: {riot_id}[/green]")
        except Exception as e:
            console.print(f"[yellow]Warning: Failed to resolve PUUID to Riot ID: {e}[/yellow]")
            # Fallthrough to existing riot_id string usage

    riot_id = riot_id.strip()
    
    # Handle missing '#' by inferring from last space (common issue with some inputs/encodings)
    if "#" not in riot_id:
        if " " in riot_id:
            # Assume "Name Tag" format
            parts = riot_id.rsplit(" ", 1)
            game_name = parts[0].strip()
            tag_line = parts[1].strip()
            # Reconstruct standard ID
            riot_id = f"{game_name}#{tag_line}"
            console.print(f"[yellow]Warning: Riot ID missing '#'. inferred from space: {riot_id}[/yellow]")
        else:
            msg = "Invalid Riot ID format. Use Name#TAG."
            if puuid: 
                msg += f" (Also failed to resolve PUUID: {puuid})"
            raise ValueError(msg)
    else:
        game_name, tag_line = riot_id.split("#", 1)
        game_name = game_name.strip()
        tag_line = tag_line.strip()
    # client already instantiated above
    safe_riot_id = riot_id.replace("#", "_")
    account_cache_file = SAVE_DIR / f"cache_account_{safe_riot_id}.json"

    account = None
    summoner = None
    
    # Try loading cached account/summoner data to speed up repeated runs
    if account_cache_file.exists() and not force_refresh:
        try:
            with open(account_cache_file, "r") as f:
                cached_data = json.load(f)
                account = cached_data.get("account")
                summoner = cached_data.get("summoner")
                console.print(f"[dim]Loaded cached account info for {riot_id}[/dim]")
        except Exception:
            pass

    # --- SMART RESUME START ---
    # If we are asked to call AI, check if we already have the raw stats in DB.
    # This allows the frontend to split the request: 
    # 1. Get Stats (Fast) 
    # 2. MATCH HISTORY
    with open("backend_debug.txt", "a") as f:
        f.write(f"[DEBUG] Pipeline Step: Fetching Match History...\n")
    if call_ai:
        from database import Database
        with open("backend_debug.txt", "a") as f: f.write(f"[DEBUG] Init Database...\n")
        db = Database()
        with open("backend_debug.txt", "a") as f: f.write(f"[DEBUG] DB Init Done. Checking existing analysis...\n")
        existing_doc = db.get_analysis(riot_id)
        with open("backend_debug.txt", "a") as f: f.write(f"[DEBUG] Existing analysis check done. Found: {bool(existing_doc)}\n")
        
        # We resume if:
        # 1. We have a doc
        # 2. It has 'analysis' (stats computed)
        # 3. It DOES NOT have 'coaching_report' (or we want to re-run AI?)
        # For now, we assume if call_ai=True and doc exists, we want to add AI to it.
        # Validate existing_doc freshness (Fix for Unknown roles)
        if existing_doc and "analysis" in existing_doc:
             dm = existing_doc["analysis"].get("detailed_matches", [])
             # If we have matches but the first one lacks a valid role, assume stale cache
             if dm and (not dm[0].get("role") or dm[0].get("role") == "Unknown"):
                 console.print(f"[yellow]SMART RESUME: Found existing analysis but it has valid role data (Stale Cache). Forcing refresh.[/yellow]")
                 existing_doc = None

        if existing_doc and "analysis" in existing_doc and not force_refresh:
            console.print(f"[bold green]SMART RESUME: Found existing stats for {riot_id}. Skipping match fetch, jumping to AI.[/bold green]")
            agent_payload = existing_doc
            
            # Ensure AI loading flag is set
            agent_payload["ai_loading"] = True
            
            # --- JUMP TO AI EXECUTION ---
            # Code structure makes jumping hard without refactoring.
            # We will return early by running the AI part here and returning.
            # Ideally we refactor `call_league_crew` block into a function, but for now we copy the block pattern.
            
            console.print("Contacting League Coach Crew (Gemini - may take 10-30s)...")
            try:
                coaching_report = call_league_crew(agent_payload)
                
                if isinstance(coaching_report, dict):
                    console.print("\n[bold]Coaching Overview:[/bold]")
                    console.print(coaching_report.get("overview", "No overview provided."))
                else:
                    console.print(coaching_report)

                # Embed the coaching report into the payload
                agent_payload["coaching_report"] = coaching_report
                if isinstance(coaching_report, str):
                    agent_payload["coaching_report_markdown"] = coaching_report
            except Exception as e:
                console.print(f"[red]Failed to call League Coach Crew: {e}[/red]")
                
            agent_payload["ai_loading"] = False
            
            # Final Save
            if save_json:
                db.save_analysis(agent_payload)
                console.print(f"[green]STAGE 2: Saved Smart Resume Analysis to MongoDB[/green]")
                
            return agent_payload
    # --- SMART RESUME END ---

    # If missing, fetch fresh
    if not account or not summoner:
        # console.print(f"[bold]Looking up account on {region_key} (Routing: {client.region})...[/bold]")
        try:
            with open("backend_debug.txt", "a") as f: f.write(f"[DEBUG] Fetching account from Riot...\n")
            account = client.get_account_by_riot_id(game_name, tag_line)
            with open("backend_debug.txt", "a") as f: f.write(f"[DEBUG] Account fetched. Fetching Summoner...\n")
            puuid = account["puuid"]
            
            console.print("[bold]Fetching summoner profile...[/bold]")
            try:
                summoner = client.get_summoner_by_puuid(puuid)
            except Exception as e:
                if "404" in str(e):
                    # Account exists (globally) but not on this region
                    raise ValueError(f"Account found for '{riot_id}', but no Summoner profile on region '{region_key}'. Please check the region (currently {region_key}).")
                raise e
            
            # Save to cache
            with open(account_cache_file, "w") as f:
                json.dump({"account": account, "summoner": summoner}, f)
                
        except Exception as e:
            msg = f"Failed to find account '{riot_id}'. Error: {e}"
            console.print(f"[red]{msg}[/red]")
            return {"error": msg}
    
    puuid = account["puuid"]
    console.print(
        f"Found account for [green]{account['gameName']}#{account['tagLine']}[/green]"
    )

    # Fetch League Info (Rank, LP) - Always fetch fresh as this changes often
    league_entries = []
    try:
        console.print("[bold]Fetching rank data...[/bold]")
        league_entries = client.get_league_entries(puuid)
        console.print(f"[dim]Debug: Found {len(league_entries)} league entries.[/dim]")
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to fetch rank data: {e}[/yellow]")
        console.print("[yellow]Hint: Check your PLATFORM setting in .env (e.g. 'na1', 'euw1') if you are in a non-default region.[/yellow]")

    # console.print(f"[bold]Fetching last {match_count} ranked matches...[/bold]")
    try:
        with open("backend_debug.txt", "a") as f: f.write(f"[DEBUG] Fetching Match IDs...\n")
        match_ids = client.get_recent_match_ids(puuid, match_count, queue=420)
        with open("backend_debug.txt", "a") as f: f.write(f"[DEBUG] Match IDs fetched: {len(match_ids)}\n")
    except Exception as e:
        msg = f"Failed to fetch match IDs: {e}"
        console.print(f"[red]{msg}[/red]")
        return {"error": msg}
        
    console.print(f"Retrieved {len(match_ids)} match IDs.")
    
    t_ids = time.time()
    console.print(f"[cyan]TIMING: ID Fetch took {t_ids - t_start:.2f}s[/cyan]")

    matches: List[Dict[str, Any]] = []
    # Parallel Fetching of Matches
    matches: List[Dict[str, Any]] = [None] * len(match_ids)
    
    # Initialize DB for caching matches
    from database import Database
    db = Database()

    # 1. BULK FETCH from Cache (Optimization)
    console.print(f"[dim]Checking cache for {len(match_ids)} matches...[/dim]")
    cached_matches_map = db.get_matches_bulk(match_ids)
    console.print(f"Found {len(cached_matches_map)} matches in cache.")
    
    t_bulk = time.time()
    console.print(f"[cyan]TIMING: Bulk DB Fetch took {t_bulk - t_ids:.2f}s[/cyan]")

    # 2. Parallel Fetch for MISSING matches
    matches = [None] * len(match_ids)
    missing_ids = [mid for mid in match_ids if mid not in cached_matches_map]
    fetched_map = {}

    if missing_ids:
        console.print(f"[bold]Fetching {len(missing_ids)} missing matches (Parallel - Low Ram Mode)...[/bold]")
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_mid = {executor.submit(client.get_match, mid): mid for mid in missing_ids}
            for future in as_completed(future_to_mid):
                mid = future_to_mid[future]
                try:
                    m_data = future.result()
                    if m_data:
                        # Save to DB immediately to avoid memory bloat if large batch
                        db.save_match(m_data)
                        fetched_map[mid] = m_data
                except Exception as e:
                    with open("backend_debug.txt", "a") as f: f.write(f"[ERROR] Failed to fetch {mid}: {e}\n")
                    # console.print(f"[yellow]Failed to fetch {mid}: {e}[/yellow]")
                    pass

    # Reassemble in order
    for i, mid in enumerate(match_ids):
        if mid in cached_matches_map:
            matches[i] = cached_matches_map[mid]
        elif mid in fetched_map:
            matches[i] = fetched_map[mid]

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
    # 3. TIMELINES
    if use_timeline:
        with open("backend_debug.txt", "a") as f:
            f.write(f"[DEBUG] Pipeline Step: Processing Timelines...\n")
        console.print("[bold]Fetching timelines and analyzing movement... (Parallel)[/bold]")
        
        def process_timeline(idx, m_id, m_data, tl):
            # 1. OPTIMIZATION: Check for cached Analysis Results
            # This skips the expensive 0.5s calc per match
            cached = db.get_timeline_analysis(m_id)
            if cached:
                return cached.get("loss_diagnostics"), cached.get("movement")

            # Timeline is already fetched and saved by the caller (Sequential Loop)
            if not tl:
                return None, None

            # Loss Analysis
            l_diag = None
            try:
                l_diag = classify_loss_reason(m_data, tl, puuid)
                if l_diag:
                    l_diag = {"match_id": m_id, **l_diag}
            except Exception as e:
                console.print(f"[yellow]Loss Analysis Failed {m_id}: {e}[/yellow]")
                pass

            # Movement Analysis
            mov = None
            try:
                mov = analyze_timeline_movement(m_data, tl, puuid)
                if mov:
                    mov = {"match_id": m_id, **mov}
            except Exception as e:
                console.print(f"[yellow]Movement Analysis Failed {m_id}: {e}[/yellow]")
                pass
            
            # 2. SAVE to Cache
            if l_diag or mov:
                try:
                    db.save_timeline_analysis(m_id, {
                        "loss_diagnostics": l_diag,
                        "movement": mov
                    })
                except Exception as e:
                    console.print(f"[yellow]Failed to save timeline analysis for {m_id}: {e}[/yellow]")
                    with open("backend_debug.txt", "a") as f: f.write(f"[ERROR] DB Save Failed {m_id}: {e}\n")
            
            return l_diag, mov

        # SEQUENTIAL EXECUTION (Full Batch Strategy)
        # Re-map matches to IDs
        valid_tasks = []
        for m in matches:
            mid = m['metadata']['matchId']
            valid_tasks.append((mid, m))
        
        # User requested Full Batch Processing for consistent UI data
        # We removed the "Hybrid" optimization that was skipping timelines.
        console.print(f"[bold]Processing Timeline for all {len(valid_tasks)} matches...[/bold]")
        
        # OPTIMIZED PARALLEL FETCHING
        # 1. Fetch all missing timelines in parallel
        
        missing_mids = []
        for mid, _ in valid_tasks:
            if not db.get_timeline(mid):
                missing_mids.append(mid)
                
        if missing_mids:
            console.print(f"[bold]Fetching {len(missing_mids)} missing timelines (Parallel - Low Ram Mode)...[/bold]")
            with ThreadPoolExecutor(max_workers=3) as executor:
                future_to_mid = {executor.submit(client.get_match_timeline, mid): mid for mid in missing_mids}
                
                for future in as_completed(future_to_mid):
                    mid = future_to_mid[future]
                    try:
                        tl = future.result()
                        if tl:
                            db.save_timeline(mid, tl)
                    except Exception as e:
                        # console.print(f"[yellow]Failed to fetch timeline {mid}: {e}[/yellow]")
                        pass

        # 2. Process Sequentially (Batch Strategy to Save RAM)
        # Processing 50 timelines at once can consume > 512MB RAM.
        # We process in extremely small batches (1) for 512MB instances.
        BATCH_SIZE = 1
        console.print(f"[bold]Processing {len(valid_tasks)} timelines in batches of {BATCH_SIZE}...[/bold]")
        
        with open("backend_debug.txt", "a") as f: f.write(f"[DEBUG] Start Processing {len(valid_tasks)} timelines (Batched)...\n")
        
        for batch_start in range(0, len(valid_tasks), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(valid_tasks))
            batch = valid_tasks[batch_start:batch_end]
            
            console.print(f"[dim]Processing Batch {batch_start+1}-{batch_end}...[/dim]")
            
            for i, (mid, m_data) in enumerate(batch):
                total_idx = batch_start + i
                t_start_tl = time.time()
                try:
                    # Fetch from DB (it should be there from parallel fetch above)
                    tl = db.get_timeline(mid)
                    
                    if tl:
                        l_res, mov_res = process_timeline(total_idx, mid, m_data, tl)
                        if l_res:
                            timeline_loss_diagnostics.append(l_res)
                        # if mov_res:
                        #     movement_summaries.append(mov_res)
                        
                        # Aggressive Cleanup: Delete timeline object immediately after use
                        del tl
                        
                except Exception as e:
                    console.print(f"[yellow]Error processing timeline {mid}: {e}[/yellow]")
                
                dur = time.time() - t_start_tl
                with open("backend_debug.txt", "a") as f: f.write(f"[DEBUG] Processed {mid} in {dur:.2f}s\n")

            # End of Batch: Force Garbage Collection
            import gc
            gc.collect()

    t_processing = time.time()
    console.print(f"[cyan]TIMING: Match & Timeline Processing took {t_processing - t_bulk:.2f}s[/cyan]")
    
    # Explicit GC to free timeline memory before analysis
    import gc
    gc.collect()

    # Enrich analysis with macro, comp, and itemization data
    # Enrich analysis with macro, comp, and itemization data
    analysis = enrich_coaching_data(
        matches=matches,
        match_ids=match_ids,
        puuid=puuid,
        analysis=base_analysis,
        timeline_loss_diagnostics=timeline_loss_diagnostics,
        movement_summaries=[], # Empty to force lazy loading
        db_client=db # Pass DB for lazy loading
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
        "region": region_key,  # Store region for invalidation/updates
        "riot_id": riot_id,
        "game_name": account.get("gameName", game_name),
        "tag_line": account.get("tagLine", tag_line),
        "riot_id": riot_id,
        "game_name": account.get("gameName", game_name),
        "tag_line": account.get("tagLine", tag_line),
        "puuid": puuid,
        "summoner_info": {
            "summonerLevel": summoner.get("summonerLevel", 0),
            "profileIconId": summoner.get("profileIconId", 0),
            "id": summoner.get("id", "")
        },
        "rank_info": league_entries,
        "past_ranks": get_cached_past_ranks(puuid, game_name, tag_line, client.platform),
        "match_count_requested": match_count,
        "match_ids": match_ids,
        "analysis": analysis,
        "timeline_loss_diagnostics": timeline_loss_diagnostics,
        "movement_summaries": movement_summaries,
        "champion_mastery": client.get_champion_mastery(puuid)[:100], # Top 100 mastery
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

    # Enhanced Season Stats (Tier 3)
    try:
        t_season_start = time.time()
        agent_payload["season_stats"] = calculate_season_stats_from_db(puuid)
        t_season_end = time.time()
        # console.print(f"[green]Calculated Season Stats from {agent_payload['season_stats'].get('total_games', 0)} cached games.[/green]")
        # console.print(f"[cyan]TIMING: Season Stats took {t_season_end - t_season_start:.2f}s[/cyan]")
    except Exception as e:
        console.print(f"[yellow]Warning: Failed to calculate season stats: {e}[/yellow]")

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
    
    # DEBUG: Verify critical fields
    if "summoner_info" in agent_payload:
        console.print(f"[green]DEBUG: summoner_info present: {agent_payload['summoner_info']}[/green]")
    else:
        console.print("[red]DEBUG: CRITICAL - summoner_info MISSING from payload![/red]")

    if "rank_info" in agent_payload:
        entries = agent_payload['rank_info']
        console.print(f"[green]DEBUG: rank_info present ({len(entries)} entries)[/green]")
    else:
        console.print("[red]DEBUG: CRITICAL - rank_info MISSING from payload![/red]")

    # console.print("----- BEGIN LEAGUE ANALYZER JSON -----")
    # console.print(json.dumps(agent_payload, indent=2))
    # console.print("----- END LEAGUE ANALYZER JSON -----")

    # --- STAGE 1: IMMEDIATE SAVE (Base Stats) ---
    # Save mostly-complete data so the dashboard updates stats immediately
    # while the slow AI runs in standard analysis mode.
    # --- STAGE 1: IMMEDIATE SAVE (Base Stats) ---
    # Save mostly-complete data so the dashboard updates stats immediately
    # while the slow AI runs in standard analysis mode.
    if save_json:
        safe_riot_id = riot_id.replace("#", "_")
        filename = SAVE_DIR / f"league_analysis_{safe_riot_id}.json"
        
        # PRESERVE OLD REPORT: Try to load existing file to keep the old AI report valid
        # while the new one generates. This allows the UI to show "Cached" data + "Loading" spinner.
        try:
            if filename.exists():
                with open(filename, "r", encoding="utf-8") as f:
                    old_data = json.load(f)
                    if "coaching_report" in old_data:
                        agent_payload["coaching_report"] = old_data["coaching_report"]
                        console.print("[dim]Preserving cached coaching report for Stage 1 UI...[/dim]")
                    if "coaching_report_markdown" in old_data:
                         agent_payload["coaching_report_markdown"] = old_data["coaching_report_markdown"]
        except Exception as e:
            console.print(f"[yellow]Warning: Failed to read old cache, starting fresh: {e}[/yellow]")

        # Set loading flag for UI
        agent_payload["ai_loading"] = True
        
        try:
            from database import Database
            db = Database()
            db.save_analysis(agent_payload)
            console.print(f"[green]STAGE 1: Saved Base Stats to MongoDB (UI Updated)[/green]")
        except Exception as e:
            console.print(f"[red]Failed to save Stage 1 Analysis to DB: {e}[/red]")

    # Optional: call the multi-agent League Coach crew    # 5. AI
    # LOGIC UPDATE: Only run AI if we actually found NEW matches or if the user forced it,
    # OR if the previous report is missing.
    # We need to know if new matches were found.
    # Let's assume if we had to fetch ANY match history logic, we might need a refresh.
    # But strictly speaking, we want to know if the list of match IDs changed.
    
    # We can fetch the old analysis from DB to check if report simply exists.
    # In Stage 1 above, we loaded 'old_data'.
    
    has_valid_report = False
    if 'old_data' in locals() and old_data:
        if "coaching_report" in old_data or "coaching_report_markdown" in old_data:
            has_valid_report = True

    # We assume 'match_count' requested matches were processed.
    # If all of them were cached and we have a report, we can skip.
    # Ideally we'd track 'new_matches_count' earlier in the script.
    # For now, let's implement a heuristic:
    # If 'saved_doc' existed (from DB load at start) AND match list is same?
    # Simpler: If the user didn't ask for a force refresh, and we have a report, 
    # and the latest match ID in 'matches' matches the latest in 'old_data', we are good.
    
    skip_ai = False
    
    # LOGIC FIX: If force_refresh is True, we NEVER skip AI.
    if force_refresh:
        console.print("[bold cyan]Force Refresh requested: Bypassing cache checks, running AI.[/bold cyan]")
        log_debug("Force Refresh: Bypassing cache checks.")
        skip_ai = False
    elif has_valid_report:
        # Check if the latest match is statistically the same
        try:
            latest_new = matches[0]['metadata']['matchId']
            # Check detailed_matches first (standard output), fallback to matches (legacy/raw)
            latest_old = None
            cached_dm = old_data.get('detailed_matches', [])
            
            if cached_dm:
                latest_old = cached_dm[0].get('match_id')
                
                # SCHEMA VALIDATION: Check for "Item Build" fix
                # If the cache exists but lacks 'item_build' in detailed_matches, it's stale (pre-fix).
                if 'item_build' not in cached_dm[0]:
                    console.print("[yellow]Cache Invalid: Missing 'item_build' data. forcing re-run.[/yellow]")
                    log_debug("Cache Invalid: Missing 'item_build'")
                    latest_old = "FORCE_INVALIDATE" # Mismatch forces reload
                
                # COUNT VALIDATION: Check if we have enough matches
                elif len(cached_dm) < match_count:
                    console.print(f"[yellow]Cache Invalid: Insufficient matches ({len(cached_dm)} < {match_count}). forcing re-run.[/yellow]")
                    log_debug(f"Cache Invalid: Count mismatch {len(cached_dm)} < {match_count}")
                    latest_old = "FORCE_INVALIDATE"
                    
            elif 'matches' in old_data and old_data['matches']:
                latest_old = old_data.get('matches', [{}])[0].get('metadata', {}).get('matchId')
            
            if latest_new == latest_old:
                skip_ai = True
                console.print("[green]Creating Analysis: No new matches found & Cache exists. Skipping AI re-run.[/green]")
                log_debug("Skipping AI: No new matches & Cache exists")
        except Exception as e:
            log_debug(f"Error checking cache freshness: {e}")


    
    if skip_ai:
        call_ai = False
        
    if call_ai:
        log_debug("Starting AI Agent Exec...")

            
    if call_ai and not skip_ai:
        with open("backend_debug.txt", "a") as f:
            f.write(f"[DEBUG] Pipeline Step: Calling AI...\n")
        console.print("Contacting League Coach Crew (Gemini - may take 10-30s)...")
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
            
    # Mark AI as done
    agent_payload["ai_loading"] = False

    # --- STAGE 2: FINAL SAVE (With AI) ---
    if save_json:
        # safe_riot_id computed above or here
        from database import Database
        print(f"[DEBUG] Initializing Database for Final Save...")
        db = Database()
        print(f"[DEBUG] DB Connected: {db.is_connected}")
        try:
            print(f"[DEBUG] Saving analysis for {agent_payload.get('riot_id')}...")
            # Validate Payload
            if "analysis" not in agent_payload:
                print(f"[ERROR] 'analysis' KEY MISSING FROM PAYLOAD! Keys: {list(agent_payload.keys())}")
            else:
                print(f"[DEBUG] 'analysis' key present. Subkeys: {list(agent_payload['analysis'].keys())}")

            db.save_analysis(agent_payload)
            print(f"[green]STAGE 2: Saved Final Analysis with AI to MongoDB[/green]")
        except Exception as e:
            console.print(f"[red]Failed to save Stage 2 Analysis to DB: {e}[/red]")
            import traceback
            traceback.print_exc()

    # --- AUTO CLEANUP ---
    try:
        # 1. Clean up old matches for this user (Keep top 1000 to cover full seasons)
        # 1000 compressed games = ~3MB. Safe to keep.
        p_puuid = agent_payload.get("summoner_info", {}).get("puuid")
        if p_puuid:
            db.cleanup_old_matches(p_puuid, limit=1000)
        
        # 2. Clean up old AI cache files (older than 90 days)
        cleanup_local_cache_files(days=90)
        
    except Exception as e:
        console.print(f"[yellow]Cleanup warning: {e}[/yellow]")

    # Open dashboard if requested
    if open_dashboard:
        try:
            import webbrowser
            webbrowser.open("http://localhost:5173")
            console.print("[green]Opening dashboard in browser...[/green]")
        except Exception as e:
            console.print(f"[yellow]Failed to open browser: {e}[/yellow]")



    # --- PROACTIVE BACKFILL (Background) ---
    # Fetch remaining season matches (up to 1000) for accurate stats next time.
    if puuid:
        import threading
        t = threading.Thread(target=backfill_match_history, args=(puuid, region_key), daemon=True)
        t.start()

    return agent_payload


def main() -> None:
    console.print("[bold cyan]League Personal Analyzer[/bold cyan]")

    riot_id = console.input("Enter your Riot ID (e.g. SomeName#TAG): ").strip()
    if "#" not in riot_id:
        console.print("[red]Invalid Riot ID format. Use Name#TAG.[/red]")
        return

    match_count_str = console.input(
        "How many recent ranked games should I analyze? [default 20, max 300]: "
    ).strip()
    match_count = 20
    if match_count_str.isdigit():
        match_count = max(1, min(300, int(match_count_str)))

    # For large batches, default timeline to False to save massive time/bandwidth
    default_timeline = True
    if match_count > 50:
        console.print("[yellow]Large batch detected (>50). Disabling timeline analysis by default to speed up fetching.[/yellow]")
        default_timeline = False

    # Ask whether to fetch timelines & movement diagnostics
    use_timeline = (
        console.input(
            f"Analyze movement/timeline data? (Slower) [{'Y/n' if default_timeline else 'y/N'}]: "
        )
        .strip()
        .lower()
    )
    if default_timeline:
        use_timeline = use_timeline != "n"
    else:
        use_timeline = use_timeline == "y"

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
