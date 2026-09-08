import json
with open('/tmp/status.json') as f:
    d=json.load(f)
models=d.get('models', [])
# find problematic ones from screenshot
targets=['glm-5.2','flux-1-schnell','flux-2-klein-4b','flux-2-klein-9b','glm-5.3-flash','kimi-k2.7-code','minimax-m3','phoenix-1.0','sdxl-lightning','north-mini-code']
for m in models:
    if m['id'] in targets or m['id'] in ['glm-5.2','minimax-m3']:
        print(f"{m['id']:30} avail={m['avail']} ok={m['ok']} fail={m['fail']} lat={m['avgLatencyMs']} tok={m['tokPerSec']} last={m['last'][-5:]} prov={m['providers']}")
print("total",len(models))
# providers
import urllib.request, json as j
# check gateways
