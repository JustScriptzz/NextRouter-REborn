import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\envs-dec.json', encoding='utf-8') as f:
    d=json.load(f)
for e in d.get('envs',[]):
    k=e.get('key','')
    v=e.get('value','')
    if 'JANKROUTER' in k or 'AQUADEVS' in k or 'LOGFARE' in k:
        print(k, 'value_len:', len(v), 'has_value:', bool(v.strip()))
