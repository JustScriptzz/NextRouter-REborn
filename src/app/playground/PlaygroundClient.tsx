'use client';

import { useEffect, useRef, useState } from 'react';

type Model = { id: string; title: string; type: string; isFallback: boolean };
type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCall[]; tool_call_id?: string; name?: string };

const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
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
  const [forceThinking, setForceThinking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [toolsJson, setToolsJson] = useState('[\n  {\n    "type": "function",\n    "function": {\n      "name": "get_weather",\n      "description": "Get weather for a location",\n      "parameters": {\n        "type": "object",\n        "properties": { "location": { "type": "string", "description": "City name" } },\n        "required": ["location"]\n      }\n    }\n  }\n]');
  const [toolChoice, setToolChoice] = useState('auto');
  const [showTools, setShowTools] = useState(false);

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

  // video state
  const [vidPrompt, setVidPrompt] = useState('A rocket launching through clouds in cinematic style');
  const [vidModel, setVidModel] = useState('');
  const [vidResult, setVidResult] = useState<string | null>(null);
  const [vidLoading, setVidLoading] = useState(false);
  const [vidError, setVidError] = useState('');

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
        const vidFirst = list.find((m) => m.type === 'video');
        if (vidFirst) setVidModel(vidFirst.id);
      })
      .catch(() => {});
  }, []);

  // Shared public key (no per-user minting — see /docs). Persisted in
  // sessionStorage so we only fetch it once per visit.
  const [keyError, setKeyError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const STORAGE_KEY = 'nr_playground_key';
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      setApiKey(cached);
    }
    (async () => {
      try {
        const existing = sessionStorage.getItem(STORAGE_KEY);
        if (existing) return;
        const res = await fetch('/api/public-key');
        const j = await res.json().catch(() => ({}));
        if (!cancelled && j.key) {
          sessionStorage.setItem(STORAGE_KEY, j.key);
          setApiKey(j.key);
          setKeyMasked(`${String(j.key).slice(0, 8)}...${String(j.key).slice(-4)}`);
        } else if (!cancelled) {
          setKeyError('Could not load the public key.');
        }
      } catch {
        if (!cancelled) setKeyError('Could not reach /api/public-key — is the server running?');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredTextModels = models.filter((m) => m.type === 'text' && m.id.toLowerCase().includes(modelSearch.toLowerCase()));
  const parsedTools = (() => {
    try {
      const p = JSON.parse(toolsJson);
      return Array.isArray(p) && p.length > 0 ? p : null;
    } catch {
      return null;
    }
  })();
  const curlPreview =
    tab === 'chat'
      ? `curl https://nextrouterfree.duckdns.org/api/v1/chat/completions \\
  -H "Authorization: Bearer ${keyMasked || 'nr_...'} " \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel || 'kiro-auto'}",
    "messages": [{"role": "user", "content": "Hello!"}]${parsedTools ? `,
    "tools": ${JSON.stringify(parsedTools, null, 2).split('\n').join('\n    ')},` : ''}
    "stream": ${stream},
    "temperature": ${temperature}
  }'`
      : tab === 'image'
        ? `curl https://nextrouterfree.duckdns.org/api/v1/images/generations \\
  -H "Authorization: Bearer ${keyMasked || 'nr_...'} " \\
  -d '{"model":"${imgModel}", "prompt":"${imgPrompt.slice(0, 30)}..."}'`
        : tab === 'video'
          ? `curl https://nextrouterfree.duckdns.org/api/v1/videos/generations \\
  -H "Authorization: Bearer ${keyMasked || 'nr_...'} " \\
  -d '{"model":"${vidModel}", "prompt":"${vidPrompt.slice(0, 30)}..."}'`
          : `curl https://nextrouterfree.duckdns.org/api/v1/audio/speech ...`;

  async function sendChat() {
    if (!input.trim() || !selectedModel || !apiKey) {
      if (!apiKey) setError(keyError ? `No API key: ${keyError}` : 'No API key available — the public key should load automatically.');
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

    let parsedToolsForRequest: unknown = null;
    let toolChoiceForRequest: unknown = undefined;
    if (showTools) {
      try {
        const p = JSON.parse(toolsJson);
        if (Array.isArray(p) && p.length > 0) {
          parsedToolsForRequest = p;
          if (toolChoice === 'none') toolChoiceForRequest = 'none';
          else if (toolChoice === 'required') toolChoiceForRequest = 'required';
          else if (toolChoice !== 'auto' && toolChoice.startsWith('{')) {
            try { toolChoiceForRequest = JSON.parse(toolChoice); } catch { toolChoiceForRequest = 'auto'; }
          } else if (toolChoice !== 'auto') {
            toolChoiceForRequest = { type: 'function', function: { name: toolChoice } };
          }
        }
      } catch {}
    }

    const payload: Record<string, unknown> = {
      model: selectedModel,
      messages: history.map((m) => {
        const out: Record<string, unknown> = { role: m.role, content: m.content };
        if (m.tool_calls) out.tool_calls = m.tool_calls;
        if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
        if (m.name) out.name = m.name;
        return out;
      }),
      temperature,
      max_tokens: maxTokens,
      stream,
    };
    if (forceThinking) {
      payload.include_reasoning = true;
      payload.reasoning_effort = 'medium';
    }
    if (parsedToolsForRequest) {
      payload.tools = parsedToolsForRequest;
      if (toolChoiceForRequest !== undefined) payload.tool_choice = toolChoiceForRequest;
    }

    try {
      if (!stream) {
        const res = await fetch('/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || 'Request failed');
        const msg = j.choices?.[0]?.message as { content?: string | null; tool_calls?: ToolCall[]; reasoning?: string; reasoning_content?: string; thinking?: string } | undefined;
        if (msg?.tool_calls && msg.tool_calls.length > 0) {
          setMessages((m) => [...m, { role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls }]);
        } else {
          const content = msg?.content ?? JSON.stringify(j, null, 2);
          const reasoning = msg?.reasoning ?? (msg as { reasoning_content?: string } | undefined)?.reasoning_content ?? (msg as { thinking?: string } | undefined)?.thinking;
          setMessages((m) => [...m, { role: 'assistant', content: reasoning ? `**Reasoning:** ${reasoning}\n\n${content}` : content ?? '' }]);
        }
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
        let toolCallsAcc: Record<number, { id: string; function: { name: string; arguments: string } }> = {};
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
              const delta = j.choices?.[0]?.delta as { content?: string; reasoning?: string; reasoning_content?: string; thinking?: string; tool_calls?: Array<{ index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }> } | undefined;
              const deltaReasoning = delta?.reasoning ?? delta?.reasoning_content ?? delta?.thinking;
              if (deltaReasoning) reasoningAcc += deltaReasoning;
              if (delta?.content) acc += delta.content;
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCallsAcc[idx]) toolCallsAcc[idx] = { id: tc.id ?? `call_${idx}`, function: { name: '', arguments: '' } };
                  if (tc.id) toolCallsAcc[idx].id = tc.id;
                  if (tc.function?.name) toolCallsAcc[idx].function.name = tc.function.name;
                  if (tc.function?.arguments) toolCallsAcc[idx].function.arguments += tc.function.arguments;
                }
              }
              const hasToolCalls = Object.keys(toolCallsAcc).length > 0;
              if (deltaReasoning || delta?.content || delta?.tool_calls) {
                setMessages((m) => {
                  const copy = [...m];
                  if (hasToolCalls) {
                    const tcs: ToolCall[] = Object.values(toolCallsAcc).map((v) => ({ id: v.id, type: 'function' as const, function: v.function }));
                    copy[copy.length - 1] = { role: 'assistant', content: acc, tool_calls: tcs };
                  } else {
                    const display = reasoningAcc ? `*Thinking:* ${reasoningAcc}\n\n${acc}` : acc;
                    copy[copy.length - 1] = { role: 'assistant', content: display || '...' };
                  }
                  return copy;
                });
              }
            } catch {}
          }
        }

        // If streaming produced nothing (model doesn't do SSE), fall back to non-streaming
        if (!acc && Object.keys(toolCallsAcc).length === 0) {
          try {
            const res2 = await fetch('/api/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...payload, stream: false }),
            });
            const j2 = await res2.json().catch(() => ({}));
            if (res2.ok) {
              const msg = j2.choices?.[0]?.message as { content?: string | null; tool_calls?: ToolCall[]; reasoning?: string; reasoning_content?: string; thinking?: string } | undefined;
              setMessages((m) => {
                const copy = [...m];
                if (msg?.tool_calls && msg.tool_calls.length > 0) {
                  copy[copy.length - 1] = { role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls };
                } else {
                  const content = msg?.content ?? '';
                  const reasoning = msg?.reasoning ?? msg?.reasoning_content ?? msg?.thinking;
                  copy[copy.length - 1] = { role: 'assistant', content: reasoning ? `**Reasoning:** ${reasoning}\n\n${content}` : content || '...' };
                }
                return copy;
              });
            }
          } catch (e2) {
            setError(e2 instanceof Error ? e2.message : 'Failed to fetch non-streaming response');
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

  async function generateVideo() {
    if (!vidPrompt.trim() || !vidModel || !apiKey) return;
    setVidLoading(true);
    setVidError('');
    setVidResult(null);
    try {
      const res = await fetch('/api/v1/videos/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: vidModel, prompt: vidPrompt }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Failed');
      const url = (j.data?.[0]?.url as string | undefined) ?? undefined;
      const b64 = (j.data?.[0]?.b64_json as string | undefined) ?? undefined;
      if (url) setVidResult(url);
      else if (b64) setVidResult(`data:video/mp4;base64,${b64}`);
      else setVidResult(null);
    } catch (e: unknown) {
      setVidError(e instanceof Error ? e.message : String(e));
    } finally {
      setVidLoading(false);
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
          <span title={keyError || undefined} className="rounded-full bg-white/5 px-3 py-1.5 font-mono text-zinc-400">{keyMasked || (keyError ? 'key failed — hover me' : 'no key yet')}</span>
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
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === t.id ? 'bg-[#1D1D1F] text-white' : 'text-zinc-400 hover:text-white'}`} style={tab === t.id ? { border: '0.5px solid #2d2d2d' } : undefined}
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
              {tab === 'chat' ? 'Chat model' : tab === 'image' ? 'Image model' : tab === 'video' ? 'Video model' : 'Voice model'}
            </h3>
            <input
              placeholder="Search models..."
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              className="input-dark mt-3 py-2 text-xs"
            />
            <div className="mt-3 max-h-[320px] space-y-1 overflow-y-auto pr-1">
              {(tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : tab === 'video' ? models.filter((m) => m.type === 'video') : models.filter((m) => m.type === 'tts')).length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">No models</p>
              ) : (
                (tab === 'chat' ? models.filter((m) => m.type === 'text') : tab === 'image' ? models.filter((m) => m.type === 'image') : tab === 'video' ? models.filter((m) => m.type === 'video') : models.filter((m) => m.type === 'tts'))
                  .filter((m) => !modelSearch || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                  .slice(0, 80)
                  .map((m) => {
                    const active =
                      (tab === 'chat' && m.id === selectedModel) ||
                      (tab === 'image' && m.id === imgModel) ||
                      (tab === 'video' && m.id === vidModel) ||
                      (tab === 'audio' && m.id === ttsModel);
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (tab === 'chat') setSelectedModel(m.id);
                          else if (tab === 'image') setImgModel(m.id);
                          else if (tab === 'video') setVidModel(m.id);
                          else setTtsModel(m.id);
                        }}
                        className={`w-full truncate rounded-lg px-2.5 py-2 text-left font-mono text-xs transition ${active ? 'bg-[#1D1D1F] text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`} style={active ? { border: '0.5px solid #2d2d2d' } : undefined}
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
            <>
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-zinc-100">Parameters</h3>
                <label className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                  <span>Temperature {temperature.toFixed(2)}</span>
                  <input type="range" min={0} max={2} step={0.05} value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="ml-3 flex-1 accent-white" />
                </label>
                <label className="mt-3 block text-xs text-zinc-400">
                  Max tokens
                  <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)} className="input-dark mt-1 py-1.5 text-xs" />
                </label>
                <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                  <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} className="accent-white" />
                  Stream response
                </label>
                <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400" title="Native reasoning if supported, otherwise emulated via <thinking> prompt (non-streaming only)">
                  <input type="checkbox" checked={forceThinking} onChange={(e) => setForceThinking(e.target.checked)} className="accent-white" />
                  Force thinking
                </label>
                <label className="mt-3 block text-xs text-zinc-400">
                  System prompt
                  <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="You are a helpful assistant..." rows={3} className="input-dark mt-1 py-2 text-xs" />
                </label>
              </div>
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">Tools</h3>
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} className="accent-white" />
                    Enable
                  </label>
                </div>
                {showTools ? (
                  <>
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">Works with <span className="text-white">every</span> model — non-native models are auto-emulated via prompt injection.</p>
                    <textarea value={toolsJson} onChange={(e) => setToolsJson(e.target.value)} rows={12} spellCheck={false} className="input-dark mt-3 font-mono text-[11px] leading-relaxed" placeholder='[{"type":"function","function":{"name":"..."}}]' />
                    {!parsedTools && <p className="mt-1 text-[11px] text-red-400">Invalid JSON</p>}
                    <label className="mt-3 block text-xs text-zinc-400">
                      Tool choice
                      <select value={toolChoice} onChange={(e) => setToolChoice(e.target.value)} className="input-dark mt-1 py-1.5 text-xs">
                        <option value="auto">auto</option>
                        <option value="required">required</option>
                        <option value="none">none</option>
                        {parsedTools?.map((t: { function: { name: string } }) => (
                          <option key={t.function.name} value={t.function.name}>
                            force {t.function.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() =>
                          setToolsJson(
                            JSON.stringify(
                              [
                                { type: 'function', function: { name: 'get_weather', description: 'Get weather for a location', parameters: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] } } },
                                { type: 'function', function: { name: 'search_web', description: 'Search the web', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
                              ],
                              null,
                              2,
                            ),
                          )
                        }
                        className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                      >
                        Example: weather + search
                      </button>
                      <button onClick={() => setToolsJson('[]')} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-zinc-400 hover:text-white">
                        Clear
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">Enable to test function calling on any model. Try: &quot;What&apos;s the weather in Paris?&quot;</p>
                )}
              </div>
            </>
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2d2d2d] bg-[#1D1D1F] text-white">
                      <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden>
                        <path d="M4 6.5A2.5 2.5 0 016.5 4h4A2.5 2.5 0 0113 6.5v3A2.5 2.5 0 0110.5 12h-1L6 15v-3H4A2.5 2.5 0 011.5 9.5v-3A2.5 2.5 0 014 4z" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </div>
                    <p className="mt-4 text-sm font-medium text-zinc-200">Start a conversation</p>
                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">Pick a model on the left. Messages run through the same gateway your API key uses — with automatic failover.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : m.role === 'tool' ? 'justify-start' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'text-black' : m.role === 'system' ? 'border border-[#2d2d2d] bg-[#1D1D1F] text-amber-200' : m.role === 'tool' ? 'border border-[#2d2d2d] bg-[#1D1D1F] text-emerald-100' : 'border border-[#2d2d2d] bg-white/5 text-zinc-100'}`} style={m.role === 'user' ? { background: '#ffffff' } : undefined}>
                      <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide opacity-60">
                        <span>{m.role}</span>
                        {m.name && <span className="rounded bg-white/10 px-1.5 py-0.5 normal-case">{m.name}</span>}
                      </div>
                      {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                      {m.tool_calls && m.tool_calls.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {m.tool_calls.map((tc) => (
                            <div key={tc.id} className="rounded-xl p-2.5" style={{ border: '0.5px solid #2d2d2d', background: '#1D1D1F' }}>
                              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                                <span className="rounded bg-[#0a0a0a] px-1.5 py-0.5 font-mono text-[10px]">{tc.function.name}</span>
                                <span className="font-mono text-[10px] opacity-60">{tc.id}</span>
                              </div>
                              <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-zinc-300">{(() => { try { return JSON.stringify(JSON.parse(tc.function.arguments), null, 2); } catch { return tc.function.arguments; } })()}</pre>
                              <button
                                onClick={() => {
                                  const result = prompt(`Tool result for ${tc.function.name}:`, '{"result": "example"}');
                                  if (result !== null) {
                                    setMessages((prev) => [...prev, { role: 'tool', content: result, tool_call_id: tc.id, name: tc.function.name }]);
                                  }
                                }}
                                className="mt-2 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/15 hover:text-white"
                              >
                                ↳ Send tool result
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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

          {tab === 'video' && (
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <textarea value={vidPrompt} onChange={(e) => setVidPrompt(e.target.value)} placeholder="A prompt for video generation..." rows={3} className="input-dark" />
              <button onClick={generateVideo} disabled={vidLoading || !vidPrompt.trim()} className="btn-primary mt-3">
                {vidLoading ? 'Generating...' : 'Generate video'}
              </button>
              {vidError && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{vidError}</div>}
              {vidResult && (
                <div className="mt-4 space-y-3">
                  <video controls src={vidResult} className="w-full rounded-xl border border-white/10" />
                  <a href={vidResult} target="_blank" rel="noreferrer" className="block text-center text-xs text-zinc-400 underline">
                    Open video in new tab
                  </a>
                </div>
              )}
              {!vidResult && !vidLoading && <p className="mt-6 text-center text-xs text-zinc-500">Videos are generated via the gateway&apos;s video models (wan-3.0, qwen-video).</p>}
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
