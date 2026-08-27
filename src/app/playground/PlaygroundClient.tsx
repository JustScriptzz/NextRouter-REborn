'use client';

import { useEffect, useRef, useState } from 'react';

type Model = { id: string; title: string; type: string; isFallback: boolean };
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function PlaygroundClient() {
  const [models, setModels] = useState<Model[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyMasked, setKeyMasked] = useState('');
  const [tab, setTab] = useState<TabId>('chat');

  // chat state
  const [selectedModel, setSelectedModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [temperature, setTemperature] = useState(1);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [stream, setStream] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [modelSearch, setModelSearch] = useState('');

  // image state
  const [imgPrompt, setImgPrompt] = useState('A cinematic photo of a cat astronaut');
  const [imgModel, setImgModel] = useState('');
  const [imgSize, setImgSize] = useState('1024x1024');
  const [imgResult, setImgResult] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState('');

  // audio state
  const [ttsText, setTtsText] = useState('Hello from NextRouter playground!');
  const [ttsModel, setTtsModel] = useState('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // load models
  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => {
        const list: Model[] = d.models ?? [];
        setModels(list);
        const textFirst = list.find((m) => m.type === 'text');
        if (textFirst) setSelectedModel(textFirst.id);
        const imgFirst = list.find((m) => m.type === 'image');
        if (imgFirst) setImgModel(imgFirst.id);
        const ttsFirst = list.find((m) => m.type === 'tts');
        if (ttsFirst) setTtsModel(ttsFirst.id);
      })
      .catch(() => {});
  }, []);

  // load / create API key
  useEffect(() => {
    fetch('/api/keys')
      .then((r) => r.json())
      .then(async (d) => {
        const keys = d.keys ?? [];
        if (keys.length > 0) {
          // try to get a usable key: we only have masked, so create a dedicated playground key
          const res = await fetch('/api/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Playground' }),
          });
          const j = await res.json();
          if (j.key) {
            setApiKey(j.key);
            setKeyMasked(j.masked);
          } else {
            // fallback: tell user to create one
            setKeyMasked(keys[0].masked);
          }
        } else {
          const res = await fetch('/api/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Playground' }),
          });
          const j = await res.json();
          if (j.key) {
            setApiKey(j.key);
            setKeyMasked(j.masked);
          }
        }
      })
      .catch(() => {});
  }, []);

  const filteredTextModels = models.filter((m) => m.type === 'text' && m.id.toLowerCase().includes(modelSearch.toLowerCase()));
  const curlPreview =
    tab === 'chat'
      ? `curl https://nextrouter-vert.vercel.app/api/v1/chat/completions \\
  -H "Authorization: Bearer ${keyMasked || 'nr_...'} " \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel || 'kiro-auto'}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": ${stream},
    "temperature": ${temperature}
  }'`
      : tab === 'image'
        ? `curl https://nextrouter-vert.vercel.app/api/v1/images/generations \\
  -H "Authorization: Bearer ${keyMasked || 'nr_...'} " \\
  -d '{"model":"${imgModel}", "prompt":"${imgPrompt.slice(0, 30)}..."}'`
        : `curl https://nextrouter-vert.vercel.app/api/v1/audio/speech ...`;

  async function sendChat() {
    if (!input.trim() || !selectedModel || !apiKey) {
      if (!apiKey) setError('No API key available — create one in /keys (a Playground key should be auto-created).');
      return;
    }
    const userMsg: Msg = { role: 'user', content: input.trim() };
    const history: Msg[] = [];
    if (systemPrompt.trim()) history.push({ role: 'system', content: systemPrompt.trim() });
    history.push(...messages, userMsg);
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setError('');
    setLoading(true);

    const payload = {
      model: selectedModel,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
      stream,
    };

    try {
      if (!stream) {
        const res = await fetch('/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || 'Request failed');
        const content = j.choices?.[0]?.message?.content ?? JSON.stringify(j, null, 2);
        const reasoning = j.choices?.[0]?.message?.reasoning;
        setMessages((m) => [...m, { role: 'assistant', content: reasoning ? `**Reasoning:** ${reasoning}\n\n${content}` : content }]);
      } else {
        const res = await fetch('/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, stream: true }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error?.message || `HTTP ${res.status}`);
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No stream');
        const decoder = new TextDecoder();
        let acc = '';
        let reasoningAcc = '';
        setMessages((m) => [...m, { role: 'assistant', content: '' }]);
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const j = JSON.parse(data);
              const delta = j.choices?.[0]?.delta;
              if (delta?.reasoning) reasoningAcc += delta.reasoning;
              if (delta?.content) acc += delta.content;
              if (delta?.reasoning || delta?.content) {
                const display = reasoningAcc ? `*Thinking:* ${reasoningAcc}\n\n${acc}` : acc;
                setMessages((m) => {
                  const copy = [...m];
                  copy[copy.length - 1] = { role: 'assistant', content: display || '...' };
                  return copy;
                });
              }
            } catch {}
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function generateImage() {
    if (!imgPrompt.trim() || !imgModel || !apiKey) return;
    setImgLoading(true);
    setImgError('');
    setImgResult(null);
    try {
      const res = await fetch('/api/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: imgModel, prompt: imgPrompt, n: 1, size: imgSize }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Failed');
      const b64 = j.data?.[0]?.b64_json;
      const url = j.data?.[0]?.url;
      if (b64) setImgResult(`data:image/png;base64,${b64}`);
      else if (url) setImgResult(url);
      else setImgResult(null);
    } catch (e: unknown) {
      setImgError(e instanceof Error ? e.message : String(e));
    } finally {
      setImgLoading(false);
    }
  }

  async function synthesize() {
    if (!ttsText.trim() || !ttsModel || !apiKey) return;
    setTtsLoading(true);
    setTtsError('');
    setTtsAudioUrl(null);
    try {
      const res = await fetch('/api/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ttsModel, input: ttsText }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      setTtsAudioUrl(URL.createObjectURL(blob));
    } catch (e: unknown) {
      setTtsError(e instanceof Error ? e.message : String(e));
    } finally {
      setTtsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Playground</h1>
          <p className="mt-1 text-sm text-zinc-400">Try any model live — chat, image and audio. Your Playground API key is auto-created.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-white/5 px-3 py-1.5 font-mono text-zinc-400">{keyMasked || 'no key yet'}</span>
          <a href="/keys" className="btn-ghost px-3 py-1.5 text-xs">
            Manage keys
          </a>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-6 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === t.id ? 'bg-violet-500/20 text-violet-200' : 'text-zinc-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* left: model picker + settings */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              {tab === 'chat' ? 'Chat model' : tab === 'image' ? 'Image model' : 'Voice model'}
            </h3>
            <input
              placeholder="Search models..."
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              className="input-dark mt-3 py-2 text-xs"
            />
            <div className="mt-3 max-h-[320px] space-y-1 overflow-y-auto pr-1">
              {(tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : models.filter((m) => m.type === 'tts')).length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">No models</p>
              ) : (
                (tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : models.filter((m) => m.type === 'tts'))
                  .filter((m) => !modelSearch || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                  .slice(0, 80)
                  .map((m) => {
                    const active =
                      (tab === 'chat' && m.id === selectedModel) ||
                      (tab === 'image' && m.id === imgModel) ||
                      (tab === 'audio' && m.id === ttsModel);
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (tab === 'chat') setSelectedModel(m.id);
                          else if (tab === 'image') setImgModel(m.id);
                          else setTtsModel(m.id);
                        }}
                        className={`w-full truncate rounded-lg px-2.5 py-2 text-left font-mono text-xs transition ${active ? 'bg-violet-500/20 text-violet-200' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                      >
                        {m.id}
                      </button>
                    );
                  })
              )}
            </div>
            {tab === 'chat' && (
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                {models.filter((m) => m.type === 'text').length} text models. Uses your Playground key automatically.
              </p>
            )}
          </div>

          {tab === 'chat' && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Parameters</h3>
              <label className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                <span>Temperature {temperature.toFixed(2)}</span>
                <input type="range" min={0} max={2} step={0.05} value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="ml-3 flex-1 accent-violet-500" />
              </label>
              <label className="mt-3 block text-xs text-zinc-400">
                Max tokens
                <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)} className="input-dark mt-1 py-1.5 text-xs" />
              </label>
              <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} className="accent-violet-500" />
                Stream response
              </label>
              <label className="mt-3 block text-xs text-zinc-400">
                System prompt
                <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="You are a helpful assistant..." rows={3} className="input-dark mt-1 py-2 text-xs" />
              </label>
            </div>
          )}

          {tab === 'image' && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Image options</h3>
              <label className="mt-3 block text-xs text-zinc-400">
                Size
                <select value={imgSize} onChange={(e) => setImgSize(e.target.value)} className="input-dark mt-1 py-2 text-xs">
                  <option value="512x512">512×512</option>
                  <option value="1024x1024">1024×1024</option>
                  <option value="1024x1792">1024×1792</option>
                  <option value="1792x1024">1792×1024</option>
                </select>
              </label>
            </div>
          )}

          <div className="card bg-zinc-950/60 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">curl preview</div>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-400">{curlPreview}</pre>
          </div>
        </div>

        {/* right: playground */}
        <div className="card flex min-h-[540px] flex-col overflow-hidden">
          {tab === 'chat' && (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" style={{ maxHeight: '560px' }}>
                {messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-violet-300">
                      <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden>
                        <path d="M4 6.5A2.5 2.5 0 016.5 4h4A2.5 2.5 0 0113 6.5v3A2.5 2.5 0 0110.5 12h-1L6 15v-3H4A2.5 2.5 0 011.5 9.5v-3A2.5 2.5 0 014 4z" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </div>
                    <p className="mt-4 text-sm font-medium text-zinc-200">Start a conversation</p>
                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">Pick a model on the left. Messages run through the same gateway your API key uses — with automatic failover.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-violet-600 text-white' : m.role === 'system' ? 'border border-amber-500/20 bg-amber-500/10 text-amber-200' : 'border border-white/10 bg-white/5 text-zinc-100'}`}>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">{m.role}</div>
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {error && <div className="border-t border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div>}
              <div className="border-t border-white/10 p-3">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    placeholder={selectedModel ? `Message ${selectedModel}...` : 'Pick a model first'}
                    disabled={!selectedModel || loading}
                    className="input-dark flex-1 py-3"
                  />
                  <button onClick={sendChat} disabled={loading || !input.trim()} className="btn-primary shrink-0 px-5">
                    {loading ? '...' : 'Send'}
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setMessages([])} className="text-xs text-zinc-500 hover:text-zinc-300">
                    Clear chat
                  </button>
                  <span className="text-xs text-zinc-600">· Enter to send, Shift+Enter for newline</span>
                </div>
              </div>
            </>
          )}

          {tab === 'image' && (
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <textarea value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder="A prompt for image generation..." rows={3} className="input-dark" />
              <button onClick={generateImage} disabled={imgLoading || !imgPrompt.trim()} className="btn-primary mt-3">
                {imgLoading ? 'Generating...' : 'Generate image'}
              </button>
              {imgError && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{imgError}</div>}
              {imgResult && <img src={imgResult} alt="Generated" className="mt-4 max-h-[420px] w-full rounded-xl border border-white/10 object-contain" />}
              {!imgResult && !imgLoading && <p className="mt-6 text-center text-xs text-zinc-500">Images are generated via the gateway&apos;s image models.</p>}
            </div>
          )}

          {tab === 'audio' && (
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)} rows={4} placeholder="Text to synthesize..." className="input-dark" />
              <button onClick={synthesize} disabled={ttsLoading || !ttsText.trim()} className="btn-primary mt-3">
                {ttsLoading ? 'Synthesizing...' : 'Synthesize'}
              </button>
              {ttsError && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{ttsError}</div>}
              {ttsAudioUrl && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                  <audio controls src={ttsAudioUrl} className="w-full" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
