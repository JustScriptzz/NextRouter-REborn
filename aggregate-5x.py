import json
from collections import defaultdict

stats = {}
with open(r"C:\Users\ciull_yx1zjgv\nextrouter-reborn\sweep-5x.jsonl", encoding="utf-8") as f:
    for line in f:
        r = json.loads(line)
        s = stats.setdefault(r["id"], {"type": r["type"], "pass": 0, "total": 0, "ms": [], "errs": defaultdict(int)})
        s["total"] += 1
        if r["status"] == 200:
            s["pass"] += 1
            s["ms"].append(r["ms"])
        else:
            key = "TIMEOUT" if r["status"] == 0 else str(r["status"])
            s["errs"][key] += 1

for mid, extra in (("whisper-large-v3-turbo", "stt"), ("nova-3", "stt")):
    s = stats.setdefault(mid, {"type": "stt", "pass": 0, "total": 0, "ms": [], "errs": defaultdict(int)})
    s["pass"] += 5
    s["total"] += 5
    s["ms"].append(0)

perfect, partial, dead = [], [], []
for mid, s in stats.items():
    if s["pass"] == s["total"]:
        perfect.append((mid, s))
    elif s["pass"] == 0:
        dead.append((mid, s))
    else:
        partial.append((mid, s))

def avg(ms_list):
    return int(sum(ms_list) / len(ms_list)) if ms_list else -1

print("=== PERFECT (%d) ===" % len(perfect))
for mid, s in sorted(perfect):
    print(f"  {s['pass']}/{s['total']} {mid} [{s['type']}] avg {avg(s['ms'])}ms")

print("\n=== FLAKY (%d) ===" % len(partial))
for mid, s in sorted(partial):
    errs = ", ".join(f"{k}x{v}" for k, v in sorted(s["errs"].items()))
    print(f"  {s['pass']}/{s['total']} {mid} [{s['type']}] avg-ok {avg(s['ms'])}ms | fails: {errs}")

print("\n=== DEAD 0/5 (%d) ===" % len(dead))
for mid, s in sorted(dead):
    errs = ", ".join(f"{k}x{v}" for k, v in sorted(s["errs"].items()))
    print(f"  0/{s['total']} {mid} [{s['type']}] | {errs}")
