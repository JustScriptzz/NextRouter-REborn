import urllib.request, json, ssl

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
ctx = ssl.create_default_context()

def get(path):
    req = urllib.request.Request("https://" + HOST + path, headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return json.loads(r.read())

d = get("/api/client/servers/e7f7c97c")
a = d["attributes"]
print("name:", a.get("name"))
print("status:", a.get("status"))
print("suspended:", a.get("suspended"))
print("installed:", a.get("installed"))
print("limits:", json.dumps(a.get("limits", {})))
