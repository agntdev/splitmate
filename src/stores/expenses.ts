import { createRequire } from "node:module";

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

export interface ExpenseEntry {
  name: string;
  amount: number;
}

export interface ExpenseStore {
  save(chatId: number, name: string, amount: number): Promise<void>;
  getAll(chatId: number): Promise<ExpenseEntry[]>;
  deleteAll(chatId: number): Promise<number>;
}

class MemoryExpenseStore implements ExpenseStore {
  private store = new Map<string, number>();

  private key(chatId: number, name: string): string {
    return `expense:${chatId}:${name}`;
  }

  async save(chatId: number, name: string, amount: number): Promise<void> {
    this.store.set(this.key(chatId, name), amount);
  }

  async getAll(chatId: number): Promise<ExpenseEntry[]> {
    const prefix = `expense:${chatId}:`;
    const entries: ExpenseEntry[] = [];
    for (const [key, amount] of this.store) {
      if (key.startsWith(prefix)) {
        entries.push({ name: key.slice(prefix.length), amount });
      }
    }
    entries.sort((a, b) => b.name.localeCompare(a.name));
    return entries;
  }

  async deleteAll(chatId: number): Promise<number> {
    const prefix = `expense:${chatId}:`;
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }
}

class RedisExpenseStore implements ExpenseStore {
  constructor(private readonly client: RedisLike) {}

  private key(chatId: number, name: string): string {
    return `expense:${chatId}:${name}`;
  }

  async save(chatId: number, name: string, amount: number): Promise<void> {
    await this.client.set(this.key(chatId, name), String(amount));
  }

  async getAll(chatId: number): Promise<ExpenseEntry[]> {
    const pattern = `expense:${chatId}:*`;
    const keys = await this.client.keys(pattern);
    const prefix = `expense:${chatId}:`;
    const entries: ExpenseEntry[] = [];
    for (const key of keys) {
      const raw = await this.client.get(key);
      if (raw === null) continue;
      const amount = Number(raw);
      if (isNaN(amount)) continue;
      entries.push({ name: key.slice(prefix.length), amount });
    }
    entries.sort((a, b) => b.name.localeCompare(a.name));
    return entries;
  }

  async deleteAll(chatId: number): Promise<number> {
    const pattern = `expense:${chatId}:*`;
    const keys = await this.client.keys(pattern);
    let deleted = 0;
    for (const key of keys) {
      await this.client.del(key);
      deleted++;
    }
    return deleted;
  }
}

let _store: ExpenseStore | null = null;

export function getExpenseStore(): ExpenseStore {
  if (_store) return _store;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ioredis: any = require("ioredis");
    const Redis = (ioredis.default ?? ioredis.Redis ?? ioredis) as new (
      url: string,
      opts: Record<string, unknown>,
    ) => RedisLike;
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    _store = new RedisExpenseStore(client);
  } else {
    _store = new MemoryExpenseStore();
  }
  return _store;
}