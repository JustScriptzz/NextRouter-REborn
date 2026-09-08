import json, ssl, urllib.request
from urllib.parse import urlparse
import http.client, os, hashlib, base64

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def api(path):
    req = urllib.request.Request("https://" + HOST + path, headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30, context=ssl.create_default_context()) as r:
        return json.loads(r.read())

data = api(f"/api/client/servers/{SRV}/websocket")
ws_token = data["data"]["token"]
ws_url = data["data"]["socket"]

parsed = urlparse(ws_url)
ws_host = parsed.hostname
ws_port = parsed.port or 443
ws_path = f"{parsed.path}?{parsed.query}" if parsed.query else parsed.path

print(f"ws_host={ws_host} ws_port={ws_port}")
print(f"ws_path={ws_path}")

nonce = base64.b64encode(os.urandom(16)).decode()
raw = http.client.HTTPSConnection(ws_host, ws_port, context=ctx, timeout=10)
raw.request("GET", ws_path, headers={
    "Host": f"{ws_host}:{ws_port}",
    "Upgrade": "websocket",
    "Connection": "Upgrade",
    "Sec-WebSocket-Version": "13",
    "Sec-WebSocket-Key": nonce,
})
resp = raw.getresponse()
print("upgrade:", resp.status, resp.getheader("Upgrade"))

if resp.status == 101:
    sock = raw.sock
    sock.settimeout(15)
    all_lines = []
    try:
        for _ in range(100):
            data = sock.recv(65536)
            if not data:
                break
            if len(data) > 2:
                payload = data[2:]
                text = payload.decode("utf-8", errors="replace")
                try:
                    d = json.loads(text)
                    if d.get("event") == "console output":
                        all_lines.extend(d.get("args", []))
                except:
                    pass
    except Exception as e:
        print("read err:", e)
    print("\n=== CONSOLE ===")
    print("".join(all_lines[-30:]))
    sock.close()
