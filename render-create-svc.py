import urllib.request, json

payload = {
    "ownerId": "tea-d9to86jncjis739nnfs0",
    "type": "web_service",
    "name": "nextrouter",
    "runtime": "node",
    "plan": "free",
    "branch": "master",
    "autoDeploy": True,
    "numInstances": 1,
    "repo": "https://github.com/JustScriptzz/NextRouter-REborn",
    "serviceDetails": {
        "env": "node",
        "healthCheckPath": "/",
        "envSpecificDetails": {
            "buildCommand": "npm install && npm run build",
            "startCommand": "npm start -- -p $PORT",
        },
        "openPorts": [{"name": "http", "protocol": "http"}],
    },
}

body = json.dumps(payload).encode()
req = urllib.request.Request(
    "https://api.render.com/v1/services",
    data=body,
    method="POST",
    headers={
        "Authorization": "Bearer rnd_wdMmv9rsA4JEXBFJGFwuOMa83qpF",
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.loads(r.read())
        s = resp.get("service", resp)
        print("200 CREATED")
        print("id:", s.get("id"))
        print("name:", s.get("name"))
        print("type:", s.get("type"))
        print("status:", s.get("status"))
        print("serviceDetails:", json.dumps(s.get("serviceDetails", {}))[:200])
except urllib.error.HTTPError as e:
    print(f"{e.code}: {e.read().decode()[:600]}")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
