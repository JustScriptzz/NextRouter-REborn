import urllib.request, json, ssl, urllib.error

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

def get(path):
    req = urllib.request.Request("https://" + HOST + path, headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

# List files
s, d = get(f"/api/client/servers/{SRV}/files/list?directory=%2Fhome%2Fcontainer")
print(f"files status: {s}")
if isinstance(d, dict):
    for f in d.get("data", []):
        a = f.get("attributes", {})
        is_dir = not a.get("is_file", True)
        print(f"  {'DIR' if is_dir else 'FILE'} {a.get('name')} {a.get('size')}")

# Read back _run.py to confirm it's there
s2, b2 = get(f"/api/client/servers/{SRV}/files/contents?file=%2Fhome%2Fcontainer%2F_run.py")
print(f"\n_run.py contents: {s2}")
if isinstance(b2, dict):
    try:
        import base64
        print(base64.b64decode(b2.get("content","")).decode(errors="replace")[:200])
    except Exception as e:
        print(json.dumps(b2)[:300])
else:
    print(str(b2)[:200])

# server state
s3, d3 = get(f"/api/client/servers/{SRV}")
if isinstance(d3, dict):
    a = d3.get("attributes", {})
    print(f"\nstatus: {a.get('status')} suspended: {a.get('suspended')} installed: {a.get('installed')}")
