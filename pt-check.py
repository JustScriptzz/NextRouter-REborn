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
print("status:", a.get("status"))
print("suspended:", a.get("suspended"))
print("installed:", a.get("installed"))

# Check if there's resource usage data
for k in ['container', 'current_state', 'resources', 'cpu', 'memory', 'disk']:
    v = a.get(k)
    if v is not None:
        print(f"{k}: {v}")

# Also check if maybe the server is still "starting" 
print("uptime:", a.get("uptime"))
print("cpu_usage:", a.get("cpu"))
print("memory_usage:", a.get("disk", {}).get("used") if isinstance(a.get("disk"), dict) else a.get("disk_bytes"))
