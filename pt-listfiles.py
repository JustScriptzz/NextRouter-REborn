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

# Probe likely list endpoints for this Pterodactyl version
for path in [
    f"/api/client/servers/{SRV}/files?directory=%2Fhome%2Fcontainer",
    f"/api/client/servers/{SRV}/files/list?directory=%2Fhome%2Fcontainer",
    f"/api/client/servers/{SRV}/files/first",
]:
    s, d = get(path)
    print(f"{s} {path}")
    if isinstance(d, dict) and "data" in d:
        for f in d["data"]:
            a = f.get("attributes", {})
            print(f"   {a.get('name')} {'DIR' if a.get('is_file') is False else 'FILE'} {a.get('size')}")
    else:
        print("   ", str(d)[:250])
    print()
