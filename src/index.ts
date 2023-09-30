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

export interface Repository {
  object: RepositoryObject
}

export interface RepositoryObject {
  entries: Entry[]
}

export interface Entry {
  type: "blob" | "tree"
  name: string
  path: string
  pathRaw: string
  object: {
    entries?: (Omit<Entry, "object">)[]
  }
}

export interface BuiltinExtension {
  name: string
  version: string
  pkgJSON: string
  pkgNlsJSON: string
  contributes?: any // TODO: Add a correct type for this.
}

const BUILTIN_EXTENSIONS_QUERY = `#graphql
  query {
    repository(owner: "microsoft", name: "vscode") {
      object(expression: "HEAD:extensions") {
        ... on Tree {
          entries {
            type
            name
            path
            pathRaw
            object {
              ... on Tree {
                entries {
                  type
                  name
                  path
                  pathRaw
                }
              }
            }
          }
        }
      }
    }
  }
`;

const app = new Hono<{
  Bindings: {
    GITHUB_TOKEN: string
  }
  Variables: {
    FILES?: BuiltinExtension[]
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
  if (url.host.startsWith("vscode-releases") && url.pathname !== "/releases") {
    return ctx.redirect("/releases");
  }

  if (url.host.startsWith("latest-vscode-release") && url.pathname !== "/releases/latest") {
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

app.use("/builtin-extensions", async (ctx, next) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  });

  const {
    repository: {
      object: files,
    },
  } = await octokit.graphql<{
    repository: Repository
  }>(BUILTIN_EXTENSIONS_QUERY, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  const entries = files.entries.filter((entry) => entry.type === "tree")
    .map((entry) => {
      if (!entry.object.entries) {
        return null;
      }

      if (!entry.object.entries.some((entry) => entry.name === "package.json") && !entry.object.entries.some((entry) => entry.name === "package.nls.json")) {
        return null;
      }

      const pkgJson = entry.object.entries.find((entry) => entry.name === "package.json");
      if (!pkgJson) {
        return null;
      }

      const pkgNlsJson = entry.object.entries.find((entry) => entry.name === "package.nls.json");
      if (!pkgNlsJson) {
        return null;
      }

      return entry;
    }).filter(Boolean);

  const builtins = await Promise.all(entries.map(async (entry) => {
    return {

    };
  }));

  ctx.set("FILES", builtins);

  await next();
});

app.get("/builtin-extensions", async (ctx) => {
  const files = ctx.get("FILES");
  if (!files) {
    return new Response("Not found", { status: 404 });
  }

  return ctx.json({
    files,
  });
});

app.get("/builtin-extensions/:ext", async (ctx) => {
  const files = ctx.get("FILES");
  const file = files.find((file) => file.name === ctx.req.param("ext"));
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return ctx.json({
    file,
  });
});

app.get("/builtin-extensions/:ext/package.json", async (ctx) => {
  const files = ctx.get("FILES");
  const file = files.find((file) => file.name === ctx.req.param("ext"));
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return ctx.json({
    file,
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
