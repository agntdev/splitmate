import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getExpenseStore } from "../stores/expenses.js";

const composer = new Composer<Ctx>();

composer.command("list", async (ctx) => {
  const store = getExpenseStore();
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