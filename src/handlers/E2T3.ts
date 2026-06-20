import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { deleteAllExpenses } from "../stores/expense.js";

const composer = new Composer<Ctx>();

composer.command("clear", async (ctx) => {
  const count = await deleteAllExpenses(ctx.chat!.id);

  if (count === 0) {
    await ctx.reply("No expenses to clear.");
  } else {
    await ctx.reply(`Cleared ${count} expense(s).`);
  }
});

export default composer;
