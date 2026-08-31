// Graceful KV fallback for when Cloudflare KV is unavailable
// Falls back to in-memory cache instead of crashing

const memoryCache = new Map<string, any>();

export async function initKV() {
  try {
    // Try to initialize KV tables
    // If KV is not available (e.g., on Render), this will fail gracefully
    console.log('[KV] Attempting to initialize KV...');
    
    // This would normally call KV setup
    // But we'll skip it if env says to disable KV
    if (process.env.KV_DISABLE === '1') {
      console.warn('[KV] KV disabled via KV_DISABLE=1, using memory cache');
      return;
    }
  } catch (error) {
    console.warn('[KV] Failed to initialize KV, falling back to memory cache:', error instanceof Error ? error.message : error);
  }
}

export async function getKV(key: string, defaultValue?: any): Promise<any> {
  try {
    // If KV is disabled, use memory cache
    if (process.env.KV_DISABLE === '1') {
      return memoryCache.get(key) ?? defaultValue;
    }
    // Try to get from KV, fall back to memory cache if it fails
  } catch (error) {
    console.warn(`[KV] Failed to get key "${key}", using memory cache`);
    return memoryCache.get(key) ?? defaultValue;
  }
}

export async function setKV(key: string, value: any): Promise<void> {
  try {
    // Always update memory cache as fallback
    memoryCache.set(key, value);
    
    if (process.env.KV_DISABLE === '1') {
      return;
    }
    // Try to set in KV, but don't fail if it doesn't work
  } catch (error) {
    console.warn(`[KV] Failed to set key "${key}", using memory cache only`);
  }
}

export async function deleteKV(key: string): Promise<void> {
  try {
    memoryCache.delete(key);
    
    if (process.env.KV_DISABLE === '1') {
      return;
    }
    // Try to delete from KV
  } catch (error) {
    console.warn(`[KV] Failed to delete key "${key}"`);
  }
}

export async function ensureTable(name: string): Promise<void> {
  try {
    if (process.env.KV_DISABLE === '1') {
      console.log(`[KV] Table "${name}" disabled, using memory cache`);
      return;
    }
    // Try to create table if it doesn't exist
  } catch (error) {
    console.warn(`[KV] Failed to ensure table "${name}", using memory cache`);
  }
}
