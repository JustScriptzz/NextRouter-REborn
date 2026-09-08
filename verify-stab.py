import json, urllib.request

with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-stab.json', encoding='utf-8') as f:
    d = json.load(f)
models = d.get('data', [])
print('catalog total:', len(models))
for probe_id in ('minimax-m3', 'minimax-m2.7', 'deepseek-v4-pro-0813', 'deepseek-v4-flash-0731', 'nemotron-3-super', 'nemotron-3-ultra', 'north-mini-code'):
    present = any(m['id'] == probe_id for m in models)
    print(' ', probe_id, 'present' if present else 'MISSING')
gone = [m['id'] for m in models if m['id'] in ('minimax/minimax-m3:free', 'minimax/minimax-m2.7:free', 'deepseek-v4-pro:0813', 'deepseek-v4-flash:0731', 'nvidia/nemotron-3-super-120b-a12b:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'cohere/north-mini-code:free')]
print('old duplicate ids still listed:', gone or 'none (absorbed)')

# verify merged model actually works through the canonical id
body = json.dumps({"model": "minimax-m3", "messages": [{"role": "user", "content": "Say OK"}], "max_tokens": 200}).encode()
req = urllib.request.Request('https://nextrouter-vert.vercel.app/api/v1/chat/completions', data=body,
                             headers={'Authorization': 'Bearer nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA', 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=90) as r:
        print('minimax-m3 via merged pipes:', r.status)
except urllib.error.HTTPError as e:
    print('minimax-m3 via merged pipes:', e.code)
