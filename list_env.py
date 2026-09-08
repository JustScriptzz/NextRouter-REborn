import os
p = r'C:\Users\CIULL_~1\nextrouter-reborn\.env.local'
if not os.path.exists(p):
    print('NO .env.local')
    raise SystemExit
with open(p, encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\n')
        if not line or '=' not in line or line.startswith('#'):
            continue
        k, _, v = line.partition('=')
        if k.strip().isupper() or '_' in k:
            # show key + length + whether it looks like a placeholder/empty
            val = v.strip()
            print(f"{k.strip()} | len={len(val)} | starts={val[:12] if val else '(empty)'}")
