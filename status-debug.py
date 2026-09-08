import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\status-debug.json') as f:
    d=json.load(f)
models=d.get('models',[])
print("status total:", len(models))
for probe in ['qwen-image-2.0-pro','qwen-image-3.0-pro','grok-imagine-2','qwen-video','qwen-image-4.0-pro','grok-imagine-3']:
    for m in models:
        if m['id']==probe:
            print(f"  FOUND: {probe} type={m.get('type')} providers={m.get('providers')}")
            break
    else:
        print(f"  MISSING: {probe}")
# also check served_by crax with 'qwen' or 'image'
print("\nAll models with qwen-image or grok-imagine:")
for m in models:
    if 'qwen-image' in m['id'] or 'grok-imagine' in m['id']:
        print("  ", m['id'], m.get('type'), m.get('providers'))
