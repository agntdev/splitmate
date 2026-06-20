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
}

const PREFIX = "expense:";

function k(chatId: number, name: string): string {
  return `${PREFIX}${chatId}:${name}`;
}

class MemoryExpenseStore {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.replace(/\*$/, "");
    const result: string[] = [];
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        result.push(key);
      }
    }
    return result;
  }
}

type Store = RedisLike | MemoryExpenseStore;

let _redisClient: RedisLike | null = null;
const _memoryStore = new MemoryExpenseStore();

function resolveStore(): Store {
  if (process.env.REDIS_URL) {
    if (!_redisClient) {
      const require = createRequire(import.meta.url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ioredis: any = require("ioredis");
      const Redis = (ioredis.default ?? ioredis.Redis ?? ioredis) as new (
        url: string,
        opts: Record<string, unknown>,
      ) => RedisLike;
      _redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: false,
      });
    }
    return _redisClient;
  }
  return _memoryStore;
}

export async function saveExpense(
  chatId: number,
  name: string,
  amount: number,
): Promise<void> {
  const store = resolveStore();
  await store.set(k(chatId, name), String(amount));
}

export async function getExpense(
  chatId: number,
  name: string,
): Promise<number | null> {
  const store = resolveStore();
  const raw = await store.get(k(chatId, name));
  if (raw === null) return null;
  return Number(raw);
}

export async function getAllExpenses(
  chatId: number,
): Promise<ExpenseEntry[]> {
  const store = resolveStore();
  const pattern = `${PREFIX}${chatId}:*`;
  const keys = await store.keys(pattern);
  const prefix = `${PREFIX}${chatId}:`;
  const entries: ExpenseEntry[] = [];
  for (const key of keys) {
    const raw = await store.get(key);
    if (raw === null) continue;
    const amount = Number(raw);
    if (isNaN(amount)) continue;
    entries.push({ name: key.slice(prefix.length), amount });
  }
  entries.sort((a, b) => b.name.localeCompare(a.name));
  return entries;
}

export async function deleteAllExpenses(chatId: number): Promise<number> {
  const store = resolveStore();
  const pattern = `${PREFIX}${chatId}:*`;
  const keys = await store.keys(pattern);
  for (const key of keys) {
    await store.del(key);
  }
  return keys.length;
}