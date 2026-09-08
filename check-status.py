import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\status-api.json', encoding='utf-8') as f:
    d = json.load(f)
models = d.get('models', [])
live = [m for m in models if m.get('updatedAt')]
print('total', len(models), '| with live data:', len(live))
for m in live[:10]:
    print(' ', m['id'], '| avail', m['avail'], '| lat', m['avgLatencyMs'], 'ms | tok/s', m['tokPerSec'], '| bars', len(m.get('last', [])), '| providers', m.get('providers'))
