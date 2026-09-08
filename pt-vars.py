import urllib.request, json, ssl

KEY = "ptlc_3pwoFVLWZnpQG4VCroVuGIjMYwcS83WfCSMAiqdFh0H"
HOST = "host.ouadielaachkar.com"
ctx = ssl.create_default_context()

def get(path):
    req = urllib.request.Request("https://" + HOST + path, headers={"Authorization": "Bearer " + KEY, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return json.loads(r.read())

d = get("/api/client/servers/e7f7c97c")
a = d["attributes"]
rel = a.get("relationships", {})
print("=== VARS ===")
for v in rel.get("variables", {}).get("data", []):
    va = v["attributes"]
    print(f"  {va.get('env_variable')} = {va.get('server_value') or va.get('default_value')}  [rules: {va.get('rules')}]")
print("=== ALLOC ===")
for aloc in rel.get("allocations", {}).get("data", []):
    aa = aloc["attributes"]
    print(f"  default? {aa.get('is_default')} -> {aa.get('ip_alias')}:{aa.get('port')}")
print("=== FS/USER ===")
print("docker_image:", a.get("docker_image"))
