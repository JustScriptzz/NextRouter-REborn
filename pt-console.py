import urllib.request, json, ssl

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
ctx = ssl.create_default_context()

def get(path):
    req = urllib.request.Request("https://" + HOST + path, headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return json.loads(r.read())

# Server resource/state + console output
d = get("/api/client/servers/e7f7c97c")
a = d["attributes"]
print("status:", a.get("status"), "| suspended:", a.get("suspended"), "| installed:", a.get("installed"))

try:
    cons = get("/api/client/servers/e7f7c97c/console")
    print("\n=== console data ===")
    print(json.dumps(cons, indent=2)[:1200])
except Exception as e:
    print("console error:", e)
