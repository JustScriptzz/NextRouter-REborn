import urllib.request, json, ssl, urllib.error

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

def get(path):
    req = urllib.request.Request("https://" + HOST + path, headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

# Read back _run.py content through the file API
s, b = get(f"/api/client/servers/{SRV}/files/contents?file=%2Fhome%2Fcontainer%2F_run.py")
print("contents _run.py:", s)
print(b[:300])

# Get server details incl sftp
s2, b2 = get(f"/api/client/servers/{SRV}")
try:
    a = json.loads(b2)["attributes"]
    print("\nSFTP details:", json.dumps(a.get("sftp_details", {})))
    # allocation
    for al in a.get("relationships", {}).get("allocations", {}).get("data", []):
        aa = al["attributes"]
        print("allocation:", aa.get("ip_alias"), aa.get("port"))
except Exception as e:
    print("srv parse err:", e, b2[:200])
