import {
  Octokit,
} from "@octokit/core";

import {
  paginateRest,
} from "@octokit/plugin-paginate-rest";
import semver from "semver";

import { Hono } from "hono";
import { logger } from "hono/logger";

const $Octokit = Octokit.plugin(paginateRest);

const app = new Hono<{
  Variables: {
    GITHUB_TOKEN: string
  }
}>();

app.use("*", logger());

app.use("*", async (ctx, next) => {
  if (ctx.req.url.startsWith("vscode-releases")) {
    return ctx.redirect("/releases");
  }

  if (ctx.req.url.startsWith("latest-vscode-release")) {
    return ctx.redirect("/releases/latest");
  }

  return next();
});

app.get("/releases", async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.var.GITHUB_TOKEN,
  });

  const releases = await octokit.paginate("GET /repos/{owner}/{repo}/releases", {
    owner: "microsoft",
    repo: "vscode",
    per_page: 100,
  }).then((releases) => releases.filter((release) => semver.gte(release.tag_name, "1.45.0")));

  return new Response(JSON.stringify({
    releases: releases.map((release) => ({
      tag: release.tag_name,
      url: release.url,
    })),
  }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
});

app.get("/releases/latest", async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.var.GITHUB_TOKEN,
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

  return new Response(JSON.stringify({
    tag: release.tag_name,
  }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
});

export default app;
