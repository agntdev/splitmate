import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { createRequire } from "node:module";

const composer = new Composer<Ctx>();

let _store: ClearStore | null = null;

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

interface ClearStore {
  deleteAll(chatId: number): Promise<number>;
}

class MemoryClearStore implements ClearStore {
  private store = new Map<string, number>();

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

class RedisClearStore implements ClearStore {
  constructor(private readonly client: RedisLike) {}

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

function getStore(): ClearStore {
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
    _store = new RedisClearStore(client);
  } else {
    _store = new MemoryClearStore();
  }
  return _store;
}

composer.command("clear", async (ctx) => {
  const store = getStore();
  const count = await store.deleteAll(ctx.chat!.id);

  if (count === 0) {
    await ctx.reply("No expenses to clear.");
  } else {
    await ctx.reply(`Cleared ${count} expense(s).`);
  }
});

export default composer;
