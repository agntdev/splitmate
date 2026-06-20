import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getAllExpenses } from "../stores/expense.js";

const composer = new Composer<Ctx>();

composer.command("list", async (ctx) => {
  const entries = await getAllExpenses(ctx.chat!.id);

  if (entries.length === 0) {
    await ctx.reply("No saved expenses. Use /save <name> <amount> to add one.");
    return;
  }

  const lines = entries.map((e) => `${e.name} — ${e.amount} — saved at ${e.ts}`);
  const text = `Your saved expenses:\n${lines.join("\n")}`;
  await ctx.reply(text);
});

export default composer;