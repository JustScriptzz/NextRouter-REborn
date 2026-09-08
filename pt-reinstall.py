import urllib.request, json, ssl

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

def api(method, path, body=None):
    req = urllib.request.Request(
        f"https://{HOST}/api/client/servers/{SRV}" + path,
        data=json.dumps(body).encode() if body else None,
        method=method,
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            return r.status, r.read().decode()[:300]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:
        return 0, str(e)

# Try reinstall
print("=== REINSTALL ===")
s, b = api("POST", "/reinstall")
print(f"  {s}: {b}")

# Try rebuild
print("\n=== REBUILD ===")
s, b = api("POST", "/rebuild")
print(f"  {s}: {b}")
