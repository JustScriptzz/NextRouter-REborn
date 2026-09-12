'use client';

import Link from 'next/link';

const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? '';

export default function KeysPage() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="anim-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">API Keys</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
          No signups, no shared public key. Every key is private and tied to your
          Discord account - get yours from the bot.
        </p>
      </div>

      <div className="anim-fade-up delay-1 card mt-6 p-5">
        <p className="text-sm font-semibold text-zinc-100">Get a key</p>
        <ol className="mt-3 space-y-2 text-sm text-zinc-300 list-decimal list-inside">
          <li>Join the Discord server.</li>
          <li>
            Run{' '}
            <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>
              /getkey
            </code>{' '}
            in any channel (the reply is private, only you see it).
          </li>
          <li>
            Copy the key and use it as{' '}
            <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>
              Authorization: Bearer &lt;your key&gt;
            </code>
            .
          </li>
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          Leaked or lost your key? Run{' '}
          <code className="font-mono text-zinc-300">/regenkey</code> to invalidate it and
          get a new one instantly.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {DISCORD_INVITE_URL ? (
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer noopener" className="btn-primary inline-flex">
              Join the Discord
            </a>
          ) : null}
          <Link href="/docs" className="btn-ghost inline-flex">
            Read the docs
          </Link>
        </div>
      </div>
    </div>
  );
}
