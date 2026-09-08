import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\identity-opus.json') as f:
    d=json.load(f)
m=d['choices'][0]['message']
print("content:", m.get('content'))
if m.get('reasoning'): print("reasoning:", m['reasoning'][:120])
