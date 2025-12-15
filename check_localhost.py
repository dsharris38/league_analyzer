import requests
import json

try:
    resp = requests.get("http://localhost:8000/api/meraki/items/")
    data = resp.json()
    item = data.get("1055")
    if item:
        print(f"Name: {item.get('name')}")
        print(f"Description: {item.get('description')}")
    else:
        print("Item 1055 not found.")
except Exception as e:
    print(f"Error fetching from localhost: {e}")
