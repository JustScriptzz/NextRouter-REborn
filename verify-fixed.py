import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-fixed.json') as f:
    d=json.load(f)
models=d.get('data',[])
print("total:", len(models))
# image + video types
img = [m for m in models if m.get('type')=='image']
vid = [m for m in models if m.get('type')=='video']
print(f"image models ({len(img)}):")
for m in img: print("  ", m['id'])
print(f"video models ({len(vid)}):")
for m in vid: print("  ", m['id'])
# check for specific possibly-missing
for probe in ['qwen-image-2.0-pro','qwen-image-3.0-pro','gpt-image-2','grok-imagine-2','qwen-video','gemma-3-12b']:
    hit = any(m['id']==probe for m in models)
    print(f"  {probe}: {'FOUND' if hit else 'MISSING'}")