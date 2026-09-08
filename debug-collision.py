import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-debug.json') as f:
    d=json.load(f)
models=d.get('data',[])
def norm(s): return s.replace('-','')
targets={'qwen-image-2.0-pro':'qwenimage2.0pro','qwen-image-3.0-pro':'qwenimage3.0pro','grok-imagine-2':'grokimagine2','qwen-video':'qwenvideo'}
# build map normalized->[ids]
groups={}
for m in models:
    n=norm(m['id'])
    groups.setdefault(n,[]).append((m['id'],m.get('type')))
for seed,normid in targets.items():
    print(f"seed {seed} (norm={normid}):")
    found=False
    for n,items in groups.items():
        if n==normid or n in (normid, ):
            print(f"  collision group: {items}")
            found=True
    # also partial
    if not found:
        # prefix/suffix overlap
        for n,items in groups.items():
            if normid and (normid.startswith(n) or n.startswith(normid)) and normid != n:
                print(f"  prefix/overlap with {n}: {items}")
