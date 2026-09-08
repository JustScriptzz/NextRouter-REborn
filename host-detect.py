import urllib.request, ssl, socket

# Try to identify the hosting provider by reverse DNS / whois-ish info
ctx = ssl.create_default_context()
ip = "89.28.205.45"

try:
    host = socket.gethostbyaddr(ip)
    print("reverse DNS:", host[0])
except Exception as e:
    print("reverse DNS err:", e)

# Fetch provider info from ip-api (free geo/ASN lookup)
try:
    req = urllib.request.Request(f"http://ip-api.com/json/{ip}", headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
        print(r.read().decode()[:500])
except Exception as e:
    print("ip-api err:", e)

# Try RDAP for the network owner
try:
    req = urllib.request.Request(f"https://rdap.org/ip/{ip}", headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
        data = r.read().decode()[:600]
        print("RDAP:", data[:400])
except Exception as e:
    print("rdap err:", e)
