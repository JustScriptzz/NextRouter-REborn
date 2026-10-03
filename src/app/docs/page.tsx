import Link from 'next/link';
import { DISCORD_URL, DAILY_TOKEN_LIMIT } from '@/lib/shell-config';

export const metadata = { title: 'Docs' };
export const dynamic = 'force-static';

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="micro">Docs — short on purpose</div>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight text-white">Documentation</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        If you&apos;ve used OpenAI&apos;s API, you already know this one. Base URL + key + model id.
      </p>

      <Section n="01" title="Get a key">
        <p>
          No signup form. For trying it out, the key is literally{' '}
          <span className="mono text-white">demo</span> — shared bucket, works instantly.
          Self-hosting for real use? Mint <span className="mono text-white">nr_…</span> keys
          in Postgres (see README) or set <span className="mono text-white">SYSTEM_TEST_KEY</span> for
          sweeps. Full walkthrough on the <Link href="/keys" className="underline underline-offset-4 hover:text-white">keys tab</Link>.
        </p>
      </Section>

      <Section n="02" title="First request">
        <div className="term">
          <div className="term-bar"><span className="mono text-[11px] uppercase tracking-wider text-neutral-500">bash</span><span className="mono text-[11px] text-neutral-600">curl</span></div>
          <div className="term-body">{`curl https://YOUR_DEPLOYMENT/api/v1/chat/completions \\
  -H "Authorization: Bearer nr_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "kimi-k2-6",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`}</div>
        </div>
        <p className="mt-2">That id is live right now — paste your key and run it as-is. Others on <Link href="/models" className="underline underline-offset-4 hover:text-white">/models</Link>. Keep the rest byte-for-byte.</p>
      </Section>

      <Section n="03" title="Endpoints">
        <div className="panel overflow-hidden">
          <div className="tbl-wrap">
          <table className="tbl">
            <tbody>
              <Row m="POST" p="/api/v1/chat/completions" d="Chat, OpenAI shape. Streaming via SSE with stream:true." />
              <Row m="POST" p="/api/v1/messages" d="Chat, Anthropic shape. x-api-key header, Anthropic body + SSE stream. Works with the anthropic SDK unmodified." />
              <Row m="GET" p="/api/v1/models" d="Catalog of wired models." />
              <Row m="POST" p="/api/v1/videos/generations" d="Video from a text prompt. Body: { model, prompt }. Returns a URL or base64." />
              <Row m="POST" p="/api/v1/images/generations" d="Image from prompt. { model, prompt, size? }." />
              <Row m="POST" p="/api/v1/audio/speech" d="Text-to-speech. Returns audio bytes." />
              <Row m="POST" p="/api/v1/audio/transcriptions" d="Speech-to-text. Multipart file upload." />
              <Row m="POST" p="/api/v1/embeddings" d="Vectors for search / RAG." />
            </tbody>
          </table>
          </div>
        </div>
      </Section>

      <Section n="04" title="Limits">
        <div className="panel panel-pad">
          <ul className="space-y-2 text-[13px] text-neutral-400">
            <li>· <strong className="text-white">{DAILY_TOKEN_LIMIT.toLocaleString()} tokens/day</strong>, everything combined. Resets 00:00 UTC.</li>
            <li>· Over the line → <span className="mono text-neutral-200">429 daily_cap_exceeded</span> + Retry-After. No overage charges.</li>
            <li>· Check yours any time: <Link href="/usage" className="underline underline-offset-4 hover:text-white">usage tab</Link> or <span className="mono text-neutral-200">/usage</span> in Discord.</li>
          </ul>
        </div>
      </Section>

      <Section n="05" title="Errors you'll actually see">
        <div className="panel overflow-hidden">
          <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Code</th><th>What it means</th></tr></thead>
            <tbody>
              <tr><td className="mono text-white">401</td><td className="text-neutral-400">Key missing / wrong / revoked. Re-check, or /rotate.</td></tr>
              <tr><td className="mono text-white">404 model_not_found</td><td className="text-neutral-400">Id typo. Copy from /models.</td></tr>
              <tr><td className="mono text-white">429</td><td className="text-neutral-400">Daily cap hit. Wait for 00:00 UTC, or check /usage.</td></tr>
              <tr><td className="mono text-white">502</td><td className="text-neutral-400">Upstream hiccup — we already retried once. Just resend.</td></tr>
            </tbody>
          </table>
          </div>
        </div>
      </Section>

      <Section n="06" title="Third-party clients">
        <div className="panel divide-y divide-neutral-800 overflow-hidden">
          <div className="p-4">
            <h3 className="text-[13px] font-bold text-white">JanitorAI</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              In API settings, use an <strong className="text-neutral-200">OpenAI-compatible reverse proxy</strong> and point it at{' '}
              <code className="mono text-neutral-200">https://YOUR_DEPLOYMENT/api/v1</code>{' '}
              with your <code className="mono text-neutral-200">nr_</code> key. Pick a chat model id from{' '}
              <Link href="/models" className="underline underline-offset-4 hover:text-white">/models</Link>. If a character
              preset sends a model the catalog doesn't list, calls fail with "model not found" — swap the id.
            </p>
          </div>
          <div className="p-4">
            <h3 className="text-[13px] font-bold text-white">SillyTavern</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              On API Connections pick <strong className="text-neutral-200">Chat Completion</strong> → Custom (OpenAI-compatible),
              set the base URL to{' '}
              <code className="mono text-neutral-200">https://YOUR_DEPLOYMENT/api/v1</code>{' '}
              with your key, and enter a chat model id from{' '}
              <Link href="/models" className="underline underline-offset-4 hover:text-white">/models</Link>. Streaming works.
            </p>
          </div>
          <div className="p-4">
            <h3 className="text-[13px] font-bold text-white">Anthropic SDK / claude-shaped clients</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              Point the SDK at <code className="mono text-neutral-200">/api/v1</code> — the{' '}
              <code className="mono text-neutral-200">/v1/messages</code> endpoint speaks native Anthropic
              (x-api-key, block content, system field, SSE events).
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              <code className="mono text-neutral-200">max_tokens</code> is required;{' '}
              <code className="mono text-neutral-200">temperature</code>,{' '}
              <code className="mono text-neutral-200">top_p</code>,{' '}
              <code className="mono text-neutral-200">stop_sequences</code>,{' '}
              <code className="mono text-neutral-200">tools</code> and{' '}
              <code className="mono text-neutral-200">tool_choice</code> pass through untouched.
            </p>
            <div className="term mt-2">
              <div className="term-body">{`from anthropic import Anthropic
c = Anthropic(base_url="https://YOUR_DEPLOYMENT/api/v1",
              api_key="nr_YOUR_KEY")
m = c.messages.create(model="kimi-k2-6", max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}])
print(m.content[0].text)`}</div>
            </div>
          </div>
        </div>
      </Section>

      <Section n="07" title="Python in 6 lines">
        <div className="term">
          <div className="term-body">{`from openai import OpenAI
c = OpenAI(base_url="https://YOUR_DEPLOYMENT/api/v1",
           api_key="nr_YOUR_KEY")
r = c.chat.completions.create(model="kimi-k2-6",
    messages=[{"role": "user", "content": "Hello"}])
print(r.choices[0].message.content)`}</div>
        </div>
      </Section>

      <p className="mono mt-6 border-t border-neutral-800 pt-4 text-[11px] leading-relaxed text-neutral-600">
        stuck? ask in discord — #help is faster than email. include the model id,
        the http status, and the time (utc). that&apos;s all we need.
      </p>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="flex items-baseline gap-3 text-[16px] font-bold text-white">
        <span className="mono text-[12px] font-normal text-neutral-600">{n}</span> {title}
        <span className="h-px flex-1 bg-neutral-800" />
      </h2>
      <div className="mt-3 text-[13px] leading-relaxed text-neutral-400">{children}</div>
    </section>
  );
}

function Row({ m, p, d }: { m: string; p: string; d: string }) {
  return (
    <tr>
      <td className="w-[70px]"><span className="tag">{m}</span></td>
      <td><div className="mono text-[12.5px] text-neutral-100">{p}</div><div className="mt-0.5 text-[12px] text-neutral-500">{d}</div></td>
    </tr>
  );
}
