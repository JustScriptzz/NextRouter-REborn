import urllib.request, json, ssl, urllib.error

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

for path in [
    "/api/client/servers/e7f7c97c/logs",
    "/api/client/servers/e7f7c97c/console?lines=80",
    "/api/client/servers/e7f7c97c/events",
    "/api/client/servers/e7f7c97c/activity",
]:
    try:
        req = urllib.request.Request(
            f"https://{HOST}{path}",
            headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            body = r.read().decode()[:1000]
            print(f"200 {path}\n  {body[:500]}\n")
    except urllib.error.HTTPError as e:
        print(f"{e.code} {path}: {e.read().decode()[:200]}\n")
    except Exception as e:
        print(f"ERR {path}: {e}\n")
