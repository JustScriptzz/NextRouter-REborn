import json
with open(r'C:\Users\CIULL_~1\nextrouter-reborn\envs-latest.json', encoding='utf-8') as f:
    d = json.load(f)
for e in d.get('envs', []):
    k = e.get('key','')
    if 'DATABASE' in k.upper() or 'SUPABASE' in k.upper() or 'SMTP' in k.upper() or 'MAIL' in k.upper() or 'POSTGRES' in k.upper():
        v = e.get('value','')
        print(k, 'len=', len(v), 'head=', v[:60])
        # try to identify provider
        low = v.lower()
        if 'supabase' in low: print('   -> SUPABASE')
        if 'neon' in low: print('   -> NEON')
