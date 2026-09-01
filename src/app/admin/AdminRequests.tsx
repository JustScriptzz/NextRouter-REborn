'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../../lib/api-error';

type LimitRequest = {
  id: string;
  userId: string;
  username: string;
  email: string;
  requestedRpm: number | null;
  requestedTokens: number | null;
  why: string;
  models: string;
  createdAt: number;
  status: 'pending' | 'thinking' | 'accepted' | 'rejected';
  decidedRpm?: number | null;
  decidedTokens?: number | null;
  decidedAt?: number;
  decidedNote?: string;
};

export default function AdminRequests() {
  const [requests, setRequests] = useState<LimitRequest[]>([]);
  const [selected, setSelected] = useState<LimitRequest | null>(null);
  const [acceptRpm, setAcceptRpm] = useState('');
  const [acceptTokens, setAcceptTokens] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [actionResult, setActionResult] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/limits');
      if (res.ok) setRequests((await res.json()).requests ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doAction(id: string, action: 'accept' | 'reject' | 'thinking', body: Record<string, unknown> = {}) {
    setActionResult('');
    try {
      const res = await fetch(`/api/admin/limits/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setActionResult(apiErrorMessage(data, 'Failed')); return; }
      setActionResult(`Done: ${action}`);
      setSelected(null);
      await load();
    } catch { setActionResult('Network error'); }
  }

  if (loading) return <div className="py-6 text-center text-sm text-zinc-500">Loading requests…</div>;
  if (!requests.length) return <div className="py-12 text-center text-sm text-zinc-400">No pending limit increase requests.</div>;

  return (
    <div className="space-y-4">
      {actionResult && (
        <div className={`rounded-xl px-3 py-2 text-xs font-medium ${actionResult.startsWith('Done') ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
          {actionResult}
        </div>
      )}

      {selected && (
        <div className="rounded-xl p-5" style={{ border: '0.5px solid #2d2d2d', background: '#0a0a0a' }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100">Request from @{selected.username}</h3>
            <button onClick={() => { setSelected(null); setAcceptRpm(''); setAcceptTokens(''); setRejectNote(''); }} className="text-xs text-zinc-500 hover:text-white">Close</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] font-semibold uppercase text-zinc-500">Requested</div>
              <div className="mt-2 text-sm">
                <span className="text-zinc-400">RPM:</span>{' '}
                <span className="font-mono font-bold text-zinc-100">{selected.requestedRpm !== null && selected.requestedRpm > 0 ? selected.requestedRpm.toLocaleString() : '∞'}</span>
              </div>
              <div className="text-sm">
                <span className="text-zinc-400">Token limit:</span>{' '}
                <span className="font-mono font-bold text-zinc-100">{selected.requestedTokens !== null && selected.requestedTokens > 0 ? selected.requestedTokens.toLocaleString() : '∞'}</span>
              </div>
              <div className="mt-2 text-sm">
                <span className="text-zinc-400">Email:</span>{' '}
                <span className="text-zinc-200">{selected.email}</span>
              </div>
              <div className="text-sm">
                <span className="text-zinc-400">Submitted:</span>{' '}
                <span className="text-zinc-500">{new Date(selected.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] font-semibold uppercase text-zinc-500">User said</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{selected.why}</p>
              <div className="mt-3 text-[11px] font-semibold uppercase text-zinc-500">Models</div>
              <p className="mt-2 whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-400">{selected.models}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="text-[11px] font-bold uppercase text-emerald-300">Accept</div>
              <div className="mt-2">
                <label className="mb-1 block text-[10px] text-zinc-500">Grant RPM (blank = keep request)</label>
                <input type="number" min={1} value={acceptRpm} onChange={(e) => setAcceptRpm(e.target.value)} placeholder={selected.requestedRpm !== null ? String(selected.requestedRpm) : '∞'} className="input-dark py-1.5 text-xs" />
              </div>
              <div className="mt-2">
                <label className="mb-1 block text-[10px] text-zinc-500">Grant token limit (blank = keep request)</label>
                <input type="number" min={1} value={acceptTokens} onChange={(e) => setAcceptTokens(e.target.value)} placeholder={selected.requestedTokens !== null ? String(selected.requestedTokens) : '∞'} className="input-dark py-1.5 text-xs" />
              </div>
              <button onClick={() => doAction(selected.id, 'accept', { rpm: acceptRpm === '' ? null : Number(acceptRpm), tokens: acceptTokens === '' ? null : Number(acceptTokens) })} className="mt-3 w-full rounded-lg bg-emerald-600/30 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-600/50">
                Grant limits
              </button>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="text-[11px] font-bold uppercase text-amber-300">Thinking…</div>
              <p className="mt-2 text-xs text-zinc-400">User sees "thinking" status until you make a decision.</p>
              <button onClick={() => doAction(selected.id, 'thinking')} className="mt-3 w-full rounded-lg bg-amber-600/30 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-600/50">
                Mark thinking
              </button>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div className="text-[11px] font-bold uppercase text-red-300">Reject</div>
              <div className="mt-2">
                <label className="mb-1 block text-[10px] text-zinc-500">Note to user (optional)</label>
                <input type="text" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Reason..." className="input-dark py-1.5 text-xs" />
              </div>
              <button onClick={() => doAction(selected.id, 'reject', { note: rejectNote })} className="mt-3 w-full rounded-lg bg-red-600/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-600/50">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">RPM</th>
              <th className="px-4 py-2.5 font-medium">Tokens</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Submitted</th>
              <th className="px-4 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-2">
                  <span className="font-medium text-zinc-200">@{r.username}</span>
                  <span className="ml-1 text-zinc-500">{r.email}</span>
                </td>
                <td className="px-4 py-2 font-mono text-zinc-300">{r.requestedRpm != null && r.requestedRpm > 0 ? r.requestedRpm.toLocaleString() : '∞'}</td>
                <td className="px-4 py-2 font-mono text-zinc-300">{r.requestedTokens != null && r.requestedTokens > 0 ? r.requestedTokens.toLocaleString() : '∞'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    r.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-300' :
                    r.status === 'rejected' ? 'bg-red-500/15 text-red-300' :
                    r.status === 'thinking' ? 'bg-amber-500/15 text-amber-300' :
                    'bg-white/10 text-zinc-400'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-zinc-500">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  {r.status === 'pending' && (
                    <button onClick={() => { setSelected(r); setAcceptRpm(r.requestedRpm != null ? String(r.requestedRpm) : ''); setAcceptTokens(r.requestedTokens != null ? String(r.requestedTokens) : ''); }} className="rounded px-2.5 py-1 text-[10px] font-bold text-white hover:bg-white" style={{ background: '#1D1D1F', border: '0.5px solid #2d2d2d' }}>
                      Analyze
                    </button>
                  )}
                  {(r.status === 'thinking' || r.status === 'accepted' || r.status === 'rejected') && (
                    <span className="text-[10px] text-zinc-600">
                      {r.status === 'accepted' ? 'Accepted' : r.status === 'rejected' ? 'Rejected' : 'Thinking...'}
                      {r.decidedAt ? ` ${new Date(r.decidedAt).toLocaleDateString()}` : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
