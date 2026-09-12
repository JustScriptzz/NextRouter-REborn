// Private per-Discord-user API keys, minted by the Discord bot.
// Replaces the old shared PUBLIC_API_KEY: each Discord account gets its own
// key via the /getkey slash command, stored alongside the rest of the admin
// config (Vercel Blob, see config-store.ts) - no separate database.
import { kvGetRaw, kvSetRaw } from './config-store';

const STORE_KEY = 'discord_keys';
const KEY_PREFIX = 'nr_priv_';

export interface DiscordKeyRecord {
  key: string;
  createdAt: number;
}

function randomHex(byteLength: number): string {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateKey(): string {
  return `${KEY_PREFIX}${randomHex(24)}`;
}

async function readStore(): Promise<Record<string, DiscordKeyRecord>> {
  const raw = await kvGetRaw(STORE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(data: Record<string, DiscordKeyRecord>): Promise<boolean> {
  return kvSetRaw(STORE_KEY, JSON.stringify(data));
}

// Returns the caller's existing key, or mints a new one if they don't have
// one yet. `created` tells the bot which message to show.
export async function getOrCreateKey(
  discordUserId: string,
): Promise<{ key: string; created: boolean }> {
  const store = await readStore();
  const existing = store[discordUserId];
  if (existing) return { key: existing.key, created: false };
  const key = generateKey();
  store[discordUserId] = { key, createdAt: Date.now() };
  await writeStore(store);
  return { key, created: true };
}

// Invalidates the old key (if any) and issues a new one.
export async function regenerateKey(discordUserId: string): Promise<string> {
  const store = await readStore();
  const key = generateKey();
  store[discordUserId] = { key, createdAt: Date.now() };
  await writeStore(store);
  return key;
}

export async function revokeKey(discordUserId: string): Promise<boolean> {
  const store = await readStore();
  if (!store[discordUserId]) return false;
  delete store[discordUserId];
  return writeStore(store);
}

// Looks up which Discord user a bearer key belongs to. O(n) over the key
// store, fine at this scale (config-store caches the underlying blob read
// for 15s, so bursts of requests don't refetch every time).
export async function resolveDiscordKey(key: string): Promise<string | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const store = await readStore();
  for (const [discordUserId, rec] of Object.entries(store)) {
    if (rec.key === key) return discordUserId;
  }
  return null;
}
