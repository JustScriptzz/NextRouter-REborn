import sys

p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()

old = """const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
] as const;"""

new = """const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
] as const;"""

s2 = s.replace(old, new)
with open(p, 'w', encoding='utf-8') as f:
    f.write(s2)
print('ok' if s != s2 else 'no change')
