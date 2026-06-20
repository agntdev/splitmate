import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  await ctx.reply(
    "Welcome to AGNTDEV Bot!\n\nType /help to see available commands.",
  );
});

export default composer;