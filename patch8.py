import sys

p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()

# 1) Update the "Model list" filter ternary
old = """              {(tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : models.filter((m) => m.type === 'tts')).length === 0 ? ("""
new = """              {(tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : tab === 'video' ? models.filter((m) => m.type === 'video') : models.filter((m) => m.type === 'tts')).length === 0 ? ("""

# 2) Update the list rendering ternary
old2 = """                    (tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : models.filter((m) => m.type === 'tts'))"""
new2 = """                    (tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : tab === 'video' ? models.filter((m) => m.type === 'video') : models.filter((m) => m.type === 'tts'))"""

# 3) Update the "no models" message
old3 = """                <p className="py-6 text-center text-xs text-zinc-500">No models match.</p>"""
new3 = """                <p className="py-6 text-center text-xs text-zinc-500">No models match.</p>"""  # unchanged

# 4) Update the model card text label
old4 = """              {tab === 'chat' ? 'Chat model' : tab === 'image' ? 'Image model' : 'Voice model'}"""
new4 = """              {tab === 'chat' ? 'Chat model' : tab === 'image' ? 'Image model' : tab === 'video' ? 'Video model' : 'Voice model'}"""

# 5) Update the "Voice" empty-state text — actually keep that as is, but let's update the empty state in the "TTS" case
# 6) Update the model select to include video when video tab is active
old5 = """                      (tab === 'chat' && m.id === selectedModel) ||
                      (tab === 'image' && m.id === imgModel) ||
                      (tab === 'audio' && m.id === ttsModel);"""
new5 = """                      (tab === 'chat' && m.id === selectedModel) ||
                      (tab === 'image' && m.id === imgModel) ||
                      (tab === 'video' && m.id === vidModel) ||
                      (tab === 'audio' && m.id === ttsModel);"""

# 7) Update the model select handler
old6 = """                          if (tab === 'chat') setSelectedModel(m.id);
                          else if (tab === 'image') setImgModel(m.id);
                          else setTtsModel(m.id);"""
new6 = """                          if (tab === 'chat') setSelectedModel(m.id);
                          else if (tab === 'image') setImgModel(m.id);
                          else if (tab === 'video') setVidModel(m.id);
                          else setTtsModel(m.id);"""

# Apply all replacements
for o, n in [(old, new), (old2, new2), (old4, new4), (old5, new5), (old6, new6)]:
    s2 = s.replace(o, n)
    if s2 == s:
        print('no change for:', o[:60])
    s = s2
with open(p, 'w', encoding='utf-8') as f:
    f.write(s)
print('done')
