import urllib.request, json, ssl

BASE = "https://host.ouadielaachkar.com/api/client"
KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
ctx = ssl.create_default_context()

def get(path):
    req = urllib.request.Request(BASE + path, headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]

s, accounts = get("/servers")
print("servers status:", s)
if isinstance(accounts, dict):
    data = accounts.get("data", accounts)
else:
    data = accounts
for a in data if isinstance(data, list) else []:
    attrs = a.get("attributes", a)
    print("server:", attrs.get("identifier"), "|", attrs.get("name"), "|", attrs.get("status"), "| node:", attrs.get("node"))
    print("   limits:", attrs.get("limits"))
    print("   egg:", (attrs.get("relationships", {}).get("egg", {}).get("attributes", {}) or {}).get("name"))
    runtime = attrs.get("relationships", {}).get("server", {}).get("attributes", {}).get("container", {})
    print("   container:", runtime)
else:
    print("raw:", str(accounts)[:600])
