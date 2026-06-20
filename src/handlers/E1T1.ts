import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.command("split", async (ctx) => {
  const raw = ctx.match?.trim() ?? "";

  if (!raw) {
    await ctx.reply(
      "Usage: /split <amount> @user1 @user2 [@user3 ...]\n\nSplit an amount equally among mentioned users.",
    );
    return;
  }

  const mentionRegex = /@\w+/g;
  const mentions = raw.match(mentionRegex) ?? [];

  const amountStr = raw.replace(mentionRegex, "").trim();
  const amount = Number(amountStr);

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply(
      "Invalid amount. Please provide a positive number, e.g. /split 100 @alice @bob",
    );
    return;
  }

  if (mentions.length < 2) {
    await ctx.reply(
      "Please mention at least 2 users to split the amount among.",
    );
    return;
  }

  const share = amount / mentions.length;
  const fmt = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(2));
  const usersList = mentions.map((m) => `  ${m}`).join("\n");

  await ctx.reply(
    `Splitting ${fmt(amount)} among ${mentions.length} people:\n\n${usersList}\n\nEach person pays/receives: ${fmt(share)}`,
  );
});

export default composer;
