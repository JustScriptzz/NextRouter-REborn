import concurrent.futures
import json
import os
import time
import urllib.error
import urllib.request

BASE = "https://nextrouter-vert.vercel.app/api/v1"
KEY = "nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA"
TIMEOUT = 100
ROUNDS = 5
RESULTS = r"C:\Users\ciull_yx1zjgv\nextrouter-reborn\sweep-5x.jsonl"

with open(r"C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-full.json", encoding="utf-8") as f:
    models = json.load(f)["data"]

todo_types = ("text", "embedding", "tts", "image")
todo = [m for m in models if m.get("type") in todo_types]

done = set()
if os.path.exists(RESULTS):
    with open(RESULTS, encoding="utf-8") as f:
        for line in f:
            try:
                r = json.loads(line)
                done.add((r["id"], r["round"]))
            except Exception:
                pass

tasks = [(m, rnd) for rnd in range(1, ROUNDS + 1) for m in todo if (m["id"], rnd) not in done]
total_done = len(done)
print(f"catalog={len(models)} testing={len(todo)}x{ROUNDS}, already done={total_done}, remaining={len(tasks)}", flush=True)

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
        r.read(64)
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
        return {"status": 0, "ms": int((time.time() - started) * 1000), "err": ("TIMEOUT" if "tim" in str(e).lower() else str(e))[:140]}

def test(task):
    m, rnd = task
    mid, mtype = m["id"], m.get("type", "text")
    if mtype == "text":
        res = call("/chat/completions", {"model": mid, "messages": [{"role": "user", "content": "Reply with just: OK"}], "max_tokens": 16})
    elif mtype == "embedding":
        res = call("/embeddings", {"model": mid, "input": "hello"})
    elif mtype == "tts":
        res = call("/audio/speech", {"model": mid, "input": "hello there", "voice": "default"})
    else:
        res = call("/images/generations", {"model": mid, "prompt": "a red dot on white background", "n": 1, "size": "512x512"})
    rec = {"id": mid, "type": mtype, "round": rnd, "status": res["status"], "ms": res["ms"], "err": res["err"]}
    print(("PASS" if rec["status"] == 200 else "FAIL"), f"r{rnd}", mtype, mid, rec["status"], str(rec["ms"]) + "ms", rec["err"][:60], flush=True)
    return rec

out = open(RESULTS, "a", encoding="utf-8")
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for rec in ex.map(test, tasks):
        out.write(json.dumps(rec) + "\n")
        out.flush()
out.close()
print("BATCH COMPLETE", flush=True)
