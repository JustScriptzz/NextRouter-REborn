'use client';

import { useEffect, useState } from 'react';

interface UserEntry {
  username: string;
  email: string;
  tokens: number;
  calls: number;
}

export default function AdminUserManagement({ initialUsers }: { initialUsers: UserEntry[] }) {
  const [users] = useState<UserEntry[]>(initialUsers);
  const [banned, setBanned] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadBanned = async () => {
    const res = await fetch('/api/admin/users/ban');
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setBanned(new Set((data.banned ?? []).map((e: string) => e.toLowerCase())));
    }
  };

  useEffect(() => {
    loadBanned();
  }, []);

  const handleBanToggle = async (email: string, currentlyBanned: boolean) => {
    const res = await fetch('/api/admin/users/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, banned: !currentlyBanned }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setBanned(new Set((data.banned ?? []).map((e: string) => e.toLowerCase())));
      setMsg({ type: 'ok', text: `${!currentlyBanned ? 'Banned' : 'Unbanned'} ${email}` });
    } else {
      setMsg({ type: 'err', text: data?.error ?? 'Failed' });
    }
    setTimeout(() => setMsg(null), 2500);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || newPassword.length < 8) {
      setMsg({ type: 'err', text: 'Email and 8+ char password required' });
      return;
    }
    const res = await fetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ type: 'ok', text: data.message ?? 'Password reset' });
      setNewPassword('');
    } else {
      setMsg({ type: 'err', text: data?.error ?? 'Failed' });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(filter.toLowerCase()) ||
      u.username.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${msg.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Reset user password</h3>
        <p className="mt-1 text-xs text-zinc-500">Create a new password for any account. They can change it later.</p>
        <form onSubmit={handleReset} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="user@example.com"
            className="input-dark flex-1"
            required
          />
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (8+ chars)"
            className="input-dark flex-1 font-mono text-xs"
            required
            minLength={8}
          />
          <button type="submit" className="btn-primary shrink-0">
            Set password
          </button>
        </form>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">Users — ban & reset</h3>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter email/username"
            className="input-dark w-48 py-1.5 text-xs"
          />
        </div>
        <ul className="divide-y divide-white/5">
          {filtered.map((u) => {
            const isBanned = banned.has(u.email.toLowerCase());
            return (
              <li key={u.email} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-200">@{u.username}</span>
                    {isBanned && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">Banned</span>}
                  </div>
                  <div className="truncate text-xs text-zinc-500">{u.email} · {Number(u.tokens).toLocaleString()} tk · {Number(u.calls)} calls</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(u.email);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    Reset pw
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBanToggle(u.email, isBanned)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${isBanned ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-red-500/15 text-red-300 hover:bg-red-500/25'}`}
                  >
                    {isBanned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
