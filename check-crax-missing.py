import json, urllib.request

with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\status-now.json') as f:
    status = json.load(f)
models_status = status.get('models', [])
crax_models = [m['id'] for m in models_status if 'crax' in m.get('providers', [])]
all_ids = [m['id'] for m in models_status]
print(f"status api total: {len(all_ids)}")
print(f"crax-backed models: {len(crax_models)}")

# try direct crax /models with 35s timeout
try:
    req = urllib.request.Request("https://gpt.crax.lol/v1/models", headers={"Authorization": "Bearer crk_live_b02c78b65752e9fc1ed1d955d0cf55f5755b"})
    with urllib.request.urlopen(req, timeout=35) as r:
        body = json.load(r)
        data = body.get("data", [])
        crax_ids = [m["id"] for m in data if "id" in m]
        print(f"crax upstream total: {len(crax_ids)}")
        missing = [id for id in crax_ids if id not in all_ids]
        print(f"missing from catalog: {len(missing)}")
        for m in missing[:30]:
            print(f"  {m}")
except Exception as e:
    print(f"crax upstream failed: {e}")
