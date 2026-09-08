import sys

p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()

old = """                (tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : models.filter((m) => m.type === 'tts'))"""

new = """                (tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : tab === 'video' ? models.filter((m) => m.type === 'video') : models.filter((m) => m.type === 'tts'))"""

s2 = s.replace(old, new)
with open(p, 'w', encoding='utf-8') as f:
    f.write(s2)
print('ok' if s != s2 else 'no change')