import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.command("help", async (ctx) => {
  await ctx.reply(
    "Available commands:\n/start — Get started\n/t01 — Verify the bot skeleton\n/split — Split an amount equally among mentioned users\n/save — Save an expense with name and amount\n/list — List all saved expenses\n/clear — Clear all saved expenses\n/help — Show this help message",
  );
});

export default composer;