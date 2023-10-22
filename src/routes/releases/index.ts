import { Hono } from "hono";
import semver from "semver";
import type { HonoContext } from "../../types";
import { $Octokit } from "../../utils";
import {
  latestReleaseRouter,
} from "./latest";

export const releasesRouter = new Hono<HonoContext>().basePath("/releases");

releasesRouter.route("/latest", latestReleaseRouter);

releasesRouter.get("/", async (ctx) => {
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
