import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-latest.json') as f:
    d=json.load(f)
models=d.get('data',[])
print("total:", len(models))
by_type={}
for m in models:
    by_type.setdefault(m.get('type'),0)
    by_type[m.get('type')]+=1
print("types:", by_type)
for probe in ['qwen-image-2.0-pro','qwen-image-3.0-pro','grok-imagine-2','qwen-video','qwen-image-4.0-pro','grok-imagine-3']:
    for m in models:
        if m['id']==probe:
            print(f"  FOUND: {probe} type={m.get('type')}")
            break
    else:
        print(f"  MISSING: {probe}")