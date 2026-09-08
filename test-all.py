import concurrent.futures
import json
import time
import urllib.error
import urllib.request

BASE = "https://nextrouter-vert.vercel.app/api/v1"
KEY = "nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA"
TIMEOUT = 100

with open(r"C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-full.json", encoding="utf-8") as f:
    models = json.load(f)["data"]

def call(path, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
    )
    started = time.time()
    try:
        r = urllib.request.urlopen(req, timeout=TIMEOUT)
        raw = r.read(200)
        return {"status": r.status, "ms": int((time.time() - started) * 1000), "err": ""}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        msg = ""
        try:
            j = json.loads(detail)
            msg = str(j.get("error", ""))
        except Exception:
            msg = detail[:120]
        return {"status": e.code, "ms": int((time.time() - started) * 1000), "err": msg[:140].replace("\n", " ")}
    except Exception as e:
        return {"status": 0, "ms": int((time.time() - started) * 1000), "err": ("TIMEOUT" if "timed out" in str(e) or "timeout" in str(e).lower() else str(e))[:140]}

def test(m):
    mid, mtype = m["id"], m.get("type", "text")
    if mtype == "text":
        res = call("/chat/completions", {"model": mid, "messages": [{"role": "user", "content": "Reply with just: OK"}], "max_tokens": 16})
    elif mtype == "embedding":
        res = call("/embeddings", {"model": mid, "input": "hello"})
    elif mtype == "tts":
        res = call("/audio/speech", {"model": mid, "input": "hello there", "voice": "default"})
    elif mtype == "image":
        res = call("/images/generations", {"model": mid, "prompt": "a red dot on white background", "n": 1, "size": "512x512"})
    else:
        return None
    res["id"] = mid
    res["type"] = mtype
    print(("PASS" if res["status"] == 200 else "FAIL"), mtype, mid, res["status"], str(res["ms"]) + "ms", res["err"][:80], flush=True)
    return res

todo = [m for m in models if m.get("type") in ("text", "embedding", "tts", "image")]
print("testing", len(todo), "models (stt handled separately)", flush=True)

results = []
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for res in ex.map(test, todo):
        if res:
            results.append(res)

with open(r"C:\Users\ciull_yx1zjgv\nextrouter-reborn\sweep-results.json", "w") as f:
    json.dump(results, f)

ok = [r for r in results if r["status"] == 200]
bad = [r for r in results if r["status"] != 200]
print("\n=== SUMMARY ===")
print("pass:", len(ok), "fail:", len(bad))
by_type = {}
for r in results:
    by_type.setdefault(r["type"], [0, 0])
    by_type[r["type"]][0 if r["status"] == 200 else 1] += 1
for t, (o, b) in sorted(by_type.items()):
    print(" ", t, "ok", o, "fail", b)
