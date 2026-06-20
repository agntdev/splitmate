import { createRequire } from "node:module";

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

export interface ExpenseEntry {
  name: string;
  amount: number;
  timestamp: number;
}

class InMemoryStore implements RedisLike {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<unknown> {
    this.store.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<unknown> {
    this.store.delete(key);
    return 1;
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.replace(/\*$/, "");
    const result: string[] = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) result.push(k);
    }
    return result;
  }
}

let _client: RedisLike | null = null;

function getClient(): RedisLike {
  if (_client) return _client;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    _client = new InMemoryStore();
    return _client;
  }

  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ioredis: any = require("ioredis");
  const Redis = (ioredis.default ?? ioredis.Redis ?? ioredis) as new (
    url: string,
    opts: Record<string, unknown>,
  ) => RedisLike;
  _client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });
  return _client;
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
