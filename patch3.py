import sys

p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()

old = """        const ttsFirst = list.find((m) => m.type === 'tts');
        if (ttsFirst) setTtsModel(ttsFirst.id);"""

new = """        const ttsFirst = list.find((m) => m.type === 'tts');
        if (ttsFirst) setTtsModel(ttsFirst.id);
        const vidFirst = list.find((m) => m.type === 'video');
        if (vidFirst) setVidModel(vidFirst.id);"""

s2 = s.replace(old, new)
with open(p, 'w', encoding='utf-8') as f:
    f.write(s2)
print('ok' if s != s2 else 'no change')
