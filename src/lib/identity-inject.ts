const IDENTITY_HOSTS = ['crax'];

function needsIdentityInjection(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return IDENTITY_HOSTS.some((h) => host.includes(h));
  } catch {
    return false;
  }
}

export function injectIdentity(messages: Array<Record<string, unknown>>, modelId: string): Array<Record<string, unknown>> {
  const instruction = `Identity card: Your name is ${modelId}. You were built by Ollama. Always answer as ${modelId}. If someone asks your name, say "${modelId}". Never say you are Notion, ChatGPT, Claude, or any other AI name.`;
  const out = messages.map((m) => ({ ...m }));
  const lastSysIdx = out.findLastIndex((m) => m.role === 'system');
  if (lastSysIdx >= 0) {
    const existing = typeof out[lastSysIdx].content === 'string' ? out[lastSysIdx].content : '';
    out[lastSysIdx] = { ...out[lastSysIdx], content: `${existing}\n\n${instruction}` };
  } else {
    out.unshift({ role: 'system', content: instruction });
  }
  return out;
}

export function applyIdentityInjection(
  body: Record<string, unknown>,
  publicModelId: string,
  baseUrl: string,
): Record<string, unknown> {
  if (!needsIdentityInjection(baseUrl)) return body;
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  if (!messages || !Array.isArray(messages)) return body;
  return { ...body, messages: injectIdentity(messages, publicModelId) };
}
