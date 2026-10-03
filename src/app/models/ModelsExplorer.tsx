'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MODELS, type IoKind, type ShellModel } from '@/lib/shell-config';

const FILTERS = ['all', 'chat', 'image', 'audio', 'video', 'embed'] as const;

// A model is never re-probed more often than this on auto. Manual
// "Test all" always forces a fresh pass.
const AUTO_MIN_INTERVAL_MS = 60000;
const AUTO_BREATHER_MS = 1500;
const AUTO_RESTART_PAUSE_MS = 5000;

type ProbeState = 'idle' | 'testing' | 'ok' | 'slow' | 'fail';
type Probe = { st: ProbeState; ms?: number; err?: string };

const SLOW_MS = 30000;
const ATTEMPT_TIMEOUT_MS = 65000;

// tiny capability glyphs — 12px, stroke-only, dim when unsupported
function Glyph({ kind }: { kind: IoKind }) {
  const paths: Record<IoKind, React.ReactNode> = {
    text: <path d="M4 5.5h12M4 10h9M4 14.5h6" strokeLinecap="round" />,
    image: (
      <>
        <rect x="3.5" y="4.5" width="13" height="11" rx="1.5" />
        <path d="M4.5 13.5l3.5-3.5 2.5 2.5 2-2.5 3 3.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    audio: (
      <>
        <path d="M7 12.5V5.5l7-1.5v7" strokeLinejoin="round" />
        <circle cx="5.5" cy="12.5" r="1.6" />
        <circle cx="12.5" cy="11" r="1.6" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="5" width="10" height="10" rx="1.5" />
        <path d="M13 9.5l4-2.5v5l-4-2.5z" strokeLinejoin="round" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-3.5 w-3.5" aria-hidden>
      {paths[kind]}
    </svg>
  );
}

function CapIcon({ on, title, children }: { on: boolean; title: string; children: React.ReactNode }) {
  return (
    <span
      title={`${title}: ${on ? 'yes' : 'no'}`}
      className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
        on ? 'border-neutral-600 text-neutral-200' : 'border-neutral-800 text-neutral-700'
      }`}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-3 w-3" aria-hidden>
        {children}
      </svg>
    </span>
  );
}

function IoList({ kinds }: { kinds: IoKind[] }) {
  const all: IoKind[] = ['text', 'image', 'audio', 'video'];
  return (
    <span className="inline-flex gap-1">
      {all.map((k) => (
        <span
          key={k}
          title={`${k}${kinds.includes(k) ? '' : ' (not supported)'}`}
          className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
            kinds.includes(k) ? 'border-neutral-600 text-neutral-200' : 'border-neutral-800 text-neutral-700'
          }`}
        >
          <Glyph kind={k} />
        </span>
      ))}
    </span>
  );
}

function idColor(st: ProbeState): string {
  if (st === 'ok') return '#34d399';
  if (st === 'slow') return '#fbbf24';
  if (st === 'fail') return '#f87171';
  return '#ffffff';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function probeModel(modelId: string, key: string, signal: AbortSignal): Promise<{ ok: boolean; ms: number; err?: string }> {
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal.aborted) return { ok: false, ms: Date.now() - started, err: 'aborted' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
          max_tokens: 30,
        }),
        signal: ctrl.signal,
      });
      const j = await res.json().catch(() => null);
      const text: string =
        (j?.choices?.[0]?.message?.content ?? j?.choices?.[0]?.text ?? '') as string;
      if (res.ok && typeof text === 'string') {
        return { ok: true, ms: Date.now() - started };
      }
      const msg =
        (j?.error && (j.error.message || j.error)) || (j?.message as string | undefined) || `HTTP ${res.status}`;
      if (attempt === 1) return { ok: false, ms: Date.now() - started, err: String(msg).slice(0, 160) };
      // fall through to one retry
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === 1 || signal.aborted) {
        return { ok: false, ms: Date.now() - started, err: msg.slice(0, 160) };
      }
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }
  return { ok: false, ms: Date.now() - started, err: 'failed' };
}

export default function ModelsExplorer() {
  const [q, setQ] = useState('');
  const [f, setF] = useState<(typeof FILTERS)[number]>('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [testKey, setTestKey] = useState('');
  const [probes, setProbes] = useState<Record<string, Probe>>({});
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(true);
  const [done, setDone] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const lastTest = useRef<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nr_key');
      if (saved) setTestKey(saved);
      const cached = localStorage.getItem('nr_probe_results');
      if (cached) {
        const parsed = JSON.parse(cached) as { at?: number; results?: Record<string, Probe> };
        if (parsed && typeof parsed.results === 'object') {
          const valid: Record<string, Probe> = {};
          for (const m of MODELS) {
            const r = parsed.results[m.id];
            if (r && (r.st === 'ok' || r.st === 'slow' || r.st === 'fail')) {
              valid[m.id] = r;
              lastTest.current[m.id] = parsed.at ?? 0;
            }
          }
          if (Object.keys(valid).length > 0) setProbes(valid);
        }
      }
    } catch {}
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return MODELS.filter((m) => {
      if (f !== 'all' && m.type !== f) return false;
      if (!needle) return true;
      return m.id.toLowerCase().includes(needle) || m.label.toLowerCase().includes(needle);
    });
  }, [q, f]);

  function saveCache(next: Record<string, Probe>) {
    try {
      const keep: Record<string, Probe> = {};
      for (const m of MODELS) {
        const r = next[m.id];
        if (r && r.st !== 'idle' && r.st !== 'testing') keep[m.id] = r;
      }
      localStorage.setItem('nr_probe_results', JSON.stringify({ at: Date.now(), results: keep }));
    } catch {}
  }

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = id;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
  }

  function stop(manual: boolean) {
    abortRef.current?.abort();
    setRunning(false);
    if (manual) setAuto(false);
  }

  function applyResult(id: string, r: { ok: boolean; ms: number; err?: string }) {
    const st: ProbeState = !r.ok ? 'fail' : r.ms >= SLOW_MS ? 'slow' : 'ok';
    const probe: Probe = { st, ms: r.ms, err: r.err };
    lastTest.current[id] = Date.now();
    setProbes((p) => ({ ...p, [id]: probe }));
    return probe;
  }

  // One pass over the catalog. force=false skips models tested within the
  // last minute (auto mode); force=true retests everything (Test all).
  async function runPass(ctrl: AbortController, key: string, force: boolean) {
    const acc: Record<string, Probe> = {};
    setDone(0);
    const now = Date.now();
    for (const m of MODELS) {
      if (ctrl.signal.aborted) return false;
      if (!force && now - (lastTest.current[m.id] ?? 0) < AUTO_MIN_INTERVAL_MS) continue;
      setProbes((p) => ({ ...p, [m.id]: { st: 'testing' } }));
      const r = await probeModel(m.id, key, ctrl.signal);
      if (ctrl.signal.aborted) return false;
      const probe = applyResult(m.id, r);
      acc[m.id] = probe;
      setDone((d) => d + 1);
      await sleep(AUTO_BREATHER_MS);
      if (ctrl.signal.aborted) return false;
    }
    setProbes((p) => {
      const next = { ...p, ...acc };
      saveCache(next);
      return next;
    });
    return true;
  }

  async function testAll() {
    const key = testKey.trim();
    if (!key || runningRef.current) return;
    try {
      localStorage.setItem('nr_key', key);
    } catch {}
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    runningRef.current = true;
    setRunning(true);
    await runPass(ctrl, key, true);
    runningRef.current = false;
    setRunning(false);
  }

  async function testOne(m: ShellModel) {
    const key = testKey.trim();
    if (!key || runningRef.current) return;
    setProbes((p) => ({ ...p, [m.id]: { st: 'testing' } }));
    const ctrl = new AbortController();
    const r = await probeModel(m.id, key, ctrl.signal);
    const probe = applyResult(m.id, r);
    setProbes((p) => {
      const next = { ...p, [m.id]: probe };
      saveCache(next);
      return next;
    });
  }

  // Auto loop: while enabled with a key set, keep cycling the catalog so no
  // model goes more than ~a minute + one pass without a fresh probe.
  useEffect(() => {
    if (!auto || !testKey.trim() || MODELS.length === 0 || runningRef.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;
    const keyAtStart = testKey.trim();
    const loop = async () => {
      if (cancelled) return;
      ctrl = new AbortController();
      abortRef.current = ctrl;
      runningRef.current = true;
      setRunning(true);
      await runPass(ctrl, keyAtStart, false);
      runningRef.current = false;
      if (!cancelled) {
        setRunning(false);
        timer = setTimeout(loop, AUTO_RESTART_PAUSE_MS);
      }
    };
    const kickoff = setTimeout(loop, 2500);
    return () => {
      cancelled = true;
      clearTimeout(kickoff);
      clearTimeout(timer);
      ctrl?.abort();
      runningRef.current = false;
      setRunning(false);
    };
  }, [auto, testKey]);

  if (MODELS.length === 0) {
    return (
      <div className="panel mt-4 px-4 py-12 text-center">
        <div className="micro">Catalog empty</div>
        <p className="mt-2 text-[14px] font-semibold text-neutral-200">No models wired yet</p>
        <p className="mx-auto mt-1 max-w-[52ch] text-[13px] leading-relaxed text-neutral-500">
          Providers haven&apos;t been chosen, so there&apos;s nothing to list.
          This page fills in — capability icons, live tests and all — the moment they land.
        </p>
      </div>
    );
  }

  const counts = { ok: 0, slow: 0, fail: 0 };
  for (const m of MODELS) {
    const st = probes[m.id]?.st;
    if (st === 'ok') counts.ok++;
    else if (st === 'slow') counts.slow++;
    else if (st === 'fail') counts.fail++;
  }
  const tested = counts.ok + counts.slow + counts.fail;

  return (
    <div>
      {/* live tester */}
      <div className="panel panel-pad mt-0 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={testKey}
          onChange={(e) => setTestKey(e.target.value)}
          placeholder="Paste a key to test with"
          spellCheck={false}
          className="field mono flex-1 text-[12px]"
        />
        {running ? (
          <button onClick={() => stop(true)} className="btn btn-line shrink-0 px-4 py-1.5 text-[13px]">
            Stop ({done}/{MODELS.length})
          </button>
        ) : (
          <button
            onClick={testAll}
            disabled={!testKey.trim()}
            className="btn btn-solid shrink-0 px-4 py-1.5 text-[13px]"
          >
            Test all
          </button>
        )}
        <button
          onClick={() => setAuto((v) => !v)}
          title="When on, every model is re-probed at most once a minute automatically"
          className={`mono shrink-0 rounded border px-3 py-1.5 text-[12px] ${
            auto ? 'border-white bg-white font-bold text-black' : 'border-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          auto {auto ? 'on' : 'off'}
        </button>
      </div>
      <p className="mono mt-2 text-[11px] leading-relaxed text-neutral-600">
        {tested > 0
          ? <span><span style={{ color: '#34d399' }}>{counts.ok} ok</span> · <span style={{ color: '#fbbf24' }}>{counts.slow} slow</span> · <span style={{ color: '#f87171' }}>{counts.fail} down</span> — one tiny call each, counts against your cap{auto ? ' · auto retests every minute' : ''}</span>
          : 'Runs one tiny call per model with your key above. Green = answered, amber = slow or needed a retry, red = down. Auto retests every minute while on.'}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by id or use-case…  (try: code)"
            className="field sm:max-w-[320px]"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((k) => (
            <button
              key={k}
              onClick={() => setF(k)}
              className={`mono rounded border px-2.5 py-1.5 text-[12px] ${
                f === k
                  ? 'border-white bg-white font-bold text-black'
                  : 'border-neutral-800 bg-transparent text-neutral-400 hover:border-neutral-600 hover:text-white'
              }`}
            >
              {k}
              <span className="ml-1.5 opacity-60">
                {k === 'all' ? MODELS.length : MODELS.filter((m) => m.type === k).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel mt-4 overflow-hidden">
        <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Model</th>
              <th>Accepts</th>
              <th>Outputs</th>
              <th className="hidden md:table-cell">Context</th>
              <th className="hidden md:table-cell">Max out</th>
              <th>Caps</th>
              <th className="hidden sm:table-cell">Test</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => {
              const probe = probes[m.id] ?? { st: 'idle' as ProbeState };
              return (
              <tr key={m.id}>
                <td>
                  <div className="mono flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: idColor(probe.st) }}>
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          probe.st === 'idle' ? '#3f3f46' : idColor(probe.st),
                      }}
                    />
                    {probe.st === 'testing' && <span className="mr-0.5 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />}
                    {m.id}
                  </div>
                  <div className="mt-0.5 max-w-[38ch] text-[12px] leading-snug text-neutral-500">{m.label} — {m.note}</div>
                  {probe.err && <div className="mono mt-1 max-w-[38ch] truncate text-[11px] text-red-400/80" title={probe.err}>{probe.err}</div>}
                </td>
                <td><IoList kinds={m.inputs} /></td>
                <td><IoList kinds={m.outputs} /></td>
                <td className="mono hidden text-neutral-300 md:table-cell">{m.context}</td>
                <td className="mono hidden text-neutral-300 md:table-cell">{m.maxOutput}</td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    <CapIcon on={m.thinking} title="Thinking">
                      <path d="M10 3a4.5 4.5 0 00-4.5 4.5c0 1.6.8 2.4 1.5 3.2.5.6.8 1.1.8 1.8h4.4c0-.7.3-1.2.8-1.8.7-.8 1.5-1.6 1.5-3.2A4.5 4.5 0 0010 3z" strokeLinejoin="round" />
                      <path d="M8.2 15h3.6M8.7 17h2.6" strokeLinecap="round" />
                    </CapIcon>
                    <CapIcon on={m.tools} title="Tool calling">
                      <path d="M11.5 6.5a3 3 0 014-4l-2 2 .5 2 2 .5 2-2a3 3 0 01-4 4L7 15.5a1.8 1.8 0 01-2.5-2.5l6.9-6.5z" strokeLinejoin="round" />
                    </CapIcon>
                    <CapIcon on={m.webSearch} title="Web search">
                      <circle cx="10" cy="10" r="6.5" />
                      <path d="M3.5 10h13M10 3.5c2 1.8 2 11.2 0 13-2-1.8-2-11.2 0-13z" />
                    </CapIcon>
                    <CapIcon on={m.streaming !== false} title="Streaming">
                      <path d="M4.5 10.5a7.5 7.5 0 0111 0" strokeLinecap="round" />
                      <path d="M7 13a4 4 0 016 0" strokeLinecap="round" />
                      <circle cx="10" cy="15.5" r="1" />
                    </CapIcon>
                  </span>
                </td>
                <td className="hidden whitespace-nowrap sm:table-cell">
                  {probe.st === 'testing' ? (
                    <span className="mono text-[12px] text-neutral-500">…</span>
                  ) : (
                    <button
                      onClick={() => testOne(m)}
                      disabled={!testKey.trim() || running}
                      className="mono text-[12px] text-neutral-400 underline underline-offset-4 hover:text-white disabled:opacity-40"
                    >
                      {probe.ms !== undefined ? `${(probe.ms / 1000).toFixed(1)}s` : 'test'}
                    </button>
                  )}
                </td>
                <td className="text-right">
                  <button onClick={() => copy(m.id)} className="mono text-[12px] text-neutral-400 underline underline-offset-4 hover:text-white">
                    {copied === m.id ? 'copied' : 'copy'}
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {visible.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px] text-neutral-500">
            Nothing matches “{q}”. <button onClick={() => { setQ(''); setF('all'); }} className="underline underline-offset-4 hover:text-white">clear it</button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-neutral-600">
        <span className="flex items-center gap-1.5"><Glyph kind="text" /> text</span>
        <span className="flex items-center gap-1.5"><Glyph kind="image" /> image</span>
        <span className="flex items-center gap-1.5"><Glyph kind="audio" /> audio</span>
        <span className="flex items-center gap-1.5"><Glyph kind="video" /> video</span>
        <span className="text-neutral-700">·</span>
        <span className="flex items-center gap-1.5"><CapIcon on title="Thinking"><path d="M10 3a4.5 4.5 0 00-4.5 4.5c0 1.6.8 2.4 1.5 3.2.5.6.8 1.1.8 1.8h4.4c0-.7.3-1.2.8-1.8.7-.8 1.5-1.6 1.5-3.2A4.5 4.5 0 0010 3z" strokeLinejoin="round" /></CapIcon> thinking</span>
        <span className="flex items-center gap-1.5"><CapIcon on title="Tool calling"><path d="M11.5 6.5a3 3 0 014-4l-2 2 .5 2 2 .5 2-2a3 3 0 01-4 4L7 15.5a1.8 1.8 0 01-2.5-2.5l6.9-6.5z" strokeLinejoin="round" /></CapIcon> tools</span>
        <span className="flex items-center gap-1.5"><CapIcon on title="Web search"><circle cx="10" cy="10" r="6.5" /></CapIcon> web search</span>
        <span className="flex items-center gap-1.5"><CapIcon on title="Streaming"><path d="M4.5 10.5a7.5 7.5 0 0111 0" strokeLinecap="round" /></CapIcon> streaming</span>
        <span className="text-neutral-700">·</span>
        <span>dimmed icon = not supported</span>
      </div>
    </div>
  );
}
