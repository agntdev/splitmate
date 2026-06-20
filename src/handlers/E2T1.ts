import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getExpenseStore } from "../stores/expenses.js";

const composer = new Composer<Ctx>();

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

  const store = getExpenseStore();
  await store.save(ctx.chat!.id, name, amount);

  await ctx.reply(`Expense saved: ${name} - ${amount}`);
});

export default composer;