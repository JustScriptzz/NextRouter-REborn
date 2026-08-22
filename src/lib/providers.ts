import type { ModelKind } from './types';
import { withV1Prefix } from './upstream';

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
}

interface LiveModelInfo {
  id: string;
  endpoints: string[];
  displayName: string | null;
  owner: string | null;
  modelType: string | null;
  tier: string | null;
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
  defaults: string[];
  excludeOwners?: string[];
  excludeTiers?: string[];
  excludeSubstrings?: string[];
}

const GATEWAYS: GatewaySlot[] = [
  {
    provider: 'logfare',
    baseUrlEnv: 'LOGFARE_BASE_URL',
    apiKeyEnv: 'LOGFARE_API_KEY',
    modelsEnv: 'LOGFARE_MODELS',
    defaultBaseUrl: '',
    defaults: [
      'gpt-4o-mini',
      'gpt-4.1-mini',
      'claude-3-5-haiku-latest',
      'llama-3.1-8b-instruct',
      'mistral-small-3.1-24b-instruct-2503',
      'deepseek-v3',
      'gemini-2.0-flash',
    ],
  },
  {
    provider: 'scriptzz',
    baseUrlEnv: 'SCRIPTZZ_BASE_URL',
    apiKeyEnv: 'SCRIPTZZ_API_KEY',
    modelsEnv: 'SCRIPTZZ_MODELS',
    defaultBaseUrl: '',
    defaults: [
      'gpt-4o-mini',
      'llama-3.1-8b-instruct',
      'qwen2.5-7b-instruct',
      'gemini-1.5-flash',
    ],
    excludeOwners: ['moonshot', 'deepseek'],
  },
  {
    provider: 'cogito',
    baseUrlEnv: 'COGITO_BASE_URL',
    apiKeyEnv: 'COGITO_API_KEY',
    modelsEnv: 'COGITO_MODELS',
    defaultBaseUrl: '',
    defaults: ['cogito-v1-preview'],
  },
  {
    provider: 'jankrouter',
    baseUrlEnv: 'JANKROUTER_BASE_URL',
    apiKeyEnv: 'JANKROUTER_API_KEY',
    modelsEnv: 'JANKROUTER_MODELS',
    defaultBaseUrl: 'https://jankrouter.waifly.com/',
    defaults: [],
    excludeSubstrings: ['-pro'],
  },
  {
    provider: 'aquadevs',
    baseUrlEnv: 'AQUADEVS_BASE_URL',
    apiKeyEnv: 'AQUADEVS_API_KEY',
    modelsEnv: 'AQUADEVS_MODELS',
    defaultBaseUrl: '',
    defaults: [
      'gpt-4o-mini',
      'llama-3.1-8b-instruct',
      'mistral-7b-instruct',
      'gemini-2.0-flash',
      'claude-3-haiku-20240307',
      'deepseek-chat',
      'qwen2.5-7b-instruct',
    ],
    excludeTiers: ['premium'],
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
const LIVE_MODELS_TIMEOUT_MS = 8000;
const LIVE_MODELS_MAX = 500;

const globalForCatalog = globalThis as unknown as {
  gatewayModels?: Record<string, { at: number; models: LiveModelInfo[] | null }>;
};

async function liveGatewayModels(slot: GatewaySlot): Promise<LiveModelInfo[] | null> {
  const baseUrl = cleanEnvValue(process.env[slot.baseUrlEnv] || slot.defaultBaseUrl || '');
  if (!baseUrl) return null;
  const apiKey = cleanEnvValue(process.env[slot.apiKeyEnv] ?? '');
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
  gatewayModels[cacheKey] = { at: now, models };
  return models;
}

export async function getCatalog(): Promise<Catalog> {
  const byId = new Map<string, CatalogEntry>();
  const add = (entry: CatalogEntry) => {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  };

  for (const slot of GATEWAYS) {
    const baseUrl = cleanEnvValue(process.env[slot.baseUrlEnv] || slot.defaultBaseUrl || '');
    if (!baseUrl) continue;
    const apiKey = cleanEnvValue(process.env[slot.apiKeyEnv] ?? '');
    const live = await liveGatewayModels(slot);

    if (live && live.length > 0) {
      for (const info of live) {
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

    const envIds = listFromEnv(slot.modelsEnv);
    const models = envIds.length > 0 ? envIds : slot.defaults;
    for (const upstreamModel of models) {
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

  const catalog: Catalog = { models: [...byId.values()], byId };
  return catalog;
}

export async function getCatalogModel(id: string): Promise<CatalogEntry | null> {
  const catalog = await getCatalog();
  return catalog.byId.get(id) ?? null;
}

export async function getFallbackModelId(): Promise<string | null> {
  const catalog = await getCatalog();
  return catalog.models.find((entry) => entry.type === 'text')?.id ?? null;
}
