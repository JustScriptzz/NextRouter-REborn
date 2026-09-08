import sys

p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()

# Add video state after the audio state
old = """  // audio state
  const [ttsText, setTtsText] = useState('Hello from NextRouter playground!');
  const [ttsModel, setTtsModel] = useState('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');"""

new = """  // audio state
  const [ttsText, setTtsText] = useState('Hello from NextRouter playground!');
  const [ttsModel, setTtsModel] = useState('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');

  // video state
  const [vidPrompt, setVidPrompt] = useState('A rocket launching through clouds in cinematic style');
  const [vidModel, setVidModel] = useState('');
  const [vidResult, setVidResult] = useState<string | null>(null);
  const [vidLoading, setVidLoading] = useState(false);
  const [vidError, setVidError] = useState('');"""

s2 = s.replace(old, new)
with open(p, 'w', encoding='utf-8') as f:
    f.write(s2)
print('ok' if s != s2 else 'no change')
