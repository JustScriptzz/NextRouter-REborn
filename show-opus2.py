import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\identity-opus.json') as f:
    d=json.load(f)
print(json.dumps(d, indent=1)[:800])
