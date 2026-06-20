import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import type { RedisLike } from "../toolkit/index.js";

class MemoryExpenseStore implements RedisLike {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<string> {
    this.store.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = globToRegex(pattern);
    return [...this.store.keys()].filter((k) => regex.test(k));
  }
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

const als = new AsyncLocalStorage<RedisLike>();
const sessionStores = new Map<object, MemoryExpenseStore>();

export function runWithStore<T>(session: object, fn: () => T): T {
  let store = sessionStores.get(session);
  if (!store) {
    store = new MemoryExpenseStore();
    sessionStores.set(session, store);
  }
  return als.run(store, fn);
}

let _redisClient: RedisLike | null = null;

export function initExpenseStore(): void {
  _client = null;
}

function getClient(): RedisLike {
  const alsStore = als.getStore();
  if (alsStore) return alsStore;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    if (_redisClient) return _redisClient;
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ioredis: any = require("ioredis");
    const Redis = (ioredis.default ?? ioredis.Redis ?? ioredis) as new (
      url: string,
      opts: Record<string, unknown>,
    ) => RedisLike;
    _redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    return _redisClient;
  }

  throw new Error(
    "No expense store available: neither REDIS_URL nor session store active",
  );
}

export interface ExpenseEntry {
  name: string;
  amount: number;
  timestamp: number;
}

const PREFIX = "expense:";

function key(chatId: number, name: string): string {
  return `${PREFIX}${chatId}:${name}`;
}

export async function saveExpense(
  chatId: number,
  name: string,
  amount: number,
): Promise<{ amount: number; timestamp: number }> {
  const client = getClient();
  const ts = Date.now();
  await client.set(key(chatId, name), JSON.stringify({ amount, timestamp: ts }));
  return { amount, timestamp: ts };
}

export async function getExpense(
  chatId: number,
  name: string,
): Promise<number | null> {
  const client = getClient();
  const raw = await client.get(key(chatId, name));
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as { amount: number };
  return parsed.amount;
}

export async function getAllExpenses(
  chatId: number,
): Promise<ExpenseEntry[]> {
  const client = getClient();
  const pattern = `${PREFIX}${chatId}:*`;
  const keys = await client.keys(pattern);
  const prefix = `${PREFIX}${chatId}:`;
  const entries: ExpenseEntry[] = [];
  for (const k of keys) {
    const raw = await client.get(k);
    if (raw === null) continue;
    const parsed = JSON.parse(raw) as { amount: number; timestamp: number };
    const amount = parsed.amount;
    if (isNaN(amount)) continue;
    entries.push({ name: k.slice(prefix.length), amount, timestamp: parsed.timestamp ?? 0 });
  }
  entries.sort((a, b) => b.timestamp - a.timestamp);
  return entries;
}

export async function deleteAllExpenses(chatId: number): Promise<number> {
  const client = getClient();
  const pattern = `${PREFIX}${chatId}:*`;
  const keys = await client.keys(pattern);
  for (const k of keys) {
    await client.del(k);
  }
  return keys.length;
}
