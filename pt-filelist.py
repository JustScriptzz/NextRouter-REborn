import urllib.request, json, ssl, urllib.error

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

def req(method, path, data=None, raw=False):
    r = urllib.request.Request("https://" + HOST + path, data=data, method=method,
        headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    if data is not None and not raw:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30, context=ctx) as resp:
            return resp.status, resp.read().decode()[:400]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

for path in [
    f"/api/client/servers/{SRV}/files?directory=/home/container",
    f"/api/client/servers/{SRV}/file/list",
    f"/api/client/servers/{SRV}/sftp",
]:
    s, b = req("GET", path)
    print(f"{s} GET {path}\n   {b}\n")
