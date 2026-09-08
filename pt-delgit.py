import urllib.request, json, ssl, urllib.error, urllib.parse

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

def post(path, payload, content_type="application/json"):
    req = urllib.request.Request(
        "https://" + HOST + path,
        data=json.dumps(payload).encode() if isinstance(payload, (dict, list)) else payload.encode(),
        method="POST",
        headers={"Authorization": "Bearer " + KEY, "Accept": "application/json", "Content-Type": content_type},
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            return r.status, (r.read().decode()[:200] if r.status not in (204, 202) else "ok")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

# Try delete .git via Pterodactyl file delete endpoint (JSON body form)
for path, payload, ct in [
    (f"/api/client/servers/{SRV}/files/delete", {"root": "/home/container", "files": [".git"]}, "application/json"),
    (f"/api/client/servers/{SRV}/files?path=%2Fhome%2Fcontainer", None, "application/json"),
]:
    if payload is None:
        s, b = post(path, {}, ct)
    else:
        s, b = post(path, payload, ct)
    print(f"{s} POST {path}\n  {b}\n")
