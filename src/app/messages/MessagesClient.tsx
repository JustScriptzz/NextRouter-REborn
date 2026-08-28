'use client';

import { useEffect, useRef, useState } from 'react';

type ChatMessage = { id: string; role: 'user' | 'admin'; text: string; at: number };

export default function MessagesClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'ok' | 'error' | ''>('');
  const [msg, setMsg] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.messages)) setMessages(d.messages);
      }
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setStatus('');
    setMsg('');
    setInput('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.messages)) setMessages(d.messages);
      } else {
        setStatus('error');
        setMsg('Could not send. Try again.');
        setInput(text);
      }
    } catch {
      setStatus('error');
      setMsg('Network error.');
      setInput(text);
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Messages</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Chat with the NextRouter team. We reply through the admin panel.
      </p>

      <div className="card mt-6 flex min-h-[420px] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: '480px' }}>
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center py-16 text-center">
              <p className="max-w-xs text-sm text-zinc-500">
                No messages yet. Say hi and we&apos;ll get back to you.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'border border-white/10 bg-white/5 text-zinc-100'
              }`}>
                <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60`}>
                  {m.role === 'user' ? 'You' : 'NextRouter team'}
                </div>
                <div className="break-words whitespace-pre-wrap">{m.text}</div>
                <div className={`mt-1 text-[10px] ${m.role === 'user' ? 'text-white/50' : 'text-zinc-500'}`}>
                  {new Date(m.at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {status === 'error' && <div className="border-t border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">{msg}</div>}
        <div className="border-t border-white/10 p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Type a message..."
              className="input-dark flex-1 py-3"
            />
            <button onClick={send} disabled={!input.trim()} className="btn-primary shrink-0 px-5">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
