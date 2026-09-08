import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\img-status.json') as f:
    d=json.load(f)
want={'sdxl-lightning','flux-2-klein-4b','flux-2-klein-9b','flux-1-schnell','phoenix-1.0','lucid-origin','grok-image','agnes-image','qwen-image','wan-3.0'}
for m in d.get('models',[]):
    if m['id'] in want:
        a=m.get('avail')
        astr='—' if a is None else f"{a*100:.0f}%"
        print(f"{m['id']:22} type={m.get('type'):7} avail={astr:6} ok={m['ok']} fail={m['fail']} prov={m['providers']}")
