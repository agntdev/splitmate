import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getExpenseStore } from "../stores/expenses.js";

const composer = new Composer<Ctx>();

composer.command("clear", async (ctx) => {
  const store = getExpenseStore();
  const count = await store.deleteAll(ctx.chat!.id);

  if (count === 0) {
    await ctx.reply("No expenses to clear.");
  } else {
    await ctx.reply(`Cleared ${count} expense(s).`);
  }
});

export default composer;