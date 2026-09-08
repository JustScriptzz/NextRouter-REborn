import urllib.request, json

def attempt(label, sd):
    payload = {
        "ownerId": "tea-d9to86jncjis739nnfs0",
        "type": "web_service",
        "name": "nextrouter-" + str(hash(label) % 1000),
        "repo": "https://github.com/JustScriptzz/NextRouter-REborn",
        "runtime": "node",
        "plan": "free",
        "branch": "master",
        "serviceDetails": sd,
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request("https://api.render.com/v1/services", data=body, method="POST",
        headers={"Authorization": "Bearer rnd_wdMmv9rsA4JEXBFJGFwuOMa83qpF", "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = json.loads(r.read())
            s = resp.get("service", resp)
            print(f"[{label}] 200 CREATED id={s.get('id')} name={s.get('name')}")
            return True
    except urllib.error.HTTPError as e:
        print(f"[{label}] {e.code}: {e.read().decode()[:250]}")
    except Exception as e:
        print(f"[{label}] {type(e).__name__}: {e}")
    return False

attempt("esd-noport", {
    "env": "node",
    "healthCheckPath": "/",
    "envSpecificDetails": {"buildCommand": "npm install && npm run build", "startCommand": "npm start"},
})
