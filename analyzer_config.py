# config.py
import os
from dotenv import load_dotenv

load_dotenv()

RIOT_API_KEY = os.getenv("RIOT_API_KEY")
REGION = os.getenv("REGION", "americas")    # for match-v5
PLATFORM = os.getenv("PLATFORM", "na1")     # for summoner/league endpoints

if not RIOT_API_KEY:
    raise RuntimeError("RIOT_API_KEY not found. Set it in your .env file.")
