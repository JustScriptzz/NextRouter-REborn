import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\img-models.json') as f:
    d=json.load(f)
models=d.get('data',[])
print("IMAGE models:")
for m in models:
    if m.get('type')=='image': print("  ", m['id'])
print("\nVIDEO models:")
for m in models:
    if m.get('type')=='video': print("  ", m['id'])
print("\nTOTAL:", len(models))
