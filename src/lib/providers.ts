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
}

function listFromEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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
  if (/(flux|sdxl|stable-diffusion|dall-?e|midjourney|imagen|dreamshaper|phoenix|lucid)/.test(lower)) {
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
  return null;
}

function resolveLiveType(info: LiveModelInfo): ModelKind | null {
  if (info.endpoints.length > 0) {
    return classifyFromEndpoints(info.endpoints);
  }
  const guessed = classifyModel(info.id);
  return guessed === 'text' || guessed === 'image' ? guessed : null;
}

interface GatewaySlot {
  provider: string;
  baseUrlEnv: string;
  apiKeyEnv: string;
  modelsEnv: string;
  defaultBaseUrl: string;
  defaults: string[];
}

const GATEWAYS: GatewaySlot[] = [
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
  },
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
  },
  {
    provider: 'cogito',
    baseUrlEnv: 'COGITO_BASE_URL',
    apiKeyEnv: 'COGITO_API_KEY',
    modelsEnv: 'COGITO_MODELS',
    defaultBaseUrl: '',
    defaults: ['cogito-v1-preview'],
  },
];

const LIVE_MODELS_TTL_MS = 2 * 60 * 1000;
const LIVE_MODELS_TIMEOUT_MS = 8000;
const LIVE_MODELS_MAX = 500;

const globalForCatalog = globalThis as unknown as {
  gatewayModels?: Record<string, { at: number; models: LiveModelInfo[] | null }>;
};

async function liveGatewayModels(slot: GatewaySlot): Promise<LiveModelInfo[] | null> {
  const baseUrl = (process.env[slot.baseUrlEnv] || slot.defaultBaseUrl || '').trim();
  if (!baseUrl) return null;
  const apiKey = process.env[slot.apiKeyEnv] ?? '';
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
          collected.push({ id, endpoints, displayName });
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
    const baseUrl = (process.env[slot.baseUrlEnv] || slot.defaultBaseUrl || '').trim();
    if (!baseUrl) continue;
    const apiKey = process.env[slot.apiKeyEnv] ?? '';
    const live = await liveGatewayModels(slot);

    if (live && live.length > 0) {
      for (const info of live) {
        const type = resolveLiveType(info);
        if (type !== 'text' && type !== 'image') continue;
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
      if (kind !== 'text' && kind !== 'image') continue;
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
