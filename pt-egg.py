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
print("name:", a.get("name"))
print("egg name:", (a.get("relationships", {}).get("egg", {}).get("attributes", {})).get("name"))
print("egg uuid:", (a.get("relationships", {}).get("egg", {}).get("attributes", {})).get("uuid"))
print("nest:", (a.get("relationships", {}).get("egg", {}).get("attributes", {})).get("nest"))
# print the full dump of relevant keys
print(json.dumps({k: v for k, v in a.items() if k in ('description','startup','image','docker_image','egg_attributes','relationships')}, indent=2)[:1500])
