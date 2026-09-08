import urllib.request, json

req = urllib.request.Request(
    'https://api.render.com/v1/services',
    headers={'Authorization': 'Bearer rnd_wdMmv9rsA4JEXBFJGFwuOMa83qpF'}
)
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        resp = json.loads(r.read())
        if isinstance(resp, dict):
            resp = resp.get("services", [])
        print("Services count:", len(resp))
        for svc in resp:
            print(f"  {svc.get('service', {}).get('name', svc.get('name'))} (type={svc.get('service', {}).get('type', svc.get('type'))}) status={svc.get('service', {}).get('status', svc.get('status'))} id={svc.get('service', {}).get('id', svc.get('id'))}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:300]}")
except Exception as e:
    print(f"Error: {e}")
