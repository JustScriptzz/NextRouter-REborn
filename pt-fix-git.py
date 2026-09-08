import urllib.request, json, ssl, urllib.parse, urllib.error, time

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()
BASE = f"https://{HOST}/api/client/servers/{SRV}/files"

def api(path, method="GET", data=None):
    req = urllib.request.Request(
        "https://" + HOST + path,
        data=data.encode() if isinstance(data, str) else data,
        method=method,
        headers={"Authorization": "Bearer " + KEY, "Accept": "application/json", "Content-Type": "text/plain"},
    )
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        return resp.status, resp.read().decode()[:200]

# Step 1: Reset git on the server (clean working tree so pull works)
s, b = api(f"/api/client/servers/{SRV}/files/write?file=/home/container/_git_clean.sh",
           "POST", "#!/bin/bash\ncd /home/container && git reset --hard HEAD 2>&1 && git clean -fd 2>&1")
print(f"write _git_clean.sh: {s}")

# Step 2: Re-upload both _run.py and run.py to match git HEAD exactly
import urllib.parse as up
for fname in ["_run.py", "run.py"]:
    with open(f"C:\\Users\\CIULL_~1\\nextrouter-reborn\\{fname}") as f:
        content = f.read()
    s = api(f"{BASE}/write?file=/home/container/{fname}", "POST", content)
    print(f"write {fname}: {s}")

# Step 3: Restart to pick up git pull + _run.py
s = api(f"/api/client/servers/{SRV}/power", "POST", json.dumps({"signal": "restart"}))
print(f"restart: {s}")
