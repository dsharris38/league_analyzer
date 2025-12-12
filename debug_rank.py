
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from rich.console import Console

# Setup paths
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR / ".env"

console = Console()

console.print(f"Script Directory: {SCRIPT_DIR}")
console.print(f".env exists: {ENV_PATH.exists()}")

# Load env
load_dotenv(dotenv_path=ENV_PATH)

# Add project root to path
sys.path.append(str(SCRIPT_DIR))

from riot_client import RiotClient
from analyzer_config import RIOT_API_KEY, REGION, PLATFORM

if not RIOT_API_KEY:
    console.print("[red]RIOT_API_KEY is missing from environment![/red]")
else:
    masked_key = f"{RIOT_API_KEY[:5]}...{RIOT_API_KEY[-4:]}" if len(RIOT_API_KEY) > 10 else "***"
    console.print(f"[green]Key Loaded:[/green] {masked_key}")

def debug_rank(riot_id):
    if "#" not in riot_id:
        console.print("[red]Invalid ID format[/red]")
        return

    game_name, tag_line = riot_id.split("#", 1)
    client = RiotClient()

    console.print(f"[bold]Config:[/bold] Region={REGION}, Platform={PLATFORM}")
    console.print(f"[bold]Lookup:[/bold] {game_name}#{tag_line}")

    try:
        # 1. Account
        account = client.get_account_by_riot_id(game_name, tag_line)
        puuid = account.get("puuid")
        console.print(f"[green]✔ PUUID found:[/green] {puuid}")

        # 2. Summoner
        summoner = client.get_summoner_by_puuid(puuid)
        summ_id = summoner.get("id")
        console.print(f"[green]✔ Summoner ID found:[/green] {summ_id}")

        # 3. League Entries
        entries = client.get_league_entries(summ_id)
        console.print(f"[bold cyan]League Entries ({len(entries)}):[/bold cyan]")
        console.print(entries)

        # Check for Solo Queue specifically
        solo = next((e for e in entries if e["queueType"] == "RANKED_SOLO_5x5"), None)
        if solo:
            console.print(f"[green]✔ Solo Queue Found:[/green] {solo['tier']} {solo['rank']} ({solo['leaguePoints']} LP)")
        else:
            console.print("[yellow]⚠ No Solo Queue entry found![/yellow]")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Use the known ID found in saves
    debug_rank("Potato Grip#NA1")
