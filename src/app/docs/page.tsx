import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Docs | NextRouter REborn',
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app';

export default function DocsPage() {
  const apiBase = baseUrl.replace(/\/$/, '');
  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-2xl font-bold text-zinc-100">Documentation</h1>
      <p className="mt-1 text-sm text-zinc-500">
        NextRouter REborn exposes an OpenAI-compatible API. Point your client at it with an API key
        from the Keys page.
      </p>

      <Section title="Quick start">
        <Code>
          {`curl ${apiBase}/api/v1/chat/completions \\
  -H "Authorization: Bearer nr_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"some-public-model","messages":[{"role":"user","content":"Hello"}]}'`}
        </Code>
        <p>
          Just swap the base URL and key. The available model IDs are listed on the Models page.
        </p>
      </Section>

      <Section title="Endpoints">
        <Endpoint
          method="POST"
          path="/api/v1/chat/completions"
          desc="Text completions. Supports streaming (SSE) and non-streaming."
        />
        <Endpoint
          method="POST"
          path="/api/v1/images/generations"
          desc="Image generation. OpenAI-compatible body."
        />
        <Endpoint
          method="POST"
          path="/api/v1/audio/speech"
          desc="Text-to-speech, returns audio bytes."
        />
        <Endpoint
          method="POST"
          path="/api/v1/audio/transcriptions"
          desc="Speech-to-text, multipart form upload."
        />
        <Endpoint method="GET" path="/api/v1/models" desc="Lists available model IDs." />
      </Section>

      <Section title="Authentication">
        <p>
          All <code className="text-zinc-300">/api/v1</code> endpoints require{' '}
          <code className="text-zinc-300">Authorization: Bearer &lt;key&gt;</code>. Generate keys on
          the Keys page. Keys are shown once — keep them safe.
        </p>
      </Section>

      <Section title="Limits">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Daily token limit: <strong>500,000 tokens</strong> per user, combined across all models.
            Resets at midnight UTC.
          </li>
          <li>
            Model-level RPM limits may apply to individual custom models (set by the model owner).
          </li>
          <li>One key can hold at most 10 API keys.</li>
        </ul>
      </Section>

      <Section title="Custom models">
        <p>
          Owners can add their own endpoints on the My Models page. Public custom models can be
          called by anyone as <code className="text-zinc-300">{'{owner-username}/{model-name}'}</code>.
          Private models only work with the owner&apos;s keys.
        </p>
      </Section>

      <Section title="Streaming example">
        <Code>
          {`const res = await fetch("${apiBase}/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer nr_xxxxxxxx",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "some-public-model",
    stream: true,
    messages: [{ role: "user", content: "Hello" }]
  })
});
for await (const chunk of res.body) {
  console.log(new TextDecoder().decode(chunk));
}`}
        </Code>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color =
    method === 'GET'
      ? 'bg-cyan-500/15 text-cyan-300'
      : 'bg-violet-500/15 text-violet-300';
  return (
    <div className="flex items-start gap-3 border-b border-zinc-800/60 py-3 last:border-0">
      <span className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${color}`}>
        {method}
      </span>
      <div className="min-w-0">
        <div className="font-mono text-sm text-zinc-200">{path}</div>
        <div className="mt-0.5 text-sm text-zinc-500">{desc}</div>
      </div>
    </div>
  );
}