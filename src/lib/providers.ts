import type { ModelKind } from './types';
import { withV1Prefix } from './upstream';

export type CatalogEntry =
  | {
      id: string;
      type: ModelKind;
      description: string;
      provider: string;
      kind: 'openai';
      baseUrl: string;
      apiKey: string;
      upstreamModel: string;
    }
  | {
      id: string;
      type: ModelKind;
      description: string;
      provider: string;
      kind: 'horde';
      upstreamModel: string;
    };

export interface Catalog {
  models: CatalogEntry[];
  byId: Map<string, CatalogEntry>;
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
  return 'Chat model';
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
      'gpt-4o-mini-2024-07-18',
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

const HORDE_TEXT_DEFAULTS = [
  'koboldcpp/KoboldCpp/StableBeluga7B',
  'aphrodite/Sao10K/Llama-3.1-8B-Lexi-Uncensored-V2',
];

const HORDE_IMAGE_DEFAULTS = ['Deliberate', 'DreamShaper'];

const globalForCatalog = globalThis as unknown as { nrCatalog?: Catalog };

export function getCatalog(): Catalog {
  if (globalForCatalog.nrCatalog) return globalForCatalog.nrCatalog;
  const byId = new Map<string, CatalogEntry>();
  const add = (entry: CatalogEntry) => {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  };

  for (const slot of GATEWAYS) {
    const baseUrl = (process.env[slot.baseUrlEnv] || slot.defaultBaseUrl || '').trim();
    if (!baseUrl) continue;
    const apiKey = process.env[slot.apiKeyEnv] ?? '';
    const ids = listFromEnv(slot.modelsEnv);
    const models = ids.length > 0 ? ids : slot.defaults;
    for (const upstreamModel of models) {
      add({
        id: upstreamModel,
        type: 'text',
        description: describeModel(upstreamModel),
        provider: slot.provider,
        kind: 'openai',
        baseUrl: withV1Prefix(baseUrl),
        apiKey,
        upstreamModel,
      });
    }
  }

  const hordeKey = process.env.AI_HORDE_API_KEY;
  if (hordeKey) {
    const textIds = listFromEnv('AI_HORDE_TEXT_MODELS');
    const textModels = textIds.length > 0 ? textIds : HORDE_TEXT_DEFAULTS;
    for (const upstreamModel of textModels) {
      add({
        id: upstreamModel,
        type: 'text',
        description: 'Crowdsourced community text model',
        provider: 'horde',
        kind: 'horde',
        upstreamModel,
      });
    }
    const imageIds = listFromEnv('AI_HORDE_IMAGE_MODELS');
    const imageModels = imageIds.length > 0 ? imageIds : HORDE_IMAGE_DEFAULTS;
    for (const upstreamModel of imageModels) {
      add({
        id: upstreamModel,
        type: 'image',
        description: 'Crowdsourced community image model',
        provider: 'horde',
        kind: 'horde',
        upstreamModel,
      });
    }
  }

  const catalog: Catalog = { models: [...byId.values()], byId };
  globalForCatalog.nrCatalog = catalog;
  return catalog;
}

export function getCatalogModel(id: string): CatalogEntry | null {
  return getCatalog().byId.get(id) ?? null;
}

export function getFallbackModelId(): string | null {
  return getCatalog().models.find((entry) => entry.type === 'text')?.id ?? null;
}