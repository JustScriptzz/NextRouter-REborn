import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-seed2.json') as f:
    d=json.load(f)
models=d.get('data',[])
ids=[m['id'] for m in models]
bytype={}
for m in models:
    bytype.setdefault(m.get('type'),[]).append(m['id'])
print("total:", len(models))
print("types:", {k:len(v) for k,v in bytype.items()})
for probe in ['qwen-image-2.0-pro','qwen-image-3.0-pro','grok-imagine-2','qwen-video']:
    for m in models:
        if m['id']==probe:
            print(f"  {probe}: FOUND type={m.get('type')}")
            break
    else:
        print(f"  {probe}: MISSING")
print("image count:", len(bytype.get('image',[])))
print("video count:", len(bytype.get('video',[])))
