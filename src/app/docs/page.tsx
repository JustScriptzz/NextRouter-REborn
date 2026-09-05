import type { Metadata } from 'next';
import CodeBlock from '@/components/CodeBlock';

export const metadata: Metadata = {
  title: 'Docs',
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nextrouterfree.duckdns.org';
const apiBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

export default function DocsPage() {
  const quickStart = `curl ${apiBase}/api/v1/chat/completions \\
  -H "Authorization: Bearer nr_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"kiro-auto","messages":[{"role":"user","content":"Hello"}]}'`;

  const streamingExample = `const res = await fetch("${apiBase}/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer nr_xxxxxxxx",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "kiro-auto",
    stream: true,
    messages: [{ role: "user", content: "Hello" }]
  })
});
for await (const chunk of res.body) {
  console.log(new TextDecoder().decode(chunk));
}`;

  const videoExample = `curl ${apiBase}/api/v1/videos/generations \\
  -H "Authorization: Bearer nr_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"video-model-id","prompt":"A cat surfing a wave"}'`;

  const openCodeExample = `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "nextrouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NextRouter",
      "options": {
        "baseURL": "${apiBase}/api/v1",
        "apiKey": "nr_xxxxxxxx"
      },
      "models": {
        "gpt-4o": { "name": "GPT-4o (NextRouter)" }
      }
    }
  }
}`;

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="anim-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Documentation</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          NextRouter REborn exposes an OpenAI-compatible API. Point your client at it with an API
          key from the Keys page — no SDK changes needed.
        </p>
      </div>

      <Section title="Attribution & Credits" className="anim-fade-up delay-1">
        <div className="card p-5" style={{ border: '0.5px solid #ffffff30' }}>
          <p className="text-sm font-semibold text-zinc-100">
            Any project that uses NextRouter REborn as its AI model provider MUST credit NextRouter
            and link back to this platform.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            <li className="flex items-start gap-2.5">
              <Bullet />
              <span>
                Display a visible credit line and a working hyperlink to{' '}
                <a
                  href={baseUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-4 text-zinc-100"
                >
                  {baseUrl}
                </a>{' '}
                wherever the project showcases its features (e.g. about page, footer, README, or
                app settings).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Bullet />
              <span>
                In commercial or distributed products, include the attribution in the app&apos;s
                settings / about screen, not only in source code.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Bullet />
              <span>
                Do not remove, obfuscate, or claim as your own any NextRouter branding, URLs, or
                provider references.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            This keeps the gateway proudly credited as your underlying model provider. Thanks for
            routing with NextRouter REborn — Engineered by JustScriptzz.
          </p>
        </div>
      </Section>

      <Section title="Quick start" className="anim-fade-up delay-1">
        <CodeBlock code={quickStart} label="bash" />
        <p className="mt-3 text-sm text-zinc-400">
          Just swap the base URL and key. Available model IDs are listed on the Models page.
        </p>
      </Section>

      <Section title="Endpoints" className="anim-fade-up delay-2">
        <div className="card divide-y divide-white/5 overflow-hidden">
          <Endpoint
            method="POST"
            path="/api/v1/chat/completions"
            desc="Text completions. Supports streaming (SSE) and non-streaming."
          />
          <Endpoint
            method="POST"
            path="/api/v1/images/generations"
            desc="Image generation from a text prompt. OpenAI-compatible body."
          />
          <Endpoint
            method="POST"
            path="/api/v1/images/edits"
            desc="Image editing for models that support it (e.g. flux-2-pro, sdxl-lightning)."
          />
          <Endpoint
            method="POST"
            path="/api/v1/audio/speech"
            desc="Text-to-speech for tts models. Returns audio bytes."
          />
          <Endpoint
            method="POST"
            path="/api/v1/audio/transcriptions"
            desc="Speech-to-text for stt models. Multipart form upload with a file field."
          />
<Endpoint
            method="POST"
            path="/api/v1/embeddings"
            desc="Text embeddings. OpenAI-compatible body."
          />
          <Endpoint
            method="POST"
            path="/api/v1/videos/generations"
            desc="Video generation from a text prompt. Body: { model, prompt }. Returns a video URL or base64."
          />
          <Endpoint method="GET" path="/api/v1/models" desc="Lists available model IDs." />
          <Endpoint
            method="GET"
            path="/api/v1/whoami"
            desc="Returns info about the authenticated key: user id, username, email, and whether limits are removed."
          />
        </div>
      </Section>

      <Section title="Authentication" className="anim-fade-up delay-3">
        <div className="card p-5">
          <p className="text-sm leading-relaxed text-zinc-300">
            All{' '}
            <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>
              /api/v1
            </code>{' '}
            endpoints require{' '}
            <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>
              Authorization: Bearer &lt;key&gt;
            </code>
            . Generate keys on the Keys page. Keys are shown once — keep them safe.
          </p>
        </div>
      </Section>

      <Section title="Limits" className="anim-fade-up delay-4">
        <div className="card p-5">
          <ul className="space-y-3 text-sm text-zinc-300">
            <li className="flex items-start gap-2.5">
              <Bullet />
              <span>
                Daily token limit: <strong className="text-zinc-100">500K tokens</strong> per user,
                combined across all models. Resets at midnight UTC.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Bullet />
              <span>
                Requests per minute: <strong className="text-zinc-100">15 RPM</strong> per account
                by default on <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>/api/v1/chat/completions</code>. Check the Limits
                page for your current allowance.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Bullet />
              <span>
                Model-level RPM limits may apply to individual custom models (set by the model
                owner).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Bullet />
              <span>
                Custom models: at most <strong className="text-zinc-100">100 per account</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Bullet />
              <span>
                Accounts with limits removed (unlimited) skip both the daily token cap and the
                per-account RPM gate.
              </span>
            </li>
          </ul>
        </div>
      </Section>

      <Section title="Custom models" className="anim-fade-up delay-5">
        <div className="card p-5">
          <p className="text-sm leading-relaxed text-zinc-300">
            Owners can add their own endpoints on the My Models page. Public custom models can be
            called by anyone as{' '}
            <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>
              {'{owner-username}/{model-name}'}
            </code>
            . Private models only work with the owner&apos;s keys.
          </p>
        </div>
      </Section>

      <Section title="Third-party clients" className="anim-fade-up delay-6">
        <div className="card divide-y divide-white/5 overflow-hidden">
          <div className="p-5">
            <h3 className="text-sm font-semibold text-zinc-100">OpenCode (coding agent)</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              Add NextRouter as a custom provider in <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>opencode.json</code> using the
              OpenAI-compatible package. Use any text model ID from the Models page — tool calling
              is emulated gateway-side, so agentic workflows (file edits, shell calls) work on every model.
            </p>
            <div className="mt-3">
              <CodeBlock code={openCodeExample} label="json" />
            </div>
          </div>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-zinc-100">SillyTavern</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              On the API Connections page pick the <strong className="text-zinc-200">Chat Completions</strong> API
              type with an OpenAI-compatible / custom endpoint, then set the base URL to{' '}
              <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>{apiBase}/api/v1</code>{' '}
              with your key, and enter any text model ID from the Models page. Streaming works.
            </p>
          </div>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-zinc-100">JanitorAI</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              In JanitorAI&apos;s API settings use an OpenAI-compatible reverse-proxy URL pointing at{' '}
              <code className="rounded px-1.5 py-0.5 font-mono text-xs text-zinc-300" style={{ background: '#1D1D1F' }}>{apiBase}/api/v1</code>{' '}
              with your key, and pick a chat model ID from the Models page. If a character preset
              sends a model name the catalog doesn&apos;t know, calls fail with &quot;Model not
              found&quot; — swap it for a listed ID.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Streaming example" className="anim-fade-up delay-7">
        <CodeBlock code={streamingExample} label="javascript" />
      </Section>

      <Section title="Video generation example" className="anim-fade-up delay-8">
        <CodeBlock code={videoExample} label="bash" />
        <p className="mt-3 text-sm text-zinc-400">
          Response contains a video URL or base64 payload, depending on the model. Video
          generation can take longer than other endpoints — allow extra time before it responds.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-10 ${className}`}>
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold text-zinc-100">
        {title}
        <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      </h2>
      {children}
    </section>
  );
}

function Bullet() {
  return <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />;
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const isGet = method === 'GET';
  const color = isGet
    ? 'border-[#2d2d2d] bg-[#1D1D1F] text-zinc-300'
    : 'border-[#2d2d2d] bg-[#1D1D1F] text-zinc-300';
  return (
    <div className="group flex items-start gap-4 p-4 transition hover:bg-white/[0.02]">
      <span
        className={`mt-0.5 shrink-0 rounded-lg border px-2 py-1 font-mono text-[11px] font-bold tracking-wide ${color}`}
      >
        {method}
      </span>
      <div className="min-w-0">
        <div className="break-all font-mono text-sm text-zinc-200">{path}</div>
        <div className="mt-1 text-sm leading-relaxed text-zinc-500">{desc}</div>
      </div>
    </div>
  );
}
