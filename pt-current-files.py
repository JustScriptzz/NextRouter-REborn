import urllib.request, json, ssl

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
ctx = ssl.create_default_context()

req = urllib.request.Request(
    f"https://{HOST}/api/client/servers/e7f7c97c/files/list?directory=%2Fhome%2Fcontainer",
    headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        d = json.loads(r.read())
        files = d.get("data", [])
        print(f"Files: {len(files)}")
        for f in files:
            a = f.get("attributes", {})
            is_dir = not a.get("is_file", True)
            print(f"  {'DIR' if is_dir else 'FIL'} {a.get('name')}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:300]}")
