import { DAILY_TOKEN_LIMIT } from '@/lib/shell-config';

export const metadata = { title: 'Usage' };
export const dynamic = 'force-static';

export default function UsagePage() {
  return (
    <div className="mx-auto max-w-[760px]">
      <div className="micro">Usage · hard cap {DAILY_TOKEN_LIMIT.toLocaleString()} / day</div>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight text-white">Usage</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        One bucket for everything — chat, image, audio, embeds. Resets 00:00 UTC.
        Tracking isn&apos;t connected yet, so there&apos;s nothing counted below.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Daily cap" value={DAILY_TOKEN_LIMIT.toLocaleString()} sub="tokens" />
        <Mini label="Used today" value="—" sub="not tracked yet" />
        <Mini label="Left today" value="—" sub="not tracked yet" />
        <Mini label="Reset" value="00:00" sub="UTC · daily" />
      </div>

      <div className="panel panel-pad mt-3">
        <div className="flex items-baseline justify-between">
          <span className="micro">Today vs 5m cap</span>
          <span className="mono text-[12px] text-neutral-500">no data yet</span>
        </div>
        <div className="bar mt-3"><div style={{ width: '0%' }} /></div>
        <div className="mono mt-2 flex justify-between text-[11px] text-neutral-500">
          <span>0 tracked</span>
          <span>{DAILY_TOKEN_LIMIT.toLocaleString()} cap</span>
        </div>
        <p className="mt-3 border-t border-neutral-800 pt-3 text-[13px] text-neutral-500">
          Past the line, calls will fail with <span className="mono text-neutral-300">429 · daily_cap_exceeded</span> and
          a <span className="mono text-neutral-300">Retry-After</span> header. No overages, no surprise bill —
          it just waits for midnight.
        </p>
      </div>

      <div className="panel mt-3 px-4 py-10 text-center">
        <div className="micro">History</div>
        <p className="mt-2 text-[14px] font-semibold text-neutral-200">No history yet</p>
        <p className="mx-auto mt-1 max-w-[52ch] text-[13px] leading-relaxed text-neutral-500">
          Daily bars and per-model breakdowns appear here once usage tracking is wired.
          Until then the only number that matters is the cap above.
        </p>
      </div>

      <p className="mono mt-4 text-[11px] text-neutral-600">
        later: check <span className="text-neutral-400">/usage</span> in discord with /usage any time — same numbers, no login needed.
      </p>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel panel-pad">
      <div className="micro">{label}</div>
      <div className="mt-1 font-mono text-[18px] text-white">{value}</div>
      <div className="mono mt-0.5 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}
