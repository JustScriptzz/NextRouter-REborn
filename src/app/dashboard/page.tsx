import Link from 'next/link';
import { DAILY_TOKEN_LIMIT, DISCORD_URL, MODELS } from '@/lib/shell-config';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-static';

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="micro">Dashboard · {today}</div>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-white">Here&apos;s the gateway.</h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            Usage tracking isn&apos;t connected yet — this page shows limits and setup, not activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/playground" className="btn btn-line px-3 py-1.5 text-[13px]">Open playground</Link>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-solid px-3 py-1.5 text-[13px]">Get key</a>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Daily cap" value={DAILY_TOKEN_LIMIT.toLocaleString()} sub="tokens · resets 00:00 UTC" />
        <Stat label="Models" value={String(MODELS.length)} sub="live now" />
        <Stat label="Tokens used today" value="—" sub="tracking not connected" />
        <Stat label="Requests today" value="—" sub="tracking not connected" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel panel-pad">
          <div className="flex items-baseline justify-between">
            <div className="micro">Daily budget — 50m tokens</div>
            <div className="mono text-[12px] text-neutral-500">no data yet</div>
          </div>
          <div className="bar mt-3"><div style={{ width: '0%' }} /></div>
          <div className="mono mt-2 flex justify-between text-[11px] text-neutral-500">
            <span>0 tracked</span>
            <span>{DAILY_TOKEN_LIMIT.toLocaleString()} cap</span>
          </div>
          <p className="mt-3 border-t border-neutral-800 pt-3 text-[13px] leading-relaxed text-neutral-500">
            The cap covers everything combined — chat, image, audio, embeds. Once tracking
            is wired, over the line the API answers <span className="mono text-neutral-300">429</span> until
            midnight UTC. Right now nothing is counted.
          </p>
          <Link href="/usage" className="mono mt-2 inline-block text-[12px] text-neutral-300 underline underline-offset-4 hover:text-white">
            how usage will work →
          </Link>
        </div>

        <div className="panel panel-pad">
          <div className="micro">Quick start</div>
          <div className="term mt-3">
            <div className="term-body">{`# 1 — grab a key from the bot
/claim  (in discord #bot-commands)

# 2 — call it like OpenAI
export NR_KEY=nr_...
curl $BASE/chat/completions -H "Authorization: Bearer $NR_KEY" ...`}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/docs" className="btn btn-line flex-1 py-1.5 text-[13px]">Docs</Link>
            <Link href="/keys" className="btn btn-line flex-1 py-1.5 text-[13px]">Keys tab</Link>
          </div>
        </div>
      </div>

      <div className="panel mt-3 px-4 py-10 text-center">
        <div className="micro">Recent requests</div>
        <p className="mt-2 text-[14px] font-semibold text-neutral-200">Nothing here yet</p>
        <p className="mx-auto mt-1 max-w-[52ch] text-[13px] leading-relaxed text-neutral-500">
          This table fills in once providers are wired and keys start hitting the gateway.
          Make your first call from the playground or curl and it&apos;ll show up here.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel panel-pad">
      <div className="micro">{label}</div>
      <div className="mt-1.5 font-mono text-[22px] leading-none text-white">{value}</div>
      <div className="mono mt-1.5 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}
