'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { DISCORD_URL } from '@/lib/shell-config';
import Logo from '@/components/Logo';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/models', label: 'Models' },
  { href: '/playground', label: 'Playground' },
  { href: '/keys', label: 'Keys' },
  { href: '/usage', label: 'Usage' },
  { href: '/docs', label: 'Docs' },
] as const;

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="bg-rules" aria-hidden />

      {/* status strip — deliberately plain, like a hand-run service */}
      <div
        className="border-b px-4 py-1.5"
        style={{ borderColor: '#1c1c1c', background: '#050505' }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 font-mono text-[11px] text-neutral-500">
          <span className="dot off" />
          <span>no providers wired yet</span>
          <span className="ml-auto hidden md:inline">daily cap 50,000,000 tokens · resets 00:00 UTC</span>
        </div>
      </div>

      <header
        className="sticky top-0 z-40 border-b"
        style={{ borderColor: '#1c1c1c', background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
      >
        <div className="mx-auto flex h-[57px] max-w-6xl items-center gap-2 px-4 sm:px-6">
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="btn btn-line mr-1 px-2.5 py-1.5 md:hidden"
          >
            {open ? 'Close' : 'Menu'}
          </button>

          <Link href="/" className="flex items-center gap-2.5">
            {/* hand-drawn mark: box + arrow, no gradient */}
            <Logo size={32} />
            <span className="leading-none">
              <span className="block text-[15px] font-bold tracking-tight text-white">
                NextRouter
              </span>
              <span className="mono block text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                ai gateway
              </span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-0.5 md:flex">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + '/');
              return (
                <Link key={n.href} href={n.href} className={`navlink ${active ? 'active' : ''}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-line px-3 py-1.5 text-[13px]">
              <DiscordGlyph />
              <span className="hidden sm:inline">Discord</span>
            </a>
            <Link href="/keys" className="btn btn-solid px-3 py-1.5 text-[13px]">
              Get a key
            </Link>
          </div>
        </div>

        {open && (
          <nav className="border-t px-4 py-2 md:hidden" style={{ borderColor: '#1c1c1c', background: '#000' }}>
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded px-2 py-2 text-sm ${active ? 'bg-neutral-900 text-white' : 'text-neutral-400'}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-7 sm:px-6">
        {children}
      </main>

      <footer className="border-t" style={{ borderColor: '#1c1c1c', background: '#000' }}>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Logo size={24} />
              <span className="text-sm font-bold text-white">NextRouter</span>
            </div>
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-neutral-500">
              One endpoint for every model you use. Self-hosted — no signup form,
              no waitlist. Limit is 5M tokens a
              day, resets at midnight UTC.
            </p>
            <div className="mt-4 flex gap-2">
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-solid px-3 py-1.5 text-[13px]">
                <DiscordGlyph /> Join the Discord
              </a>
              <Link href="/docs" className="btn btn-line px-3 py-1.5 text-[13px]">Read docs</Link>
            </div>
          </div>
          <div>
            <div className="micro mb-3">Product</div>
            <div className="flex flex-col gap-2 text-[13px]">
              <Link href="/dashboard" className="text-neutral-400 hover:text-white">Dashboard</Link>
              <Link href="/models" className="text-neutral-400 hover:text-white">Models</Link>
              <Link href="/playground" className="text-neutral-400 hover:text-white">Playground</Link>
              <Link href="/usage" className="text-neutral-400 hover:text-white">Usage &amp; limits</Link>
            </div>
          </div>
          <div>
            <div className="micro mb-3">Access</div>
            <div className="flex flex-col gap-2 text-[13px]">
              <Link href="/keys" className="text-neutral-400 hover:text-white">Get an API key</Link>
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white">discord invite</a>
              <Link href="/docs" className="text-neutral-400 hover:text-white">Docs & setup</Link>
              <span className="mono mt-2 text-[11px] text-neutral-600">no providers wired yet</span>
            </div>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: '#1c1c1c' }}>
          <div className="mono mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-[11px] text-neutral-600 sm:flex-row sm:items-center sm:px-6">
            <span>© 2026 nextrouter — run by hand, not by committee.</span>
            <span className="sm:ml-auto">self-hosted · 50m tokens/day</span>
          </div>
        </div>
      </footer>
    </>
  );
}

function DiscordGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M19.6 5.1A16.4 16.4 0 0 0 15.5 3.8l-.5 1a15 15 0 0 0-3.6 0L10.9 3.8a16.4 16.4 0 0 0-4.1 1.3C3.9 9.4 3.1 13.6 3.5 17.7A16.6 16.6 0 0 0 8.6 20.4l1-1.7c-.6-.2-1.1-.5-1.6-.8l.4-.3a12 12 0 0 0 10.2 0l.4.3c-.5.3-1 .6-1.6.8l1 1.7a16.6 16.6 0 0 0 5.1-2.7c.5-4.7-.8-8.8-3.9-12.6ZM8.7 15.2c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}
