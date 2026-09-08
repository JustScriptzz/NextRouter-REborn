import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-noremb.json', encoding='utf-8') as f:
    d = json.load(f)
models = d.get('data', [])
print('total', len(models))
emb = [m['id'] for m in models if m.get('type') == 'embedding']
print('embedding models:', emb)
