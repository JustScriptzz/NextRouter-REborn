import urllib.request, json, ssl, urllib.error, urllib.parse

SESSION = "eyJpdiI6Ik84bjdLUzF0VkVWeVNmS0c2MExid0E9PSIsInZhbHVlIjoiYW45R3V4ZnRvOW5VQW1UQ2s4aHpjYWJMRTFRT0xmblJBUWFBWE1QTXpSZHozK2VBc2Z1QVpHQ2phU1VKWGtKYUMzWUt3QlFNeTRmeTRGSDcyNmtId1ZpWVd1eGRIc1FXVjhuckY4UG5RVGxwZ2lGejUwM3RMZG1vUkNLM0RJQlIiLCJtYWMiOiJiOTMzZGMzZGY5ZTc0MTg0OWFmYTJkMzlhN2M1NjhhODk0YmQ4YjUyMTA3NDM0ZjJmODRhMjUxMWZmMmY0ZmE0IiwidGFnIjoiIn0%3D"
XSRF = urllib.parse.unquote("eyJpdiI6ImF5NmZKRCtVUTI2cUFaT0x4dU9lNEE9PSIsInZhbHVlIjoieFF2RzJBQXNWU2hRYm1WY1R2dDFhTVhpa0F4OFZtd1A5MldGdkJmbzRtaUNKVklxeGE4V1MvVldzMnRlWnRoMmd3WHlBOExZQ05GN0FuSUhJMXJ3MXFaODdiS0RjQ2xWZExYTkQ5UEFmRmtQcnhLbWRyUjVTUkVIcjJkUGhGOS8iLCJtYWMiOiIzOTYwZWQxOTkwNjZlOWM5MDk4MTZiY2NmNzU1ZjUxMWMwNGEwY2VhMDA4MjRjMDZlNmEzNGYxMWM1MjUwZDY4IiwidGFnIjoiIn0%3D")

HOST = "host.ouadielaachkar.com"
SRV = "e7f7c97c"
ctx = ssl.create_default_context()

BASE_HEADERS = {
    "Cookie": f"pterodactyl_session={SESSION}; XSRF-TOKEN={XSRF}",
    "X-XSRF-TOKEN": XSRF,
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

def post_admin(path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        f"https://{HOST}{path}",
        data=data,
        method="POST" if body else "GET",
        headers=BASE_HEADERS,
    )
    try:
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            return r.status, r.read().decode()[:600]
    except urllib.error.HTTPError as e:
        resp = e.read().decode()[:500]
        return e.code, resp
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

def get_admin(path):
    req = urllib.request.Request(f"https://{HOST}{path}", headers=BASE_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            return r.status, r.read().decode()[:800]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

# 1) Check admin dashboard (should work if session is owner)
s, b = get_admin("/admin")
print(f"1. admin dashboard: {s}")
print(f"   {b[:200]}\n")

# 2) Try listing files via admin API
for path in [
    f"/api/admin/servers/{SRV}/filesystem?directory=/home/container",
    f"/api/admin/servers/{SRV}/filemanager?directory=/home/container",
    f"/admin/servers/{SRV}/files",
]:
    s, b = post_admin(path, {"directory": "/home/container"} if "filesystem" in path else None)
    print(f"{s} {path}\n   {b[:300]}\n")

# 3) Try writing _run.py via admin filemanager upload
with open(r"C:\Users\CIULL_~1\nextrouter-reborn\_run.py", "rb") as f:
    content = f.read()
    print(f"_run.py size: {len(content)} bytes")

# 4) Check if filemanager endpoint accepts JSON body write
write_payload = {
    "root": "/home/container",
    "files": [{"path": "_run.py", "content": content.decode("utf-8")}]
}
s, b = post_admin(f"/api/admin/servers/{SRV}/filemanager/write", write_payload)
print(f"write test: {s}")
print(f"  {b[:300]}\n")

# 5) Try the v2 filemanager (some panel versions)
s, b = post_admin(f"/admin/servers/{SRV}/files/upload", None)
print(f"upload endpoint: {s} {b[:200]}\n")
