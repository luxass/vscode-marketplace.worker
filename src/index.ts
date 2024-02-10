import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { cache } from "./cache";
import type { HonoContext } from "./types";
import {
  routes,
} from "./routes";

const app = new Hono<HonoContext>();

app.use("*", logger());
app.use(prettyJSON());
app.get(
  "*",
  cache({
    cacheName: "vscode-api",
    cacheControl: "max-age=3600",
  }),
);

app.get("/view-source", (ctx) => {
  return ctx.redirect("https://github.com/luxass/vscode-api.worker");
});

app.route("/", routes);

app.onError(async (err, ctx) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  const message = ctx.env.ENVIRONMENT === "production" ? "Internal server error" : err.stack;
  return new Response(message, {
    status: 500,
  });
});

app.notFound(async () => {
  return new Response("Not found", {
    status: 404,
  });
});

export default app;
