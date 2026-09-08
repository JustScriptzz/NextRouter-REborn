import urllib.request, json, ssl, urllib.error

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
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}: {e.read().decode()[:200]}"
    except Exception as e:
        return f"{type(e).__name__}: {e}"

import urllib.parse

with open(r"C:\Users\CIULL_~1\nextrouter-reborn\_run.py", encoding="utf-8") as f:
    run_content = f.read()
with open(r"C:\Users\CIULL_~1\nextrouter-reborn\run.py", encoding="utf-8") as f:
    run_alias = f.read()

print("write /home/container/_run.py:", write_file("/home/container/_run.py", run_content))
print("write /home/container/run.py:", write_file("/home/container/run.py", run_alias))
