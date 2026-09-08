import json, urllib.request, urllib.error, time

KEY = "crk_live_b02c78b65752e9fc1ed1d955d0cf55f5755b"
BASE = "https://gpt.crax.lol/v1"

def probe(name, path="/chat/completions", payload=None, timeout=20):
    url = BASE + path
    body = json.dumps(payload or {"model":"gpt-5-4-nano","messages":[{"role":"user","content":"hi"}],"max_tokens":5}).encode()
    req = urllib.request.Request(url, data=body, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            d = json.loads(r.read())
            content = d.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"  {name} -> {r.status} ({time.time()-t0:.1f}s) content={content[:80]}")
    except urllib.error.HTTPError as e:
        print(f"  {name} -> HTTP {e.code} ({time.time()-t0:.1f}s) body={e.read().decode()[:100]}")
    except Exception as e:
        print(f"  {name} -> ERROR ({time.time()-t0:.1f}s) {str(e)[:100]}")

t0=time.time()
print("1. Test /models (direct to Crax)")
probe("models", "/models", payload=None)

t0=time.time()
print("2. Test chat/gpt-5-4-nano (lightweight)")
probe("gpt-5-4-nano", payload={"model":"gpt-5-4-nano","messages":[{"role":"user","content":"hi"}],"max_tokens":5})

t0=time.time()
print("3. Test chat/claude-opus-5 (heavy)")
probe("claude-opus-5", payload={"model":"claude-opus-5","messages":[{"role":"user","content":"Say hi"}],"max_tokens":10})
