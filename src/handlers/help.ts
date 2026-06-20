import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.command("help", async (ctx) => {
  await ctx.reply(
    "Available commands:\n/start — Get started\n/t01 — Verify the bot skeleton\n/help — Show this help message",
  );
});

export default composer;