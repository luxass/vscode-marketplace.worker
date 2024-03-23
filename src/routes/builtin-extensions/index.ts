import { Hono } from "hono";
import type { HonoContext } from "../../types";
import { getBuiltinExtensionFiles } from "../../utils";
import { builtinExtensionRouter } from "./:ext";

export const builtinExtensionsRouter = new Hono<HonoContext>().basePath(
  "/builtin-extensions",
);

builtinExtensionsRouter.route("/", builtinExtensionRouter);

builtinExtensionsRouter.get("/", async (ctx) => {
  const octokit = ctx.get("octokit");

  const files = await getBuiltinExtensionFiles(octokit, "extensions");

  if (!files || !files.entries) {
    return ctx.notFound();
  }

  return ctx.json({
    extensions: files.entries
      .filter((entry) => entry.type === "tree")
      .filter((entry) => {
        if (
          !entry.object
          || !("entries" in entry.object)
          || !entry.object.entries
        ) {
          return false;
        }

        return entry.object.entries.some(
          (entry) => entry.name === "package.json" && entry.type === "blob",
        );
      })
      .map((entry) => entry.name),
  });
});
