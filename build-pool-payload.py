import json

with open(r"C:\Users\ciull_yx1zjgv\nextrouter-reborn\pool-alive.txt") as f:
    urls = [u for u in f.read().split(",") if u]

payload = {
    "key": "PROXY_POOL",
    "type": "encrypted",
    "target": ["production", "preview"],
    "value": ",".join(urls),
}
with open(r"C:\Users\ciull_yx1zjgv\nextrouter-reborn\pool-env.json", "w") as f:
    json.dump(payload, f)
print("proxies:", len(urls), "| value bytes:", len(payload["value"]))
