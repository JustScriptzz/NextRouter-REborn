import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\status-after.json') as f:
    d=json.load(f)
for m in d.get('models',[]):
    if m['id']=='glm-5.2':
        print("glm-5.2:", json.dumps(m, indent=2))
# count dead vs live pipes
dead, live = 0, 0
for m in d.get('models',[]):
    if m.get('avail', 0) is not None and m['avail'] >= 0.5:
        live += 1
    elif m.get('avail') is not None:
        dead += 1
print(f"live(>=50%):{live}  dead(<50%):{dead}")