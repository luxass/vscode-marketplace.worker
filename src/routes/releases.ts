import { Hono } from "hono";
import semver from "semver";
import type { HonoContext } from "../types";

export const releasesRouter = new Hono<HonoContext>().basePath("/releases");

releasesRouter.get("/", async (ctx) => {
  const octokit = ctx.get("octokit");

  const releases = await octokit
    .paginate("GET /repos/{owner}/{repo}/releases", {
      owner: "microsoft",
      repo: "vscode",
      per_page: 100,
    })
    .then((releases) =>
      releases.filter((release) => semver.gte(release.tag_name, "1.45.0")),
    );

  return ctx.json(
    {
      releases: releases.map((release) => ({
        tag: release.tag_name,
        url: release.url,
      })),
    },
    200,
    {
      "Content-Type": "application/json",
    },
  );
});

releasesRouter.get("/latest", async (ctx) => {
  const octokit = ctx.get("octokit");

  const { data: releases } = await octokit.request(
    "GET /repos/{owner}/{repo}/releases",
    {
      owner: "microsoft",
      repo: "vscode",
      per_page: 1,
    },
  );

  const release = releases[0];
  if (!("tag_name" in release)) {
    return ctx.notFound();
  }

  return ctx.json(
    {
      tag: release.tag_name,
    },
    200,
    {
      "Content-Type": "application/json",
    },
  );
});
