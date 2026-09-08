import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\status-check.json') as f:
    d=json.load(f)
models=d.get('models', [])
for m in models:
    if m['id'] in ['glm-5.2','flux-1-schnell','flux-2-klein-4b','flux-2-klein-9b','glm-5.3-flash','kimi-k2.7-code','minimax-m3','phoenix-1.0','sdxl-lightning','north-mini-code','moondream3.1']:
        avail = m['avail']
        a = f"{avail*100:.1f}%" if avail is not None else "—"
        print(f"{m['id']:30} avail={a:6} ({m['ok']}/{m['ok']+m['fail'] if m['ok']+m['fail']>0 else 0}) lat={str(m['avgLatencyMs'])+'ms' if m['avgLatencyMs'] else '—':8} providers={m['providers']} last={''.join('G' if x else 'R' for x in m['last'][-10:])}")
print("total",len(models))
