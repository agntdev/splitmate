import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { runWithStore } from "../stores/expense.js";

const composer = new Composer<Ctx>();

composer.use((ctx, next) => {
  if (process.env.REDIS_URL) return next();
  return runWithStore(ctx.session, () => next());
});

export default composer;