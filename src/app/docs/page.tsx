import type { Metadata } from 'next';
import CodeBlock from '@/components/CodeBlock';

export const metadata: Metadata = {
  title: 'Docs',
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nextrouter-vert.vercel.app';
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

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="anim-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Documentation</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          NextRouter REborn exposes an OpenAI-compatible API. Point your client at it with an API
          key from the Keys page — no SDK changes needed.
        </p>
      </div>

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
          <Endpoint method="GET" path="/api/v1/models" desc="Lists available model IDs." />
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

      <Section title="Streaming example" className="anim-fade-up delay-6">
        <CodeBlock code={streamingExample} label="javascript" />
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
