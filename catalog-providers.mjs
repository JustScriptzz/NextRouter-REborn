import fs from 'node:fs';

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) process.env[line.slice(0, i)] = line.slice(i + 1);
}

const env = (k) => (process.env[k] || '').trim();

const GATEWAYS = [
  { provider: 'logfare', base: env('LOGFARE_BASE_URL').startsWith('http') ? env('LOGFARE_BASE_URL') : 'https://logfare.ai/v1', key: env('LOGFARE_API_KEY').startsWith('lfu_') ? env('LOGFARE_API_KEY') : 'lfu_oHiVtyH5xwE4OIwyt14x0bLryL0ICzes' },
  { provider: 'scriptzz', base: env('SCRIPTZZ_BASE_URL') || 'https://scriptzz.duckdns.org', key: env('SCRIPTZZ_API_KEY'), excludeOwners: ['moonshot', 'deepseek'] },
  { provider: 'cogito', base: env('COGITO_BASE_URL') || 'https://opencode.ai/zen', key: env('COGITO_API_KEY'), disableLive: true, staticModels: ['x-preview-f-free'] },
  { provider: 'jankrouter', base: env('JANKROUTER_BASE_URL') || 'https://jankrouter.waifly.com/', key: env('JANKROUTER_API_KEY') },
  { provider: 'aquadevs', base: env('AQUADEVS_BASE_URL'), key: env('AQUADEVS_API_KEY'), excludeTiers: ['premium'] },
  { provider: 'ollama', base: env('OLLAMA_BASE_URL') || 'https://ollama.com', key: env('OLLAMA_API_KEY') },
].filter((g) => Boolean(g.base));

const withV1Prefix = (raw) => {
  let t = raw.trim().replace(/\/+$/, '');
  const m = t.match(/\/v(\d+)$/);
  if (m) return t;
  const suffixes = ['/chat/completions', '/images/generations', '/images/edits', '/audio/speech', '/audio/transcriptions', '/embeddings', '/models'];
  for (const s of suffixes) {
    if (t.endsWith(s)) return t.slice(0, -s.length);
  }
  return `${t}/v1`;
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES = new Map([['os-alpha', 'x-preview-f-free'], ['os_alpha', 'x-preview-f-free'], ['gemini-3-flash', 'gemini-3.6']]);
const resolveAlias = (id) => ALIASES.get(id.toLowerCase()) ?? id;

async function fetchModels(g) {
  const url = `${withV1Prefix(g.base)}/models`;
  try {
    const res = await fetch(url, {
      headers: g.key ? { Authorization: `Bearer ${g.key}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { entries: [], error: `HTTP ${res.status}` };
    const body = await res.json();
    const data = Array.isArray(body?.data) ? body.data : [];
    const entries = data
      .filter((e) => typeof e?.id === 'string' && e.id)
      .map((e) => ({
        id: e.id,
        owner: typeof e?.owned_by === 'string' ? e.owned_by : null,
        tier: typeof e?.tier === 'string' ? e.tier : null,
      }));
    return { entries, error: null };
  } catch (e) {
    return { entries: [], error: String(e).slice(0, 80) };
  }
}

const byId = new Map();
const normalizedIds = new Map();
const providersMap = new Map();

const addEntry = (entry) => {
  const normalized = entry.id.replace(/-/g, '');
  const ownerId = byId.has(entry.id) ? entry.id : normalizedIds.get(normalized);
  if (!ownerId) {
    byId.set(entry.id, entry);
    normalizedIds.set(normalized, entry.id);
    providersMap.set(entry.id, [entry]);
    return true;
  }
  const existing = byId.get(ownerId);
  if (!existing || existing.type !== entry.type) return false;
  if (ownerId !== entry.id) entry = { ...entry, id: ownerId };
  const list = providersMap.get(ownerId) ?? [existing];
  if (list.some((e) => e.provider === entry.provider && e.upstreamModel === entry.upstreamModel)) {
    return false;
  }
  list.push(entry);
  providersMap.set(ownerId, list);
  return true;
};

for (const g of GATEWAYS) {
  if (g.disableLive) {
    for (const id of g.staticModels ?? []) {
      addEntry({ id, provider: g.provider });
    }
    console.log(`[${g.provider}] static ${g.staticModels.length} models`);
    continue;
  }
  const { entries, error } = await fetchModels(g);
  if (error) {
    console.log(`[${g.provider}] FAILED: ${error}`);
    continue;
  }
  let added = 0;
  let mergedAlias = 0;
  for (const info of entries) {
    if (g.excludeOwners && info.owner && g.excludeOwners.includes(info.owner.toLowerCase())) continue;
    if (g.excludeTiers && info.tier && g.excludeTiers.includes(info.tier.toLowerCase())) continue;
    if (g.onlyIfContains && !g.onlyIfContains.some((s) => info.id.toLowerCase().includes(s.toLowerCase()))) continue;

    const canonicalId = resolveAlias(info.id);
    if (canonicalId !== info.id && byId.has(canonicalId)) {
      const list = providersMap.get(canonicalId) ?? [];
      if (!list.some((e) => e.provider === g.provider)) {
        list.push({ id: canonicalId, provider: g.provider, upstreamModel: info.id });
        providersMap.set(canonicalId, list);
        mergedAlias++;
      }
      continue;
    }
    if (addEntry({ id: info.id, provider: g.provider })) added++;
  }
  console.log(`[${g.provider}] ${entries.length} live -> ${added} new ids, ${mergedAlias} alias-merged pipes`);
}

const singles = [];
let totalPipes = 0;
for (const [id, list] of providersMap) {
  totalPipes += list.length;
  const providers = [...new Set(list.map((e) => e.provider))];
  if (providers.length === 1) singles.push({ id, provider: providers[0] });
}
console.log('\n=== SUMMARY ===');
console.log(`unique model ids: ${providersMap.size}, total provider pipes: ${totalPipes}, single-provider ids: ${singles.length}`);

const byProvider = {};
for (const s of singles) (byProvider[s.provider] ??= []).push(s.id);
for (const p of Object.keys(byProvider).sort()) {
  console.log(`\n--- single-provider via ${p} (${byProvider[p].length}) ---`);
  for (const id of byProvider[p]) console.log(`  ${id}`);
}
