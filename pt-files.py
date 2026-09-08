import urllib.request, json, ssl

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
ctx = ssl.create_default_context()

def get(path):
    req = urllib.request.Request("https://" + HOST + path, headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            return r, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read().decode()[:300]}"

# List files in the container root
r, d = get("/api/client/servers/e7f7c97c/files?directory=/home/container")
print("files status:", r.status if r else d)
if isinstance(d, dict):
    for f in d.get("data", []):
        a = f.get("attributes", {})
        print("  ", a.get("name"), a.get("is_file") and "FILE" or "DIR", a.get("mode"))
