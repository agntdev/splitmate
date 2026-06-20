import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { createRequire } from "node:module";

const composer = new Composer<Ctx>();

let _store: ExpenseStore | null = null;

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

interface ExpenseStore {
  save(chatId: number, name: string, amount: number): Promise<void>;
  get(chatId: number, name: string): Promise<number | null>;
}

class MemoryExpenseStore implements ExpenseStore {
  private store = new Map<string, number>();

  private key(chatId: number, name: string): string {
    return `expense:${chatId}:${name}`;
  }

  async save(chatId: number, name: string, amount: number): Promise<void> {
    this.store.set(this.key(chatId, name), amount);
  }

  async get(chatId: number, name: string): Promise<number | null> {
    return this.store.get(this.key(chatId, name)) ?? null;
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

  async get(chatId: number, name: string): Promise<number | null> {
    const raw = await this.client.get(this.key(chatId, name));
    if (raw === null) return null;
    return Number(raw);
  }
}

function getStore(): ExpenseStore {
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
    _store = new RedisExpenseStore(client);
  } else {
    _store = new MemoryExpenseStore();
  }
  return _store;
}

composer.command("save", async (ctx) => {
  const args = ctx.match.trim();
  if (!args) {
    await ctx.reply("Usage: /save <name> <amount>\nExample: /save lunch 150");
    return;
  }

  const parts = args.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("Please provide both a name and an amount.\nUsage: /save <name> <amount>\nExample: /save lunch 150");
    return;
  }

  const name = parts[0]!;
  const amountStr = parts[1]!;
  const amount = Number(amountStr);

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply("Amount must be a positive number.\nExample: /save lunch 150");
    return;
  }

  const store = getStore();
  await store.save(ctx.chat!.id, name, amount);

  await ctx.reply(`Expense saved: ${name} - ${amount}`);
});

export default composer;
