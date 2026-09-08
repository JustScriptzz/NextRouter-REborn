import urllib.request, json, ssl, socket

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
ctx = ssl.create_default_context()

def get(path):
    req = urllib.request.Request("https://" + HOST + path, headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            return r.status, r.read().decode()[:800]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

# Try a few likely client API routes to find the server identifier + its egg
for path in [
    "/api/client",
    "/api/client/servers",
    "/api/client/servers/e7f7c97c",
    "/api/application/servers/e7f7c97c",
    "/api/client/servers/e7f7c97c/websocket",
]:
    s, body = get(path)
    print(f"{s} {path}\n   {body[:300]}\n")
