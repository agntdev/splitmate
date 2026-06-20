import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { menuKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  const mainMenu = menuKeyboard(
    [
      { text: "Help", data: "help" },
      { text: "Status", data: "status" },
      { text: "About", data: "about" },
    ],
    1,
  );

  await ctx.reply("Welcome to AGNTDEV Bot!\n\nUse the menu below to navigate.", {
    reply_markup: mainMenu,
  });
});

export default composer;
