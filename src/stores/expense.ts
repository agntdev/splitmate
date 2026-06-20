import { createRequire } from "node:module";

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

export interface ExpenseEntry {
  name: string;
  amount: string;
  ts: string;
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
): Promise<ExpenseEntry> {
  const client = getClient();
  const ts = new Date().toISOString();
  const amountStr = amount.toFixed(2);
  const value = JSON.stringify({ amount: amountStr, ts });
  await client.set(key(chatId, name), value);
  return { name, amount: amountStr, ts };
}

export async function getExpense(
  chatId: number,
  name: string,
): Promise<ExpenseEntry | null> {
  const client = getClient();
  const raw = await client.get(key(chatId, name));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as ExpenseEntry;
    if (parsed && typeof parsed.amount === "string" && typeof parsed.ts === "string") {
      return { name, amount: parsed.amount, ts: parsed.ts };
    }
  } catch {
    // legacy plain-number values: treat as missing
  }
  return null;
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
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.amount === "string" && typeof parsed.ts === "string") {
        entries.push({ name: k.slice(prefix.length), amount: parsed.amount, ts: parsed.ts });
      }
    } catch {
      continue;
    }
  }
  entries.sort((a, b) => b.ts.localeCompare(a.ts));
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