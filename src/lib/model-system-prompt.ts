// Admin-configurable per-model system prompt. Stored as a single JSON
// blob in Cloudflare KV (raw key, not the array/list config store) so it
// survives isolate cold starts just like model-stats.ts.
import { kvGetRaw, kvSetRaw } from './config-store';

const KV_KEY = 'model_system_prompts';
const CACHE_TTL_MS = 15 * 1000;

type PromptMap = Record<string, string>;

const globalForPrompts = globalThis as unknown as {
  __modelSystemPrompts?: { at: number; value: PromptMap };
};

async function loadMap(): Promise<PromptMap> {
  const cached = globalForPrompts.__modelSystemPrompts;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  let value: PromptMap = {};
  try {
    const raw = await kvGetRaw(KV_KEY);
    if (raw) value = JSON.parse(raw) as PromptMap;
  } catch {
    value = {};
  }
  globalForPrompts.__modelSystemPrompts = { at: Date.now(), value };
  return value;
}

export async function getModelSystemPrompts(): Promise<PromptMap> {
  return loadMap();
}

export async function setModelSystemPrompt(id: string, prompt: string): Promise<boolean> {
  const map = { ...(await loadMap()) };
  const trimmed = prompt.trim();
  if (trimmed) {
    map[id] = trimmed;
  } else {
    delete map[id];
  }
  const ok = await kvSetRaw(KV_KEY, JSON.stringify(map));
  if (ok) globalForPrompts.__modelSystemPrompts = { at: Date.now(), value: map };
  return ok;
}

// Prepends (or merges into an existing system message) the admin-configured
// prompt for this model, if any. No-op when nothing is configured.
export async function applyModelSystemPrompt(
  body: Record<string, unknown>,
  publicModelId: string,
): Promise<Record<string, unknown>> {
  const map = await loadMap();
  const prompt = map[publicModelId];
  if (!prompt) return body;

  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  if (!messages || !Array.isArray(messages)) return body;

  const out = messages.map((m) => ({ ...m }));
  const firstSysIdx = out.findIndex((m) => m.role === 'system');
  if (firstSysIdx >= 0) {
    const existing = typeof out[firstSysIdx].content === 'string' ? out[firstSysIdx].content : '';
    out[firstSysIdx] = { ...out[firstSysIdx], content: `${prompt}\n\n${existing}`.trim() };
  } else {
    out.unshift({ role: 'system', content: prompt });
  }
  return { ...body, messages: out };
}
