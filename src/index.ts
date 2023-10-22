import { Hono } from "hono";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { cache } from "./cache";
import type { HonoContext } from "./types";
import {
  routes,
} from "./routes";

const app = new Hono<HonoContext>();

app.use("*", logger());
app.get(
  "*",
  cache({
    cacheName: "vscode-api",
    cacheControl: "max-age=3600",
  }),
);

app.use("*", async (ctx, next) => {
  const url = new URL(ctx.req.url);
  if (url.host.startsWith("vscode-releases") && url.pathname !== "/releases") {
    return ctx.redirect("/releases");
  }

  if (url.host.startsWith("latest-vscode-release") && url.pathname !== "/releases/latest") {
    return ctx.redirect("/releases/latest");
  }

  return await next();
});

app.route("/", routes);

app.onError(async (err, ctx) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  const message = ctx.env.WORKER_ENV === "production" ? "Internal server error" : err.stack;
  return new Response(message, {
    status: 500,
  });
});

app.notFound(async () => {
  console.info(JSON.stringify(app.routes, null, 2));

  return new Response("Not found", {
    status: 404,
  });
});
console.info(JSON.stringify(app.routes, null, 2));

export default app;
