import requests
import re
from bs4 import BeautifulSoup

def test_log():
    url = "https://www.leagueofgraphs.com/summoner/na/Bingbong-NAbab"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        print(f"Testing LoG: {url}")
        r = requests.get(url, headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            soup = BeautifulSoup(r.content, "html.parser")
            text = soup.get_text(" ", strip=True)
            print("Content Length:", len(text))
            
            # Check explicitly for recent years
            if "2024" in text: print("FOUND '2024' in LoG!")
            if "2023" in text: print("FOUND '2023' in LoG!")
            if "S14" in text: print("FOUND 'S14' in LoG!")
            
            # Test Regex
            matches = re.findall(r"(S\d+|Season \d+)(?:[\s-]+S\d+)?[:\s]+(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond|Master|Grandmaster|Challenger)\s*([IV\d]*)", text, re.IGNORECASE)
            print("Matches found:")
            for m in matches:
                print(f"  {m}")

    except Exception as e:
        print(f"LoG Error: {e}")

def test_ugg_stats():
    url = "https://u.gg/lol/profile/na1/bingbong-nabab/champion-stats"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        print(f"\nTesting U.GG Stats: {url}")
        r = requests.get(url, headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            text = r.text
            matches = re.findall(r"(Season \d+|S20\d\d|S\d+)", text)
            print("Season Matches in U.GG Stats:", matches[:10]) 

    except Exception as e:
        print(f"U.GG Stats Error: {e}")

if __name__ == "__main__":
    test_log()
    test_ugg_stats()
