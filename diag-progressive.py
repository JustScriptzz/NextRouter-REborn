import urllib.request, json

SD = {
    "buildCommand": "npm install && npm run build",
    "startCommand": "npm start -- -p $PORT",
    "env": "node",
    "healthCheckPath": "/",
}

tests = {
    "base+SD": {
        "ownerId": "tea-d9to86jncjis739nnfs0",
        "type": "web_service",
        "name": "nextrouter4",
        "repo": "https://github.com/JustScriptzz/NextRouter-REborn",
        "serviceDetails": SD,
    },
    "+runtime": {
        "ownerId": "tea-d9to86jncjis739nnfs0",
        "type": "web_service",
        "name": "nextrouter5",
        "repo": "https://github.com/JustScriptzz/NextRouter-REborn",
        "runtime": "node",
        "serviceDetails": SD,
    },
    "+plan": {
        "ownerId": "tea-d9to86jncjis739nnfs0",
        "type": "web_service",
        "name": "nextrouter6",
        "repo": "https://github.com/JustScriptzz/NextRouter-REborn",
        "runtime": "node",
        "plan": "free",
        "serviceDetails": SD,
    },
    "+branch+num": {
        "ownerId": "tea-d9to86jncjis739nnfs0",
        "type": "web_service",
        "name": "nextrouter7",
        "repo": "https://github.com/JustScriptzz/NextRouter-REborn",
        "runtime": "node",
        "plan": "free",
        "branch": "master",
        "numInstances": 1,
        "serviceDetails": SD,
    },
}

for label, payload in tests.items():
    body = json.dumps(payload).encode()
    req = urllib.request.Request("https://api.render.com/v1/services", data=body, method="POST",
        headers={"Authorization": "Bearer rnd_wdMmv9rsA4JEXBFJGFwuOMa83qpF", "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f"[{label}] 200")
            resp = json.loads(r.read())
            print("   ->", resp.get("id", resp))
            break
    except urllib.error.HTTPError as e:
        print(f"[{label}] {e.code}: {e.read().decode()[:200]}")
    except Exception as e:
        print(f"[{label}] Error: {e}")
