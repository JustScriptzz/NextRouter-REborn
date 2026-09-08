import urllib.request, json, ssl, urllib.parse, urllib.error, time

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

BASE = f"https://{HOST}/api/client/servers/{SRV}/files"

def write_file(remote, content):
    url = BASE + "/write?file=" + urllib.parse.quote(remote, safe="/")
    req = urllib.request.Request(url, data=content.encode(), method="POST",
        headers={"Authorization": "Bearer " + KEY, "Accept": "application/json", "Content-Type": "text/plain"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        return resp.status

def restart():
    url = f"https://{HOST}/api/client/servers/{SRV}/power"
    req = urllib.request.Request(url, data=json.dumps({"signal":"start"}).encode(), method="POST",
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        return resp.status

with open(r"C:\Users\ciull_yx1zjgv\nextrouter-reborn\_run.py") as f:
    run = f.read()
with open(r"C:\Users\ciull_yx1zjgv\nextrouter-reborn\run.py") as f:
    run_alias = f.read()

print("upload _run.py:", write_file("/home/container/_run.py", run))
print("upload run.py:", write_file("/home/container/run.py", run_alias))
print("restart:", restart())
