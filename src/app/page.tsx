import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getCatalog } from '@/lib/providers';
import CodeBlock from '@/components/CodeBlock';

export const dynamic = 'force-dynamic';

const FEATURES = [
  {
    title: 'One key, every model',
    desc: 'Text and image models behind a single OpenAI-compatible endpoint. Swap your base URL, keep your code.',
    icon: (
      <path
        d="M7 7l5 5-5 5M13 17h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    accent: 'from-violet-500/20 to-violet-500/0 text-violet-300',
  },
  {
    title: 'Automatic failover',
    desc: 'Transient upstream failures are retried with smart backoff, then routed to a healthy fallback model.',
    icon: (
      <path
        d="M4 10a6 6 0 0110.5-4M16 10a6 6 0 01-10.5 4M14 3v3h-3M6 17v-3h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    accent: 'from-cyan-500/20 to-cyan-500/0 text-cyan-300',
  },
  {
    title: 'Bring your own models',
    desc: 'Plug any OpenAI-compatible endpoint into the gateway, set rate limits, and share it publicly or keep it private.',
    icon: (
      <path
        d="M10 3v4m0 6v4m-7-7h4m6 0h4M5.5 5.5l2.5 2.5m4 4l2.5 2.5m0-9L12 8m-4 4l-2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ),
    accent: 'from-fuchsia-500/20 to-fuchsia-500/0 text-fuchsia-300',
  },
];

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect('/models');

  let modelCount = 15;
  let imageCount = 4;
  try {
    const catalog = await getCatalog();
    modelCount = catalog.models.length;
    imageCount = catalog.models.filter((m) => m.type === 'image').length;
  } catch {
    /* keep defaults */
  }

  return (
    <div className="mx-auto max-w-5xl">
      <section className="anim-fade-up flex flex-col items-center pt-20 text-center sm:pt-28">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {modelCount} models live right now
        </span>

        <h1 className="hero-glow max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-zinc-50 sm:text-6xl">
          One API key.
          <br />
          <span className="text-shimmer">Every model.</span>
        </h1>

        <p className="anim-fade-up delay-1 mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          NextRouter REborn is a unified AI gateway for text and image models.
          OpenAI-compatible, with automatic retries and failover built in.
        </p>

        <div className="anim-fade-up delay-2 mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-2.5 text-base">
            Get your API key
          </Link>
          <Link href="/models" className="btn-ghost px-6 py-2.5 text-base">
            Browse models
          </Link>
        </div>

        <div className="anim-fade-up delay-3 mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-zinc-500">
          <span className="flex items-center gap-2">
            <Dot /> {modelCount - imageCount} text models
          </span>
          <span className="flex items-center gap-2">
            <Dot /> {imageCount} image models
          </span>
          <span className="flex items-center gap-2">
            <Dot /> 500K free tokens daily
          </span>
        </div>
      </section>

      <section className="anim-fade-up delay-4 mt-16 grid grid-cols-1 gap-4 sm:mt-24 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className={`card card-hover relative overflow-hidden p-6`}>
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${f.accent.split(' ').slice(0, 2).join(' ')}`}
            />
            <div
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 ${f.accent.split(' ').slice(2).join(' ')}`}
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
                {f.icon}
              </svg>
            </div>
            <h2 className="relative mt-4 font-semibold text-zinc-100">{f.title}</h2>
            <p className="relative mt-2 text-sm leading-relaxed text-zinc-400">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="anim-fade-up delay-5 mt-16 sm:mt-24">
        <div className="card overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="border-b border-white/10 p-8 md:border-b-0 md:border-r">
              <h2 className="text-xl font-bold text-zinc-100">Drop-in compatible</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                If your client speaks OpenAI, it already speaks NextRouter. Change the base URL,
                paste your key, pick a model ID from the catalog.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <Check /> Streaming SSE support
                </li>
                <li className="flex items-start gap-2.5">
                  <Check /> Images via{' '}
                  <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-violet-300">
                    /images/generations
                  </code>{' '}
                  and{' '}
                  <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-violet-300">
                    /images/edits
                  </code>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check /> Per-key usage tracking and limits
                </li>
              </ul>
            </div>
            <div className="bg-zinc-950/60 p-6">
              <CodeBlock
                label="bash"
                code={`curl https://nextrouter-vert.vercel.app/api/v1/chat/completions \\
  -H "Authorization: Bearer nr_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "kiro-auto",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="anim-fade-up delay-6 mt-16 mb-10 text-center sm:mt-24">
        <h2 className="text-2xl font-bold text-zinc-100 sm:text-3xl">
          Ready to route?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">
          Create a free account, generate a key, and make your first call in under a minute.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-2.5">
            Create account
          </Link>
          <Link href="/docs" className="btn-ghost px-6 py-2.5">
            Read the docs
          </Link>
        </div>
      </section>
    </div>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-violet-400" />;
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden>
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
