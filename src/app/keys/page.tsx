export const metadata = { title: 'Keys' };
export const dynamic = 'force-static';

export default function KeysPage() {
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="micro">Keys · demo in-code, nr_… in Postgres</div>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight text-white">API keys</h1>
      <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed text-neutral-500">
        Three kinds of keys open this gateway. Pick the one matching how you run it.
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
          instantly. It&apos;s one bucket everyone shares, so mint your own key below for real use.
        </p>
      </div>

      <div className="panel panel-pad mt-3">
        <div className="micro">Self-host keys</div>
        <div className="mono mt-2 space-y-1.5 text-[12px]">
          <div><span className="text-white">nr_…</span> <span className="text-neutral-500">— rows in the Postgres api_keys table (hashed, masked)</span></div>
          <div><span className="text-white">SYSTEM_TEST_KEY</span> <span className="text-neutral-500">— env-only key, unlimited rpm for sweeps</span></div>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-neutral-500">
          One key covers every model. Use it as Bearer auth, or drop it into the Playground top field.
        </p>
      </div>

      <div className="panel panel-pad mt-3">
        <div className="micro">What a key looks like</div>
        <div className="mono mt-2 break-all border border-neutral-800 bg-black p-2.5 text-[12px] text-neutral-300" style={{ borderRadius: 5 }}>
          nr_… <span className="text-neutral-600">(43 chars after the prefix)</span>
        </div>
        <ul className="mt-2.5 space-y-1 text-[12px] leading-relaxed text-neutral-500">
          <li>· Leaked? Revoke the row and mint a new one.</li>
          <li>· One key covers every model.</li>
        </ul>
      </div>
    </div>
  );
}
