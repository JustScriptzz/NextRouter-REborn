import type { ModelKind } from './types';
import { withV1Prefix } from './upstream';
import { kvGetCached } from './kv';

export interface CatalogEntry {
  id: string;
  type: ModelKind;
  description: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  upstreamModel: string;
  supportsImageEdits: boolean;
}

export interface Catalog {
  models: CatalogEntry[];
  byId: Map<string, CatalogEntry>;
  providersMap?: Map<string, CatalogEntry[]>;
}

interface LiveModelInfo {
  id: string;
  endpoints: string[];
  displayName: string | null;
  owner: string | null;
  modelType: string | null;
  tier: string | null;
}

const MODEL_ALIASES = new Map<string, string>([
  ['os-alpha', 'x-preview-f-free'],
  ['os_alpha', 'x-preview-f-free'],
]);

function resolveAlias(id: string): string {
  const lower = id.toLowerCase();
  return MODEL_ALIASES.get(lower) ?? id;
}

const ALL_KINDS: ModelKind[] = ['text', 'image', 'tts', 'stt', 'video', 'embedding'];

function listFromEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function cleanEnvValue(value: string): string {
  let out = value.trim();
  if (
    out.length >= 2 &&
    ((out.startsWith('"') && out.endsWith('"')) ||
      (out.startsWith("'") && out.endsWith("'")))
  ) {
    out = out.slice(1, -1).trim();
  }
  return out.replace(new RegExp('\\s+', 'g'), '');
}

function describeModel(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes('cogito')) return 'Reasoning-optimized chat model';
  if (lower.includes('gpt')) return 'High-performance chat model';
  if (lower.includes('claude')) return 'Advanced reasoning chat model';
  if (lower.includes('gemini')) return 'Multimodal-capable chat model';
  if (lower.includes('llama')) return 'Open-weight chat model';
  if (lower.includes('mistral')) return 'Efficient open-weight chat model';
  if (lower.includes('deepseek')) return 'Strong reasoning chat model';
  if (lower.includes('qwen')) return 'Open-weights chat model';
  if (lower.includes('flux') || lower.includes('sdxl')) return 'Image generation model';
  return 'Chat model';
}

function classifyModel(id: string): ModelKind {
  const lower = id.toLowerCase();
  if (/(text-embedding|embedding|e5-|bge-|minilm|rerank|ada-002)/.test(lower)) {
    return 'embedding';
  }
  if (/(flux|sdxl|stable-diffusion|dall-?e|midjourney|imagen|dreamshaper|phoenix|lucid|meta-image)/.test(lower)) {
    return 'image';
  }
  if (/(whisper|transcri|speech-to-text|stt|recogni|nova-3)/.test(lower)) {
    return 'stt';
  }
  if (/(tts|text-to-speech|eleven|aura|kokoro|xtts)/.test(lower)) {
    return 'tts';
  }
  if (/^(sora|veo|kling|wan)/.test(lower)) {
    return 'video';
  }
  return 'text';
}

function classifyFromEndpoints(endpoints: string[]): ModelKind | null {
  if (endpoints.includes('chat/completions')) return 'text';
  if (endpoints.some((e) => e.startsWith('images/'))) return 'image';
  if (endpoints.includes('audio/speech')) return 'tts';
  if (endpoints.includes('audio/transcriptions')) return 'stt';
  if (endpoints.some((e) => e.startsWith('embeddings'))) return 'embedding';
  return null;
}

function resolveLiveType(info: LiveModelInfo): ModelKind | null {
  if (info.modelType) {
    const lower = info.modelType.toLowerCase();
    if (ALL_KINDS.includes(lower as ModelKind)) return lower as ModelKind;
    if (lower !== 'audio') return null;
  }
  if (info.endpoints.length > 0) {
    return classifyFromEndpoints(info.endpoints);
  }
  return classifyModel(info.id);
}

interface GatewaySlot {
  provider: string;
  baseUrlEnv: string;
  apiKeyEnv: string;
  modelsEnv: string;
  defaultBaseUrl: string;
  disableLive?: boolean;
  staticModels?: string[];
  excludeOwners?: string[];
  excludeTiers?: string[];
  excludeSubstrings?: string[];
  matchExistingOnly?: boolean;
}

const GATEWAYS: GatewaySlot[] = [
  {
    provider: 'logfare',
    baseUrlEnv: 'LOGFARE_BASE_URL',
    apiKeyEnv: 'LOGFARE_API_KEY',
    modelsEnv: 'LOGFARE_MODELS',
    defaultBaseUrl: '',
  },
  {
    provider: 'scriptzz',
    baseUrlEnv: 'SCRIPTZZ_BASE_URL',
    apiKeyEnv: 'SCRIPTZZ_API_KEY',
    modelsEnv: 'SCRIPTZZ_MODELS',
    defaultBaseUrl: '',
    excludeOwners: ['moonshot', 'deepseek'],
  },
  {
    provider: 'cogito',
    baseUrlEnv: 'COGITO_BASE_URL',
    apiKeyEnv: 'COGITO_API_KEY',
    modelsEnv: 'COGITO_MODELS',
    defaultBaseUrl: '',
    disableLive: true,
    staticModels: ['x-preview-f-free'],
  },
  {
    provider: 'jankrouter',
    baseUrlEnv: 'JANKROUTER_BASE_URL',
    apiKeyEnv: 'JANKROUTER_API_KEY',
    modelsEnv: 'JANKROUTER_MODELS',
    defaultBaseUrl: 'https://jankrouter.waifly.com/',
  },
  {
    provider: 'aquadevs',
    baseUrlEnv: 'AQUADEVS_BASE_URL',
    apiKeyEnv: 'AQUADEVS_API_KEY',
    modelsEnv: 'AQUADEVS_MODELS',
    defaultBaseUrl: '',
    excludeTiers: ['premium'],
  },
  {
    provider: 'ollamafree',
    baseUrlEnv: 'OLLAMAFREE_BASE_URL',
    apiKeyEnv: 'OLLAMAFREE_API_KEY',
    modelsEnv: 'OLLAMAFREE_MODELS',
    defaultBaseUrl: '',
    matchExistingOnly: true,
  },
];

function isExcludedOwner(slot: GatewaySlot, info: LiveModelInfo): boolean {
  if (!slot.excludeOwners || slot.excludeOwners.length === 0) return false;
  if (!info.owner) return false;
  const owner = info.owner.toLowerCase();
  return slot.excludeOwners.some((o) => o.toLowerCase() === owner);
}

function isExcludedTier(slot: GatewaySlot, info: LiveModelInfo): boolean {
  if (!slot.excludeTiers || slot.excludeTiers.length === 0) return false;
  if (!info.tier) return false;
  const tier = info.tier.toLowerCase();
  return slot.excludeTiers.some((t) => t.toLowerCase() === tier);
}

function isExcludedSubstring(slot: GatewaySlot, info: LiveModelInfo): boolean {
  if (!slot.excludeSubstrings || slot.excludeSubstrings.length === 0) return false;
  const id = info.id.toLowerCase();
  return slot.excludeSubstrings.some((s) => id.includes(s.toLowerCase()));
}

const LIVE_MODELS_TTL_MS = 2 * 60 * 1000;
const LIVE_MODELS_TIMEOUT_MS = 15000;
const LIVE_MODELS_MAX = 500;

const globalForCatalog = globalThis as unknown as {
  gatewayModels?: Record<string, { at: number; models: LiveModelInfo[] | null }>;
  lastGoodGatewayModels?: Record<string, { at: number; models: LiveModelInfo[] }>;
};

async function liveGatewayModels(
  slot: GatewaySlot,
  overrides?: { baseUrl?: string; apiKey?: string },
): Promise<LiveModelInfo[] | null> {
  const baseUrl =
    overrides?.baseUrl ??
    cleanEnvValue(process.env[slot.baseUrlEnv] || slot.defaultBaseUrl || '');
  if (!baseUrl) return null;
  const apiKey = overrides?.apiKey ?? cleanEnvValue(process.env[slot.apiKeyEnv] ?? '');
  const cacheKey = `${slot.provider}::${baseUrl}`;
  const cache = globalForCatalog.gatewayModels?.[cacheKey];
  const now = Date.now();
  if (cache && now - cache.at < LIVE_MODELS_TTL_MS) return cache.models;

  let models: LiveModelInfo[] | null = null;
  try {
    const url = `${withV1Prefix(baseUrl)}/models`;
    const res = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(LIVE_MODELS_TIMEOUT_MS),
    });
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { data?: Array<Record<string, unknown>> }
        | null;
      if (body && Array.isArray(body.data)) {
        const collected: LiveModelInfo[] = [];
        for (const entry of body.data) {
          const id = typeof entry?.id === 'string' ? entry.id : '';
          if (!id) continue;
          const rawEndpoints = Array.isArray(entry.endpoints) ? entry.endpoints : [];
          const endpoints = rawEndpoints.filter(
            (e): e is string => typeof e === 'string' && e.length > 0,
          );
          let displayName: string | null = null;
          if (typeof entry.display_name === 'string' && entry.display_name) {
            displayName = entry.display_name;
          } else if (typeof entry.name === 'string' && entry.name) {
            displayName = entry.name;
          }
          const owner =
            typeof entry.owned_by === 'string' && entry.owned_by ? entry.owned_by : null;
          const modelType =
            typeof entry.type === 'string' && entry.type ? entry.type : null;
          const tier = typeof entry.tier === 'string' && entry.tier ? entry.tier : null;
          collected.push({ id, endpoints, displayName, owner, modelType, tier });
        }
        if (collected.length > 0) models = collected.slice(0, LIVE_MODELS_MAX);
      }
    }
  } catch {
    models = null;
  }

  const gatewayModels = (globalForCatalog.gatewayModels ??= {});
  if (models !== null && models.length > 0) {
    const lastGood = (globalForCatalog.lastGoodGatewayModels ??= {});
    lastGood[cacheKey] = { at: now, models };
  } else {
    const lastGood = globalForCatalog.lastGoodGatewayModels?.[cacheKey];
    if (lastGood) models = lastGood.models;
  }
  gatewayModels[cacheKey] = { at: now, models };
  return models;
}

export async function getCatalog(): Promise<Catalog> {
  const byId = new Map<string, CatalogEntry>();
  const normalizedIds = new Map<string, string>();
  const providersMap = new Map<string, CatalogEntry[]>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const add = (entry: CatalogEntry) => {
    const normalized = entry.id.replace(/-/g, '');
    if (byId.has(entry.id) || normalizedIds.has(normalized)) return;
    byId.set(entry.id, entry);
    normalizedIds.set(normalized, entry.id);
    providersMap.set(entry.id, [entry]);
  };

  for (const slot of GATEWAYS) {
    const disabledProviders = await kvGetCached('disabled_providers');
    if (disabledProviders.includes(slot.provider)) continue;
    const baseUrl = cleanEnvValue(process.env[slot.baseUrlEnv] || slot.defaultBaseUrl || '');
    if (!baseUrl) continue;
    const apiKey = cleanEnvValue(process.env[slot.apiKeyEnv] ?? '');

    if (slot.disableLive) {
      for (const upstreamModel of listFromEnv(slot.modelsEnv).length
        ? listFromEnv(slot.modelsEnv)
        : slot.staticModels ?? []) {
        add({
          id: upstreamModel,
          type: classifyModel(upstreamModel),
          description: describeModel(upstreamModel),
          provider: slot.provider,
          baseUrl: withV1Prefix(baseUrl),
          apiKey,
          upstreamModel,
          supportsImageEdits: false,
        });
      }
      continue;
    }

    const live = await liveGatewayModels(slot);

    if (live && live.length > 0) {
      for (const info of live) {
        if (slot.matchExistingOnly) {
          const n = norm(info.id);
          let matched: CatalogEntry | null = null;
          for (const existing of byId.values()) {
            const e = norm(existing.id);
            if (e === n || e.startsWith(n) || n.startsWith(e)) {
              matched = existing;
              break;
            }
          }
          if (!matched) continue;
          const type = resolveLiveType(info);
          if (!type || type !== matched.type) continue;
          const alt: CatalogEntry = {
            id: matched.id,
            type,
            description: info.displayName ?? describeModel(matched.id),
            provider: slot.provider,
            baseUrl: withV1Prefix(baseUrl),
            apiKey,
            upstreamModel: info.id,
            supportsImageEdits: false,
          };
          const list = providersMap.get(matched.id) ?? [];
          list.push(alt);
          providersMap.set(matched.id, list);
          continue;
        }
        if (isExcludedOwner(slot, info)) continue;
        if (isExcludedTier(slot, info)) continue;
        if (isExcludedSubstring(slot, info)) continue;
        const type = resolveLiveType(info);
        if (!type) continue;
        add({
          id: info.id,
          type,
          description: info.displayName ?? describeModel(info.id),
          provider: slot.provider,
          baseUrl: withV1Prefix(baseUrl),
          apiKey,
          upstreamModel: info.id,
          supportsImageEdits: info.endpoints.includes('images/edits'),
        });
      }
      continue;
    }

    for (const upstreamModel of listFromEnv(slot.modelsEnv)) {
      const kind = classifyModel(upstreamModel);
      add({
        id: upstreamModel,
        type: kind,
        description: describeModel(upstreamModel),
        provider: slot.provider,
        baseUrl: withV1Prefix(baseUrl),
        apiKey,
        upstreamModel,
        supportsImageEdits: false,
      });
    }
  }

  const extraGateways = await kvGetCached('extra_gateways');
  for (const line of extraGateways) {
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 2) continue;
    const [name, gwBaseUrl, gwKey] = parts;
    const slot: GatewaySlot = {
      provider: name.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'custom',
      baseUrlEnv: '',
      apiKeyEnv: '',
      modelsEnv: '',
      defaultBaseUrl: gwBaseUrl,
    };
    const live = await liveGatewayModels(slot, { baseUrl: gwBaseUrl, apiKey: gwKey ?? '' });
    if (live && live.length > 0) {
      for (const info of live) {
        const type = resolveLiveType(info);
        if (!type) continue;
        add({
          id: info.id,
          type,
          description: info.displayName ?? describeModel(info.id),
          provider: slot.provider,
          baseUrl: withV1Prefix(gwBaseUrl),
          apiKey: gwKey ?? '',
          upstreamModel: info.id,
          supportsImageEdits: info.endpoints.includes('images/edits'),
        });
      }
    }
  }

  const rules = await kvGetCached('model_rules');
  const entries = [...byId.values()];
  for (const rule of rules) {
    const parts = rule.split('|').map((p) => p.trim());
    const cmd = parts[0]?.toLowerCase();
    if (cmd === 'add' && parts.length >= 5) {
      const id = parts[1];
      const type = ALL_KINDS.includes(parts[2] as ModelKind) ? (parts[2] as ModelKind) : 'text';
      entries.push({
        id,
        type,
        description: parts[5] ?? describeModel(id),
        provider: 'admin',
        baseUrl: withV1Prefix(parts[3]),
        apiKey: parts[6] ?? '',
        upstreamModel: parts[4] ?? id,
        supportsImageEdits: false,
      });
    } else if (cmd === 'rename' && parts.length >= 3) {
      const target = entries.find((x) => x.id === parts[1]);
      if (target) target.id = parts[2];
    } else if (cmd === 'endpoint' && parts.length >= 3) {
      const target = entries.find((x) => x.id === parts[1]);
      if (target) target.baseUrl = withV1Prefix(parts[2]);
    } else if (cmd === 'name' && parts.length >= 3) {
      const target = entries.find((x) => x.id === parts[1]);
      if (target) target.description = parts[2];
    }
  }

  const rebuiltById = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    if (!rebuiltById.has(entry.id)) rebuiltById.set(entry.id, entry);
  }
  byId.clear();
  for (const [k, v] of rebuiltById) byId.set(k, v);

  const blockedModels = await kvGetCached('blocked_models');
  const pinnedModels = await kvGetCached('pinned_models');
  let modelsOut = [...byId.values()];
  if (blockedModels.length > 0) {
    const blocked = new Set(blockedModels.map((b) => b.toLowerCase()));
    modelsOut = modelsOut.filter((m) => !blocked.has(m.id.toLowerCase()));
  }
  if (pinnedModels.length > 0) {
    const pinOrder = new Map(pinnedModels.map((id, i) => [id.toLowerCase(), i]));
    modelsOut.sort(
      (a, b) =>
        (pinOrder.get(a.id.toLowerCase()) ?? 9999) -
        (pinOrder.get(b.id.toLowerCase()) ?? 9999),
    );
  }
  const catalog: Catalog = { models: modelsOut, byId, providersMap };
  return catalog;
}

export async function getCatalogModel(id: string): Promise<CatalogEntry | null> {
  const target = resolveAlias(id);
  const catalog = await getCatalog();
  return catalog.byId.get(target) ?? catalog.byId.get(id) ?? null;
}

export async function getCatalogModelProviders(id: string): Promise<CatalogEntry[]> {
  const target = resolveAlias(id);
  const catalog = await getCatalog();
  const viaMap = catalog.providersMap?.get(target) ?? catalog.providersMap?.get(id);
  if (viaMap && viaMap.length > 0) return viaMap;
  return catalog.models.filter((m) => m.id === target || m.id === id);
}

export async function getFallbackModelId(): Promise<string | null> {
  const catalog = await getCatalog();
  return catalog.models.find((entry) => entry.type === 'text')?.id ?? null;
}

export function clearGatewayCaches(): void {
  globalForCatalog.gatewayModels = {};
}

export interface GatewayHealth {
  provider: string;
  configured: boolean;
  baseUrl: string;
  cachedModels: number | null;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
}

export function getGatewaysHealth(): GatewayHealth[] {
  return GATEWAYS.map((slot) => {
    const baseUrl = cleanEnvValue(process.env[slot.baseUrlEnv] || slot.defaultBaseUrl || '');
    const fresh = globalForCatalog.gatewayModels?.[`${slot.provider}::${baseUrl}`] ?? null;
    const lastGood =
      globalForCatalog.lastGoodGatewayModels?.[`${slot.provider}::${baseUrl}`] ?? null;
    return {
      provider: slot.provider,
      configured: baseUrl.length > 0,
      baseUrl,
      cachedModels: fresh?.models ? fresh.models.length : null,
      lastSuccessAt: lastGood?.at ?? null,
      lastAttemptAt: fresh?.at ?? null,
    };
  });
}
