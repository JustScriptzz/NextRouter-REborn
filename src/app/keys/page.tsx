import { DISCORD_URL } from '@/lib/shell-config';

export const metadata = { title: 'Keys' };
export const dynamic = 'force-static';

export default function KeysPage() {
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="micro">Keys · issued by bot, not by form</div>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight text-white">API keys</h1>
      <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed text-neutral-500">
        There&apos;s no “create key” button here on purpose. Keys come from the Discord bot so
        one person can&apos;t mint forty of them. It takes about a minute.
      </p>

      <div className="panel panel-pad mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold text-white">Just looking? Use the demo key</div>
            <div className="mono mt-0.5 text-[11px] text-neutral-500">
              <span className="text-white">demo</span> · shared bucket · 40M tokens/day · 30 req/min
            </div>
          </div>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
          Paste <code className="mono text-white">demo</code> as your Bearer key — no account, works
          instantly. It&apos;s one bucket everyone shares, so grab your own key below for real use.
        </p>
      </div>

      <div className="panel panel-pad mt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold text-white">Get your key in 3 steps</div>
            <div className="mono mt-0.5 text-[11px] text-neutral-500">your discord · #bot-commands</div>
          </div>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-solid px-4 py-2 text-[13px]">
            Join Discord →
          </a>
        </div>
        <ol className="mt-4 space-y-3">
          <Step n="01" title="Join the server" body="Link above. You just need to be a member — no role, no verification maze." />
          <Step n="02" title="Run /claim in #bot-commands" body="The bot DMs you a key shaped like nr_.... It tells you the rules (how many keys, when it resets) right there in chat." />
          <Step n="03" title="Paste it anywhere" body="Use it as Bearer auth, or drop it into the Playground top field. Same key works for curl, Python, OpenAI SDKs." />
        </ol>
        <div className="term mt-4">
          <div className="term-bar"><span className="mono text-[11px] uppercase tracking-wider text-neutral-500">discord</span><span className="mono text-[11px] text-neutral-600">#bot-commands</span></div>
          <div className="term-body">{`you: /claim
bot: check your DMs — key nr_... is yours.
     keep it secret. /rotate if it leaks.
     cap: 50,000,000 tokens/day, resets 00:00 UTC.`}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="panel panel-pad mt-3">
          <div className="micro">Bot commands</div>
          <div className="mono mt-2 space-y-1.5 text-[12px]">
            <div><span className="text-white">/claim</span> <span className="text-neutral-500">— issue your key</span></div>
            <div><span className="text-white">/usage</span> <span className="text-neutral-500">— today&apos;s tokens</span></div>
            <div><span className="text-white">/rotate</span> <span className="text-neutral-500">— new key, old dies</span></div>
            <div><span className="text-white">/revoke</span> <span className="text-neutral-500">— kill it entirely</span></div>
          </div>
        </div>
        <div className="panel panel-pad mt-3">
          <div className="micro">What a key looks like</div>
          <div className="mono mt-2 break-all border border-neutral-800 bg-black p-2.5 text-[12px] text-neutral-300" style={{ borderRadius: 5 }}>
            nr_… <span className="text-neutral-600">(the real one lives in your DMs)</span>
          </div>
          <ul className="mt-2.5 space-y-1 text-[12px] leading-relaxed text-neutral-500">
            <li>· Never shows twice. Screenshot the DM, then delete it.</li>
            <li>· Leaked? <span className="mono text-neutral-300">/rotate</span> takes 5 seconds.</li>
            <li>· One key covers every model.</li>
          </ul>
        </div>
      </div>

      <p className="mono mt-4 text-[11px] leading-relaxed text-neutral-600">
        lost access to discord? you&apos;ll need to come back through discord — there&apos;s no email reset
        in the shell. that&apos;s deliberate while keys are bot-issued.
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-3 border-t border-neutral-800 pt-3 first:border-0 first:pt-0">
      <span className="mono text-[12px] text-neutral-600">{n}.</span>
      <div>
        <div className="text-[13px] font-semibold text-neutral-100">{title}</div>
        <div className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">{body}</div>
      </div>
    </li>
  );
}
