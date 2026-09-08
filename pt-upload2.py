import urllib.request, json, ssl, urllib.parse, urllib.error

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()
BASE = f"https://{HOST}/api/client/servers/{SRV}/files"

def write_file(remote, local_content):
    req = urllib.request.Request(
        BASE + "/write?file=" + urllib.parse.quote(remote, safe="/"),
        data=local_content.encode(),
        method="POST",
        headers={"Authorization": "Bearer " + KEY, "Accept": "application/json", "Content-Type": "text/plain"},
    )
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        return resp.status

with open(r"C:\Users\CIULL_~1\nextrouter-reborn\_run.py") as f:
    print("_run.py:", write_file("/home/container/_run.py", f.read()))
