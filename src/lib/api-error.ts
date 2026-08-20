export function apiErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.length > 0) return data;
  if (data && typeof data === 'object') {
    const err = (data as { error?: unknown }).error;
    if (typeof err === 'string' && err.length > 0) return err;
    if (err && typeof err === 'object') {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.length > 0) return msg;
    }
  }
  return fallback;
}
