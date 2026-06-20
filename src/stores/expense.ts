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

function createRedisClient(url: string): RedisLike {
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ioredis: any = require("ioredis");
  const Redis = (ioredis.default ?? ioredis.Redis ?? ioredis) as new (
    url: string,
    opts: Record<string, unknown>,
  ) => RedisLike;
  return new Redis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });
}

let _client: RedisLike | null = null;

function getClient(): RedisLike {
  if (_client) return _client;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error(
      "REDIS_URL is required for persistent expense storage. " +
        "Set the REDIS_URL environment variable.",
    );
  }

  _client = createRedisClient(redisUrl);
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
): Promise<void> {
  const client = getClient();
  await client.set(key(chatId, name), JSON.stringify({ amount, timestamp: Date.now() }));
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
