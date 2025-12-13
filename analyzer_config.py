# config.py
import os
from dotenv import load_dotenv

from pathlib import Path

# Explicitly find .env file in the same directory as this script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

RIOT_API_KEY = os.getenv("RIOT_API_KEY")
REGION = os.getenv("REGION", "americas")    # for match-v5
PLATFORM = os.getenv("PLATFORM", "na1")     # for summoner/league endpoints

if not RIOT_API_KEY:
    print("WARNING: RIOT_API_KEY not found in environment. backend may fail.")
    # raise RuntimeError("RIOT_API_KEY not found. Set it in your .env file.")
