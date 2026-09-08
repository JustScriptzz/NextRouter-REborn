import urllib.request, json, ssl

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
ctx = ssl.create_default_context()

# Restart the server to re-clone repo (AUTO_UPDATE=1) and run _run.py
req = urllib.request.Request(
    "https://" + HOST + "/api/client/servers/e7f7c97c/power",
    data=json.dumps({"signal": "restart"}).encode(),
    method="POST",
    headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Accept": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        print("restart signal:", r.status)
except urllib.error.HTTPError as e:
    print(f"restart signal HTTP {e.code}: {e.read().decode()[:300]}")
