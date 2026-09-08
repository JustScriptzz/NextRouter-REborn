import urllib.request, json, ssl, urllib.error

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

# Test the modern Pterodactyl file-write endpoint
content = "print('write test')\n"
req = urllib.request.Request(
    f"https://{HOST}/api/client/servers/{SRV}/files/write?file=/home/container/_write_test.py",
    data=content.encode(),
    method="POST",
    headers={"Authorization": "Bearer " + KEY, "Accept": "application/json", "Content-Type": "text/plain"},
)
try:
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        print(f"WRITE OK {resp.status}")
except urllib.error.HTTPError as e:
    print(f"WRITE HTTP {e.code}: {e.read().decode()[:300]}")
except Exception as e:
    print(f"WRITE {type(e).__name__}: {e}")
