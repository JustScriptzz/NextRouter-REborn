'use client';

import { useCallback, useEffect, useState } from 'react';

type Thread = {
  userId: string;
  username: string;
  email: string;
  updatedAt: number;
  unread: number;
  preview: string;
};
type ChatMessage = { id: string; role: 'user' | 'admin'; text: string; at: number };

export default function AdminMessages() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messages');
      if (res.ok) setThreads((await res.json()).threads ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => { const t = setInterval(loadThreads, 8000); return () => clearInterval(t); }, [loadThreads]);

  async function open(userId: string) {
    setActiveUserId(userId);
    try {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const d = await res.json();
        if (d.thread?.messages) setMessages(d.thread.messages);
      }
    } catch {}
  }

  async function sendReply() {
    const text = reply.trim();
    if (!text || !activeUserId) return;
    setReply('');
    try {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(activeUserId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.thread?.messages) setMessages(d.thread.messages);
        await loadThreads();
      }
    } catch {}
  }

  if (loading) return <div className="py-6 text-center text-sm text-zinc-500">Loading threads…</div>;
  if (threads.length === 0)
    return <div className="py-12 text-center text-sm text-zinc-400">No user messages yet.</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        {threads.map((t) => (
          <button
            key={t.userId}
            onClick={() => open(t.userId)}
            className={`w-full rounded-xl border p-3 text-left transition ${
              activeUserId === t.userId ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-100">@{t.username}</span>
              {t.unread > 0 && (
                <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">{t.unread}</span>
              )}
            </div>
            <div className="truncate text-xs text-zinc-500">{t.email}</div>
            <div className="mt-1 truncate text-xs text-zinc-400">{t.preview}</div>
            <div className="mt-1 text-[10px] text-zinc-600">{new Date(t.updatedAt).toLocaleString()}</div>
          </button>
        ))}
      </div>

      <div className="card flex min-h-[440px] flex-col overflow-hidden">
        {!activeUserId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500">
            Select a conversation to reply.
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '440px' }}>
              {messages.length === 0 && <div className="py-10 text-center text-sm text-zinc-500">No messages.</div>}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    m.role === 'user' ? 'border border-white/10 bg-white/5 text-zinc-100' : 'bg-violet-600 text-white'
                  }`}>
                    <div className="mb-0.5 text-[10px] font-semibold uppercase opacity-60">
                      {m.role === 'user' ? 'User' : 'You'}
                    </div>
                    <div className="break-words whitespace-pre-wrap">{m.text}</div>
                    <div className="mt-1 text-[10px] opacity-50">{new Date(m.at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                  placeholder="Reply as admin..."
                  className="input-dark flex-1 py-3"
                />
                <button onClick={sendReply} disabled={!reply.trim()} className="btn-primary shrink-0 px-5">
                  Reply
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
