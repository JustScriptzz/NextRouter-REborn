import type { ModelKind } from './types';

export const VALID_INPUT_TYPES: ReadonlyArray<ModelKind> = [
  'text',
  'image',
  'tts',
  'stt',
  'video',
];

export const VALID_VISIBILITY = ['private', 'public'] as const;
export type Visibility = (typeof VALID_VISIBILITY)[number];

export function isValidModelName(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(name);
}

export function isValidModelId(modelId: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,31}\/[a-z0-9][a-z0-9_-]{0,63}$/.test(modelId);
}

export function isValidInputTypes(raw: unknown): raw is ModelKind[] {
  return (
    Array.isArray(raw) &&
    raw.length > 0 &&
    raw.every((item) => VALID_INPUT_TYPES.includes(item as ModelKind))
  );
}

export function normalizeEndpointUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return trimmed.replace(/\/+$/, '');
}

export interface CreateCustomModelPayload {
  modelName: string;
  title: string;
  description: string;
  acceptedInputs: ModelKind[];
  visibility: Visibility;
  rpm: number | null;
  endpointUrl: string;
  providerModelId: string;
  bearerToken: string;
  fallbackModelId: string;
}

export function validateCustomModelPayload(raw: unknown): {
  ok: true;
  payload: CreateCustomModelPayload;
} | { ok: false; message: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'Invalid request body' };
  }
  const b = raw as Record<string, unknown>;

  const modelName = typeof b.modelName === 'string' ? b.modelName.trim() : '';
  if (!isValidModelName(modelName)) {
    return {
      ok: false,
      message: 'Model name must be 1-64 chars: lowercase letters, numbers, _ or -',
    };
  }

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title || title.length > 128) {
    return { ok: false, message: 'Title is required (max 128 chars)' };
  }

  const description = typeof b.description === 'string' ? b.description.slice(0, 2000) : '';

  if (!isValidInputTypes(b.acceptedInputs)) {
    return { ok: false, message: 'Select at least one accepted input type' };
  }

  const visibility = b.visibility;
  if (visibility !== 'private' && visibility !== 'public') {
    return { ok: false, message: 'Visibility must be private or public' };
  }

  let rpm: number | null = null;
  if (b.rpm !== null && b.rpm !== undefined && b.rpm !== '') {
    const parsed = Number(b.rpm);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 600) {
      return { ok: false, message: 'Per-user RPM must be a whole number between 1 and 600' };
    }
    rpm = parsed;
  }

  const endpointUrl = normalizeEndpointUrl(b.endpointUrl);
  if (!endpointUrl) {
    return { ok: false, message: 'Endpoint URL must be a valid http(s) URL' };
  }

  const providerModelId = typeof b.providerModelId === 'string' ? b.providerModelId.trim() : '';
  if (!providerModelId || providerModelId.length > 255) {
    return { ok: false, message: 'Provider model ID is required (max 255 chars)' };
  }

  const bearerToken = typeof b.bearerToken === 'string' ? b.bearerToken : '';

  const fallbackModelId = typeof b.fallbackModelId === 'string' ? b.fallbackModelId.trim() : '';
  if (!fallbackModelId || fallbackModelId.length > 128) {
    return { ok: false, message: 'A fallback model is required' };
  }

  return {
    ok: true,
    payload: {
      modelName,
      title,
      description,
      acceptedInputs: b.acceptedInputs,
      visibility,
      rpm,
      endpointUrl,
      providerModelId,
      bearerToken,
      fallbackModelId,
    },
  };
}