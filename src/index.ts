import {
  Octokit,
} from "@octokit/core";

import {
  paginateRest,
} from "@octokit/plugin-paginate-rest";
import semver from "semver";

import { Hono } from "hono";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { cache } from "hono/cache";

const $Octokit = Octokit.plugin(paginateRest);

const app = new Hono<{
  Bindings: {
    GITHUB_TOKEN: string
  }
}>();

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
  if (url.host.startsWith("vscode-releases")) {
    return ctx.redirect("/releases");
  }

  if (url.host.startsWith("latest-vscode-release")) {
    return ctx.redirect("/releases/latest");
  }

  return await next();
});

app.get("/releases", async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  });

  const releases = await octokit.paginate("GET /repos/{owner}/{repo}/releases", {
    owner: "microsoft",
    repo: "vscode",
    per_page: 100,
  }).then((releases) => releases.filter((release) => semver.gte(release.tag_name, "1.45.0")));

  return ctx.json({
    releases: releases.map((release) => ({
      tag: release.tag_name,
      url: release.url,
    })),
  }, 200, {
    "Content-Type": "application/json",
  });
});

app.get("/releases/latest", async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  });

  const { data: releases } = await octokit.request("GET /repos/{owner}/{repo}/releases", {
    owner: "microsoft",
    repo: "vscode",
    per_page: 1,
  });

  const release = releases[0];
  if (!("tag_name" in release)) {
    return new Response("Not found", { status: 404 });
  }

  return ctx.json({
    tag: release.tag_name,
  }, 200, {
    "Content-Type": "application/json",
  });
});

app.onError(async (err) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return new Response(err.stack, {
    status: 500,
  });
});

export default app;
