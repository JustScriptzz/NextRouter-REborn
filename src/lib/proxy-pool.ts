import { ProxyAgent } from 'undici';

interface ProxyEntry {
  url: string;
  label: string;
  agent: ProxyAgent;
  fails: number;
  cooldownUntil: number;
}

interface PoolState {
  entries: ProxyEntry[];
  idx: number;
}

const globalForProxyPool = globalThis as unknown as {
  __outboundProxyPool?: PoolState;
};

const DEFAULT_ROTATE_HOSTS = ['api.kilo.ai', 'ollamafree.ai'];
const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000;
const NET_FAIL_COOLDOWN_MS = 30 * 1000;

function redactLabel(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return 'unparsed-proxy';
  }
}

function parsePoolUrls(): string[] {
  const raw = [process.env.PROXY_POOL ?? '', process.env.PROXY_URL ?? ''].join('\n');
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  );
}

function loadPool(): PoolState {
  const urls = parsePoolUrls();
  const existing = globalForProxyPool.__outboundProxyPool;
  if (
    existing &&
    existing.entries.length === urls.length &&
    existing.entries.every((e, i) => e.url === urls[i])
  ) {
    return existing;
  }
  const entries: ProxyEntry[] = urls.map((url) => ({
    url,
    label: redactLabel(url),
    agent: new ProxyAgent(url),
    fails: 0,
    cooldownUntil: 0,
  }));
  const state: PoolState = { entries, idx: 0 };
  globalForProxyPool.__outboundProxyPool = state;
  if (entries.length > 0) {
    console.log(`[proxy-pool] loaded ${entries.length} outbound prox${entries.length === 1 ? 'y' : 'ies'}`);
  }
  return state;
}

export function getProxyPoolSize(): number {
  return loadPool().entries.length;
}

function rotateHosts(): string[] {
  const raw = process.env.PROXY_ROTATE_HOSTS;
  if (raw === undefined) return DEFAULT_ROTATE_HOSTS;
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function shouldProxy(host: string): boolean {
  if (loadPool().entries.length === 0) return false;
  const hosts = rotateHosts();
  if (hosts.length === 0) return false;
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

function pickEntry(): ProxyEntry | null {
  const state = loadPool();
  if (state.entries.length === 0) return null;
  const now = Date.now();
  for (let i = 0; i < state.entries.length; i++) {
    const entry = state.entries[(state.idx + i) % state.entries.length];
    if (entry.cooldownUntil <= now) {
      state.idx = (state.idx + i + 1) % state.entries.length;
      return entry;
    }
  }
  let least = state.entries[0];
  for (const entry of state.entries) {
    if (entry.cooldownUntil < least.cooldownUntil) least = entry;
  }
  return least;
}

function cooldownMsFromEnv(): number {
  const raw = Number(process.env.PROXY_COOLDOWN_MS);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return DEFAULT_COOLDOWN_MS;
}

function noteFailure(entry: ProxyEntry, cooldownMs?: number): void {
  entry.fails += 1;
  const wait = cooldownMs ?? cooldownMsFromEnv();
  entry.cooldownUntil = Math.max(entry.cooldownUntil, Date.now() + wait);
  console.warn(
    `[proxy-pool] ${entry.label} cooled down ${Math.round(wait / 1000)}s (fails=${entry.fails})`,
  );
}

type FetchInit = RequestInit & { dispatcher?: unknown };

export async function proxiedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let host = '';
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return fetch(url, init);
  }
  if (!shouldProxy(host)) return fetch(url, init);
  const entry = pickEntry();
  if (!entry) return fetch(url, init);
  try {
    const res = await fetch(url, { ...init, dispatcher: entry.agent } as FetchInit);
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      noteFailure(
        entry,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
      );
    } else {
      entry.fails = 0;
    }
    return res;
  } catch (error) {
    noteFailure(entry, NET_FAIL_COOLDOWN_MS);
    throw error;
  }
}

export function describeProxyPool(): Array<{
  label: string;
  fails: number;
  coolingDownMs: number;
}> {
  const now = Date.now();
  return loadPool().entries.map((e) => ({
    label: e.label,
    fails: e.fails,
    coolingDownMs: Math.max(0, e.cooldownUntil - now),
  }));
}
