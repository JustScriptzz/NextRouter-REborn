'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface MeResponse {
  user: { email: string; username: string } | null;
}

const NAV_ITEMS = [
  { href: '/models', label: 'Models' },
  { href: '/my-models', label: 'My Models' },
  { href: '/keys', label: 'Keys' },
  { href: '/usage', label: 'Usage' },
  { href: '/docs', label: 'Docs' },
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
        className="fixed left-4 top-4 z-50 flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-lg border border-zinc-800 bg-zinc-900/80 backdrop-blur transition hover:border-zinc-600"
      >
        <span className="h-0.5 w-5 rounded-full bg-zinc-100" />
        <span className="h-0.5 w-5 rounded-full bg-zinc-100" />
        <span className="h-0.5 w-5 rounded-full bg-zinc-100" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col border-r border-zinc-800 bg-zinc-900/95 backdrop-blur transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-zinc-800 p-5">
          <div className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-xl font-bold text-transparent">
            NextRouter REborn
          </div>
          <p className="mt-1 text-xs text-zinc-500">Unified AI model gateway</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-violet-500/15 font-medium text-violet-300'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          {user ? (
            <div className="space-y-2">
              <div className="text-sm">
                <div className="font-medium text-zinc-100">{user.username}</div>
                <div className="truncate text-xs text-zinc-500">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-red-500/50 hover:text-red-400"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/login"
                className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-violet-500"
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