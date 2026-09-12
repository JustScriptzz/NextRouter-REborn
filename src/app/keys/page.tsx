import Link from 'next/link';

// Shared public key - no signups, no per-user minting. Set PUBLIC_API_KEY
// in the Vercel project env vars; this page reads it server-side and
// displays it directly, since the whole point of this key is that it's
// public.
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY || '';

export default function KeysPage() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="anim-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">API Keys</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
          No signup, no Discord bot - one shared public key, rate limited to keep
          things fair for everyone.
        </p>
      </div>

      <div className="anim-fade-up delay-1 card mt-6 p-5">
        <p className="text-sm font-semibold text-zinc-100">Public key</p>
        {PUBLIC_API_KEY ? (
          <pre
            className="mt-3 overflow-x-auto rounded px-3 py-2 font-mono text-sm text-zinc-100"
            style={{ background: '#1D1D1F' }}
          >
            {PUBLIC_API_KEY}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-amber-400">
            PUBLIC_API_KEY isn&apos;t set on this deployment yet - add it in the
            project&apos;s environment variables.
          </p>
        )}
        <p className="mt-3 text-sm text-zinc-300">
          Use it as{' '}
          <code
            className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300"
            style={{ background: '#1D1D1F' }}
          >
            Authorization: Bearer &lt;key&gt;
          </code>
          .
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Shared by everyone, capped at a fixed requests-per-minute limit - see the{' '}
          <Link href="/docs" className="underline underline-offset-4">
            docs
          </Link>{' '}
          for the exact number and endpoint list.
        </p>
      </div>
    </div>
  );
}
