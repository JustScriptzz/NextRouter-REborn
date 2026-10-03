import Link from 'next/link';
import { DISCORD_URL, DAILY_TOKEN_LIMIT, MODELS } from '@/lib/shell-config';

export const dynamic = 'force-static';

export default function HomePage() {
  return (
    <div>
      {/* deliberately off-center, left-aligned. no giant gradient headline. */}
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div className="pt-4">
          <div className="mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            independent ai gateway
          </div>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.08] tracking-tight text-white sm:text-[44px]">
            One endpoint.
            <br />
            Every model you use.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-neutral-400">
            NextRouter sits in front of your providers and speaks OpenAI on both
            sides. You keep one base URL and one key. We handle routing,
            retries, and the usage ledger. Self-host it, wire your upstreams,
            mint your own keys.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/dashboard" className="btn btn-solid px-4 py-2">
              Open dashboard →
            </Link>
            <Link href="/keys" className="btn btn-line px-4 py-2">
              How keys work
            </Link>
          </div>
          <div className="mono mt-6 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-neutral-500">
            <span>{MODELS.length} models live</span>
            <span>{DAILY_TOKEN_LIMIT.toLocaleString()} tokens / day</span>
            <span>openai-compatible</span>
          </div>

          <div className="mt-8 grid grid-cols-3 divide-x divide-neutral-800 border-y border-neutral-800">
            <div className="px-4 py-3">
              <div className="mono text-[11px] uppercase tracking-wider text-neutral-500">daily cap</div>
              <div className="mt-1 font-mono text-lg text-white">5M</div>
            </div>
            <div className="px-4 py-3">
              <div className="mono text-[11px] uppercase tracking-wider text-neutral-500">api shape</div>
              <div className="mt-1 font-mono text-lg text-white">openai</div>
            </div>
            <div className="px-4 py-3">
              <div className="mono text-[11px] uppercase tracking-wider text-neutral-500">keys via</div>
              <div className="mt-1 font-mono text-lg text-white">self-host</div>
            </div>
          </div>

          <p className="mt-4 text-[13px] text-neutral-600">
            Built for people who got tired of juggling five provider dashboards.
            If something breaks, it fails over instead of failing you.
          </p>
        </div>

        <div className="pt-2 lg:pt-4">
          <div className="term">
            <div className="term-bar">
              <span className="mono text-[11px] uppercase tracking-wider text-neutral-500">terminal — first call</span>
              <span className="mono text-[11px] text-neutral-600">bash</span>
            </div>
            <div className="term-body">{`$ curl $BASE/chat/completions \\
  -H "Authorization: Bearer $NR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "<model-id>",
    "messages": [
      {"role": "user", "content": "route this"}
    ]
  }'

`}<span className="c"># → 200, same shape as OpenAI (example, not a real call)</span>{`
{ "id": "chatcmpl-...", "object": "chat.completion",
  "model": "<model-id>", "usage": {"total_tokens": "..."} }`}</div>
          </div>

          <div className="panel mt-3 p-4">
            <div className="micro">How keys work here</div>
            <ol className="mt-2 space-y-1.5 text-[13px] text-neutral-300">
              <li><span className="mono text-neutral-500">01.</span> Use the <span className="mono text-white">demo</span> key to try it instantly.</li>
              <li><span className="mono text-neutral-500">02.</span> Self-hosting? Mint <span className="mono text-white">nr_…</span> keys in Postgres.</li>
              <li><span className="mono text-neutral-500">03.</span> Paste the key into Playground or your client.</li>
            </ol>
            <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-line mt-3 w-full py-2 text-[13px]">
              Join Discord
            </a>
          </div>
        </div>
      </div>

      {/* spec strip, not feature cards */}
      <div className="panel mt-10 overflow-hidden">
        <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>What</th><th>Detail</th><th className="hidden sm:table-cell">Note</th></tr>
          </thead>
          <tbody>
            <tr><td className="mono text-neutral-300">base url</td><td className="mono text-white">/api/v1</td><td className="hidden text-neutral-500 sm:table-cell">drop-in OpenAI shape</td></tr>
            <tr><td className="mono text-neutral-300">auth</td><td className="mono text-white">Bearer nr_…</td><td className="hidden text-neutral-500 sm:table-cell">demo in-code · nr_… in Postgres</td></tr>
            <tr><td className="mono text-neutral-300">daily cap</td><td className="mono text-white">50,000,000 tokens</td><td className="hidden text-neutral-500 sm:table-cell">all models combined, 00:00 UTC reset</td></tr>
            <tr><td className="mono text-neutral-300">streaming</td><td className="mono text-white">SSE</td><td className="hidden text-neutral-500 sm:table-cell">same flags as OpenAI</td></tr>
          </tbody>
        </table>
        </div>
      </div>

      <p className="mono mt-6 text-[11px] leading-relaxed text-neutral-600">
        honest note: every model above is callable today. more get added
        the same way — same endpoint, same key, same docs.
      </p>
    </div>
  );
}
