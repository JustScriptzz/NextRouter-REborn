import urllib.request, json, ssl, urllib.error

COOKIES = "pterodactyl_session=eyJpdiI6Ik84bjdLUzF0VkVWeVNmS0c2MExid0E9PSIsInZhbHVlIjoiYW45R3V4ZnRvOW5VQW1UQ2s4aHpjYWJMRTFRT0xmblJBUWFBWE1QTXpSZHozK2VBc2Z1QVpHQ2phU1VKWGtKYUMzWUt3QlFNeTRmeTRGSDcyNmtId1ZpWVd1eGRIc1FXVjhuckY4UG5RVGxwZ2lGejUwM3RMZG1vUkNLM0RJQlIiLCJtYWMiOiJiOTMzZGMzZGY5ZTc0MTg0OWFmYTJkMzlhN2M1NjhhODk0YmQ4YjUyMTA3NDM0ZjJmODRhMjUxMWZmMmY0ZmE0IiwidGFnIjoiIn0%3D; XSRF-TOKEN=eyJpdiI6ImF5NmZKRCtVUTI2cUFaT0x4dU9lNEE9PSIsInZhbHVlIjoieFF2RzJBQXNWU2hRYm1WY1R2dDFhTVhpa0F4OFZtd1A5MldGdkJmbzRtaUNKVklxeGE4V1MvVldzMnRlWnRoMmd3WHlBOExZQ05GN0FuSUhJMXJ3MXFaODdiS0RjQ2xWZExYTkQ5UEFmRmtQcnhLbWRyUjVTUkVIcjJkUGhGOS8iLCJtYWMiOiIzOTYwZWQxOTkwNjZlOWM5MDk4MTZiY2NmNzU1ZjUxMWMwNGEwY2VhMDA4MjRjMDZlNmEzNGYxMWM1MjUwZDY4IiwidGFnIjoiIn0%3D"

ctx = ssl.create_default_context()
HOST = "host.ouadielaachkar.com"

# The panel CSRF cookie value is URL-encoded; also provide the raw XSRF
# Try a few panel routes to see what's authenticated
for path in ["/", "/admin", "/api/client", "/index.php/dashboard"]:
    req = urllib.request.Request("https://" + HOST + path, headers={
        "Cookie": COOKIES,
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            raw = r.read().decode(errors="replace")
            is_panel = "Pterodactyl" in raw or "dashboard" in raw.lower()
            print(f"{r.status} {path} len={len(raw)} panel={is_panel}")
    except urllib.error.HTTPError as e:
        print(f"{e.code} {path}: {e.read().decode(errors='replace')[:200]}")
    except Exception as e:
        print(f"ERR {path}: {type(e).__name__} {str(e)[:150]}")
