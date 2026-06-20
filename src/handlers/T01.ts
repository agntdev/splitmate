import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.command("t01", async (ctx) => {
  await ctx.reply(
    `Bot @${ctx.me.username} is operational. Skeleton verified — auto-loader working.`,
  );
});

export default composer;