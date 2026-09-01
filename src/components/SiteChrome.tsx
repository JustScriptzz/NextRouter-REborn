'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface MeResponse {
  user: { email: string; username: string } | null;
  isAdmin?: boolean;
}

const NAV_ITEMS = [
  { href: '/models', label: 'Models' },
  { href: '/playground', label: 'Playground' },
  { href: '/messages', label: 'Messages' },
  { href: '/limits', label: 'Limits' },
  { href: '/my-models', label: 'My Models' },
  { href: '/keys', label: 'Keys' },
  { href: '/usage', label: 'Usage' },
  { href: '/docs', label: 'Docs' },
] as const;

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; username: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/banner')
      .then((r) => r.json())
      .then((d) => setBanner(d?.message ?? null))
      .catch(() => undefined);
  }, []);

  const loadUnread = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/messages/unread?cb=${Date.now()}`);
      if (res.ok) {
        const d = await res.json();
        setUnread(typeof d.unread === 'number' ? d.unread : 0);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 15000);
    return () => clearInterval(t);
  }, [loadUnread, user]);

  const loadUser = useCallback(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data: MeResponse) => {
        setUser(data.user);
        setIsAdmin(!!data.isAdmin);
      })
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
      {/* ambient background */}
      <div className="bg-aurora" aria-hidden />
      <div className="bg-grid" aria-hidden />

      {/* top navigation */}
      <header className="glass-nav sticky top-0 z-40 border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:border-zinc-500 md:hidden" style={{ border: '0.5px solid #2d2d2d', background: '#0a0a0a' }}
          >
            <span className="relative block h-4 w-5">
              <span
                className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-zinc-100 transition-all duration-200 ${
                  open ? 'top-1.5 rotate-45' : ''
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 h-0.5 w-5 rounded-full bg-zinc-100 transition-all duration-200 ${
                  open ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`absolute left-0 top-3 h-0.5 w-5 rounded-full bg-zinc-100 transition-all duration-200 ${
                  open ? 'top-1.5 -rotate-45' : ''
                }`}
              />
            </span>
          </button>

          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <img src="/logo.png" alt="NextRouter REborn" className="h-9 w-9 rounded-lg object-contain transition" style={{ border: '0.5px solid #2d2d2d' }} />
            <span className="hidden text-base font-bold leading-tight tracking-tight text-white sm:block" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
              NextRouter REborn
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-lg px-3.5 py-2 text-sm transition ${
                    active
                      ? 'bg-[#1D1D1F] font-medium text-white'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                  style={{ border: active ? '0.5px solid #2d2d2d' : '0.5px solid transparent' }}
                >
                  {item.label}
                  {item.href === '/messages' && unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin"
                className={`rounded-lg px-3.5 py-2 text-sm transition ${
                  pathname === '/admin'
                    ? 'bg-[#1D1D1F] font-medium text-white'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                }`}
                style={{ border: pathname === '/admin' ? '0.5px solid #2d2d2d' : '0.5px solid transparent' }}
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <span
                  title={user.email}
                  className="hidden text-sm text-zinc-400 sm:block"
                >
                  @{user.username}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold uppercase" style={{ border: '0.5px solid #2d2d2d', background: '#1D1D1F', color: '#ffffff' }}>
                  {user.username.charAt(0)}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-ghost hidden px-3 py-2 text-xs sm:inline-flex"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn-ghost px-3 py-2 text-xs sm:text-sm">
                  Log in
                </Link>
                <Link href="/register" className="btn-primary px-3 py-2 text-xs sm:text-sm">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {banner && (
        <div className="border-b px-4 py-2 text-center text-xs font-medium tracking-wide" style={{ borderColor: '#2d2d2d', background: '#1D1D1F', color: '#ffffff' }}>
          {banner}
        </div>
      )}

      {/* mobile drawer */}
      {open && (
        <div
          className="anim-fade-in fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col shadow-2xl shadow-black/50 transition-transform duration-300 ease-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#000000', borderRight: '0.5px solid #2d2d2d' }}
      >
        <div className="p-5" style={{ borderBottom: '0.5px solid #2d2d2d' }}>
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="NextRouter REborn" className="h-9 w-9 shrink-0 rounded-lg object-contain" style={{ border: '0.5px solid #2d2d2d' }} />
            <span>
              <span className="block text-base font-bold leading-tight text-white" style={{ letterSpacing: '-0.02em' }}>
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
            const active =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative block rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? 'bg-[#1D1D1F] font-medium text-white'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                }`}
                style={{ border: active ? '0.5px solid #2d2d2d' : '0.5px solid transparent' }}
              >
                {item.label}
                {item.href === '/messages' && unread > 0 && (
                  <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4" style={{ borderTop: '0.5px solid #2d2d2d' }}>
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase" style={{ border: '0.5px solid #2d2d2d', background: '#1D1D1F', color: '#ffffff' }}>
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
              <Link href="/login" className="btn-ghost flex-1 px-3 py-2 text-center">
                Log in
              </Link>
              <Link href="/register" className="btn-primary flex-1 px-3 py-2 text-center">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </aside>

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6">
        {children}
      </main>

      {/* footer — JustScriptzz Signature */}
      <footer className="py-6" style={{ borderTop: '0.5px solid #2d2d2d', background: '#000000' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs sm:flex-row sm:px-6" style={{ color: '#666666', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
          <span>NextRouter REborn — Engineered by JustScriptzz</span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            All systems operational
          </span>
        </div>
      </footer>
    </>
  );
}
