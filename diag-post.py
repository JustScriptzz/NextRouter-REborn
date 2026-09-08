import urllib.request, json

body = b'{}'
req = urllib.request.Request(
    "https://api.render.com/v1/services",
    data=body,
    method="POST",
    headers={
        "Authorization": "Bearer rnd_wdMmv9rsA4JEXBFJGFwuOMa83qpF",
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("200:", r.read().decode()[:500])
except urllib.error.HTTPError as e:
    print(f"{e.code}: {e.read().decode()[:500]}")
except Exception as e:
    print(f"Error: {e}")
