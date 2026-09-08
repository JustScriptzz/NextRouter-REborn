import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-p110.json', encoding='utf-8') as f:
    data = json.load(f)
imgs = [m['id'] for m in data.get('data', []) if m.get('type') == 'image']
print(len(imgs))
for i in imgs:
    print(' ', i)
