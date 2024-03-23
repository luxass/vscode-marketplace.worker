import { Hono } from "hono";
import type { HonoContext } from "../types";
import { $Octokit } from "../utils";
import { releasesRouter } from "./releases";
import { builtinExtensionsRouter } from "./builtin-extensions";

export const router = new Hono<HonoContext>();

router.use(async (ctx, next) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  });

  ctx.set("octokit", octokit);

  await next();
});
router.route("/", releasesRouter);
router.route("/", builtinExtensionsRouter);
