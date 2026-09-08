import json
with open(r'C:\Users\ciull_yx1zjgv\AppData\Local\Temp\models-crax.json') as f:
    d=json.load(f)
models=d.get('data',[])
# Crax models don't show provider in /api/v1/models. Check catalog total and search for standard crax ids
print("total", len(models))
# Check status API for crax provider
import urllib.request
with urllib.request.urlopen(urllib.request.Request('https://nextrouter-vert.vercel.app/api/status'), timeout=30) as r:
    s=json.load(r)
    for m in s.get('models',[]):
        if 'crax' in m.get('providers',[]):
            print("CRAX model:", m['id'], m.get('providers'))
