import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { createRequire } from "node:module";

const composer = new Composer<Ctx>();

let _store: ListStore | null = null;

interface RedisLike {
  get(key: string): Promise<string | null>;
  keys(pattern: string): Promise<string[]>;
}

interface ExpenseEntry {
  name: string;
  amount: number;
}

interface ListStore {
  getAll(chatId: number): Promise<ExpenseEntry[]>;
}

class MemoryListStore implements ListStore {
  private store = new Map<string, number>();

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
}

class RedisListStore implements ListStore {
  constructor(private readonly client: RedisLike) {}

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
}

function getStore(): ListStore {
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
    const client = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
    _store = new RedisListStore(client);
  } else {
    _store = new MemoryListStore();
  }
  return _store;
}

composer.command("list", async (ctx) => {
  const store = getStore();
  const entries = await store.getAll(ctx.chat!.id);

  if (entries.length === 0) {
    await ctx.reply("No expenses saved yet.");
    return;
  }

  const lines = entries.map((e) => `${e.name} - ${e.amount}`);
  const text = `Your expenses:\n${lines.join("\n")}`;
  await ctx.reply(text);
});

export default composer;