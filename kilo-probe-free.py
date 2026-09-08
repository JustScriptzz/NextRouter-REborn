import concurrent.futures, json, urllib.request

with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\kilo-now.json', encoding='utf-8') as f:
    d = json.load(f)
models = d.get('data', [])
free = [m for m in models if ':free' in m.get('id', '') or m.get('id') == 'kilo-auto/free']

sample = free[0] if free else {}
print('sample entry keys:', sorted(sample.keys()))
if 'pricing' in sample:
    print('pricing sample:', json.dumps(sample['pricing'])[:200])

def probe(m):
    mid = m['id']
    body = json.dumps({"model": mid, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1}).encode()
    req = urllib.request.Request('https://api.kilo.ai/api/gateway/chat/completions', data=body,
                                 headers={'Content-Type': 'application/json'})
    try:
        r = urllib.request.urlopen(req, timeout=25)
        r.read(32)
        return mid, r.status, ''
    except urllib.error.HTTPError as e:
        return mid, e.code, e.read().decode(errors='replace')[:60]
    except Exception as e:
        return mid, 0, str(e)[:50]

with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for mid, code, err in ex.map(probe, free):
        print(('OK  ' if code == 200 else 'DEAD'), code, mid, err)
