'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface MeResponse {
  user: { email: string; username: string } | null;
}

const NAV_ITEMS = [
  { href: '/models', label: 'Models', icon: IconModels },
  { href: '/my-models', label: 'My Models', icon: IconCustom },
  { href: '/keys', label: 'Keys', icon: IconKey },
  { href: '/usage', label: 'Usage', icon: IconUsage },
  { href: '/docs', label: 'Docs', icon: IconDocs },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; username: string } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const loadUser = useCallback(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data: MeResponse) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen((v) => !v)}
        className="glass-nav fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 shadow-lg shadow-black/30 transition hover:border-violet-500/40"
      >
        <span className="relative block h-4 w-5">
          <span
            className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-zinc-100 transition-all duration-200 ${
              open ? 'top-1.5 rotate-45' : ''
            }`}
          />
          <span
            className={`absolute left-0 top-1.5 h-0.5 w-5 rounded-full bg-zinc-100 transition-all duration-200 ${
              open ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`absolute left-0 top-3 h-0.5 w-5 rounded-full bg-zinc-100 transition-all duration-200 ${
              open ? 'top-1.5 -rotate-45' : ''
            }`}
          />
        </span>
      </button>

      {open && (
        <div
          className="anim-fade-in fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`glass-nav fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col border-r border-white/10 shadow-2xl shadow-black/50 transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/10 p-5">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 font-mono text-sm font-bold text-white shadow-lg shadow-violet-600/30">
              NR
            </span>
            <span>
              <span className="text-gradient block text-base font-bold leading-tight">
                NextRouter REborn
              </span>
              <span className="block text-[11px] leading-tight text-zinc-500">
                Unified AI gateway
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? 'bg-violet-500/15 font-medium text-violet-200'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-violet-400 to-cyan-400" />
                )}
                <Icon active={active} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15 text-sm font-semibold uppercase text-violet-300">
                  {user.username.charAt(0)}
                </span>
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium text-zinc-100">{user.username}</div>
                  <div className="truncate text-xs text-zinc-500">{user.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl border border-zinc-700/80 px-3 py-2 text-sm text-zinc-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/login"
                className="btn-ghost flex-1 px-3 py-2 text-center"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="btn-primary flex-1 px-3 py-2 text-center"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function IconModels({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 h-[18px] w-[18px] shrink-0" aria-hidden>
      <path
        d="M10 3l6.5 3.75v7.5L10 18l-6.5-3.75v-7.5L10 3z"
        stroke={active ? '#c4b5fd' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.5" r="2" stroke={active ? '#c4b5fd' : 'currentColor'} strokeWidth="1.5" />
    </svg>
  );
}

function IconCustom({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <rect x="3" y="3" width="6" height="6" rx="1.5" stroke={active ? '#c4b5fd' : 'currentColor'} strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" stroke={active ? '#c4b5fd' : 'currentColor'} strokeWidth="1.5" />
      <path d="M14 3v5M11.5 5.5h5M6 11v6M3.5 14h5" stroke={active ? '#c4b5fd' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconKey({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <circle cx="7" cy="7" r="3.5" stroke={active ? '#c4b5fd' : 'currentColor'} strokeWidth="1.5" />
      <path d="M9.5 9.5L17 17M14 14l2-2M12 16l2-2" stroke={active ? '#c4b5fd' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconUsage({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <path d="M3 17V13M8 17V8M13 17V11M18 17V5" stroke={active ? '#c4b5fd' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconDocs({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <path
        d="M5 3h8l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke={active ? '#c4b5fd' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7.5 9h5M7.5 12h5" stroke={active ? '#c4b5fd' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
