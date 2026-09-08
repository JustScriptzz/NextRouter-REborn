import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\status-now.json', encoding='utf-8') as f:
    d = json.load(f)
models = d.get('models', [])
live = [m for m in models if m.get('updatedAt')]
failing = [m for m in live if m['avail'] is not None and m['avail'] < 0.999]
ok = [m for m in live if m['avail'] is not None and m['avail'] >= 0.999]
print('catalog:', len(models), '| with data:', len(live), '| green:', len(ok), '| red:', len(failing))
print()
print('--- FAILING MODELS ---')
for m in sorted(failing, key=lambda x: x['avail']):
    pipes = len(m.get('providers', []))
    print(f"  {m['avail']*100:.0f}%  pipes={pipes}  {m['id']}  [{m.get('type')}]")
