import urllib.request, json, ssl

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

req = urllib.request.Request(
    f"https://{HOST}/api/client/servers/{SRV}/power",
    data=json.dumps({"signal": "start"}).encode(),
    method="POST",
    headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Accept": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        print("start signal:", r.status)
except urllib.error.HTTPError as e:
    print(f"{e.code}: {e.read().decode()[:300]}")
