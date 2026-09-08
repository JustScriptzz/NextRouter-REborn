import urllib.request, json

# Minimal body - test which fields Render actually wants
for payload in [
    {"ownerId": "tea-d9to86jncjis739nnfs0", "type": "web_service", "name": "nextrouter", "runtime": "node", "repo": "https://github.com/JustScriptzz/NextRouter-REborn", "branch": "master"},
    {"ownerId": "tea-d9to86jncjis739nnfs0", "type": "web_service", "name": "nextrouter", "repo": "https://github.com/JustScriptzz/NextRouter-REborn"},
    {"ownerId": "tea-d9to86jncjis739nnfs0", "type": "web_service", "name": "nextrouter"},
]:
    body = json.dumps(payload).encode()
    req = urllib.request.Request("https://api.render.com/v1/services", data=body, method="POST",
        headers={"Authorization": "Bearer rnd_wdMmv9rsA4JEXBFJGFwuOMa83qpF", "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"200: {r.read().decode()[:400]}")
            break
    except urllib.error.HTTPError as e:
        resp = e.read().decode()[:300]
        print(f"Failed: {resp}")
