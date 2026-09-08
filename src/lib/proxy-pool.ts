export async function proxiedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}

export function describeProxyPool(): Array<{
  label: string;
  fails: number;
  coolingDownMs: number;
}> {
  return [];
}

export function getProxyPoolSize(): number {
  return 0;
}

export function shouldProxy(_host: string): boolean {
  return false;
}