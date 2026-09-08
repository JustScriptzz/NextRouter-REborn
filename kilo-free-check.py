import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\kilo-now.json', encoding='utf-8') as f:
    d = json.load(f)
models = d.get('data', [])
free = []
for m in models:
    mid = m.get('id', '')
    if ':free' in mid or mid == 'kilo-auto/free':
        free.append(mid)
print('kilo total:', len(models))
print('kilo free:', len(free))
for x in sorted(free):
    print(' ', x)
