const DEFAULT_QUARANTINE_MS = 6 * 60 * 60 * 1000;

interface QuarantineState {
  until: number;
}

const globalForPipeHealth = globalThis as unknown as {
  __pipeQuarantine?: Map<string, QuarantineState>;
};

function quarantineMap(): Map<string, QuarantineState> {
  return (globalForPipeHealth.__pipeQuarantine ??= new Map());
}

function pipeKey(baseUrl: string, upstreamModel: string): string {
  return `${baseUrl}::${upstreamModel}`;
}

export function isPipeQuarantined(baseUrl: string, upstreamModel: string): boolean {
  const key = pipeKey(baseUrl, upstreamModel);
  const state = quarantineMap().get(key);
  if (!state) return false;
  if (state.until <= Date.now()) {
    quarantineMap().delete(key);
    return false;
  }
  return true;
}

export function quarantinePipe(
  baseUrl: string,
  upstreamModel: string,
  ms: number = DEFAULT_QUARANTINE_MS,
): void {
  const key = pipeKey(baseUrl, upstreamModel);
  const until = Date.now() + ms;
  const existing = quarantineMap().get(key);
  if (!existing || existing.until < until) {
    quarantineMap().set(key, { until });
    console.warn(
      `[pipe-health] quarantined "${upstreamModel}" @ ${baseUrl} for ${Math.round(ms / 60000)}m`,
    );
  }
}

export function isAuthLikeStatus(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status === 404;
}
