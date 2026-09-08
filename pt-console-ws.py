import WebSocket from 'ws';
import urllib.request, json, ssl

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

# Get websocket token
req = urllib.request.Request(
    f"https://{HOST}/api/client/servers/{SRV}/websocket",
    headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"},
)
with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
    data = json.loads(r.read())

ws_token = data["data"]["token"]
ws_url = data["data"]["socket"]

print("ws_url:", ws_url)
print("token:", ws_token[:30], "...")

# Connect to websocket and capture console output
ws = WebSocket.create_connection(
    f"{ws_url}?token={ws_token}",
    sslopt={"cert_reqs": ssl.CERT_NONE},
    timeout=30,
)

# send auth
ws.send(json.dumps({"event": "auth", "args": [ws_token]}))

# read output for 15 seconds
import time
start = time.time()
lines = []
while time.time() - start < 15:
    try:
        msg = ws.recv()
        d = json.loads(msg)
        if d.get("event") == "console output":
            lines.extend(d.get("args", []))
    except:
        break

ws.close()
print("\n=== CONSOLE ===")
print("".join(lines[-30:]))
