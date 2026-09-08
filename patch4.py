import sys

p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()

# Update curl preview ternary to include video branch
old = """      : tab === 'image'
        ? `curl https://nextrouter-vert.vercel.app/api/v1/images/generations \\\\
  -H "Authorization: Bearer ${keyMasked || 'nr_...'} " \\\\
  -d '{"model":"${imgModel}", "prompt":"${imgPrompt.slice(0, 30)}..."}'`
        : `curl https://nextrouter-vert.vercel.app/api/v1/audio/speech ...`;"""

new = """      : tab === 'image'
        ? `curl https://nextrouter-vert.vercel.app/api/v1/images/generations \\\\
  -H "Authorization: Bearer ${keyMasked || 'nr_...'} " \\\\
  -d '{"model":"${imgModel}", "prompt":"${imgPrompt.slice(0, 30)}..."}'`
        : tab === 'video'
          ? `curl https://nextrouter-vert.vercel.app/api/v1/videos/generations \\\\
  -H "Authorization: Bearer ${keyMasked || 'nr_...'} " \\\\
  -d '{"model":"${vidModel}", "prompt":"${vidPrompt.slice(0, 30)}..."}'`
          : `curl https://nextrouter-vert.vercel.app/api/v1/audio/speech ...`;"""

s2 = s.replace(old, new)
with open(p, 'w', encoding='utf-8') as f:
    f.write(s2)
print('ok' if s != s2 else 'no change')
