import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\img-status.json') as f:
    d=json.load(f)
for m in d.get('models',[]):
    if m['id']=='wan-3.0':
        print(json.dumps(m,indent=2))
# also check what other video models exist
for m in d.get('models',[]):
    if m.get('type')=='video':
        print(f"video: {m['id']} prov={m['providers']} avail={m['avail']}")
