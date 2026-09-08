import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-seed2.json') as f:
    d=json.load(f)
models=d.get('data',[])
# print image models
print("IMAGE:")
for m in models:
    if m.get('type')=='image': print("  ", m['id'])
print("\nContains 'image':")
for m in models:
    if 'image' in m['id']: print("  ", m['id'], m.get('type'))
print("\nContains 'qwen':")
for m in models:
    if 'qwen' in m['id'].lower(): print("  ", m['id'], m.get('type'))
