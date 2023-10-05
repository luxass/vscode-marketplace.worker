import {
  Buffer,
} from "node:buffer";
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
import { cache } from "./cache";

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

const BUILTIN_QUERY = `#graphql
  query getBuiltin($path: String!) {
    repository(owner: "microsoft", name: "vscode") {
      object(expression: $path) {
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
    WORKER_ENV: string
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

app.get("/builtin-extensions", async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  });

  const {
    repository: {
      object: files,
    },
  } = await octokit.graphql<{
    repository: Repository
  }>(BUILTIN_QUERY, {
    path: "HEAD:extensions",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!files.entries) {
    return new Response("Not found", { status: 404 });
  }

  return ctx.json({
    extensions: files.entries.filter((entry) => entry.type === "tree").map((entry) => entry.name),
  });

  // const builtinPromises = files.entries.filter((entry) => entry.type === "tree")
  //   .map(async (entry) => {
  //     if (!entry.object.entries) {
  //       return null;
  //     }

  //     if (!entry.object.entries.some((entry) => entry.name === "package.json") && !entry.object.entries.some((entry) => entry.name === "package.nls.json")) {
  //       return null;
  //     }

  //     const pkgJson = entry.object.entries.find((entry) => entry.name === "package.json");
  //     if (!pkgJson) {
  //       return null;
  //     }

  //     const pkgNlsJson = entry.object.entries.find((entry) => entry.name === "package.nls.json");
  //     if (!pkgNlsJson) {
  //       return null;
  //     }

  //     return {
  //       name: entry?.name ?? "",
  //       version: "",
  //       pkgJSON: "",
  //       pkgNlsJSON: "",
  //     };
  //   });
});

app.get("/builtin-extensions/:ext", async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  });

  const extName = ctx.req.param("ext");
  if (!extName) {
    return new Response("Not found", { status: 404 });
  }

  const {
    repository: {
      object: files,
    },
  } = await octokit.graphql<{
    repository: Repository
  }>(BUILTIN_QUERY, {
    path: `HEAD:extensions/${extName}`,
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!files) {
    return new Response("Not found", { status: 404 });
  }

  const pkgJson = files.entries.find((entry) => entry.name === "package.json");
  if (!pkgJson) {
    return new Response("Not found", { status: 404 });
  }

  const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner: "microsoft",
    repo: "vscode",
    path: pkgJson.path,
  });

  const pkgJSON = data;
  if (Array.isArray(pkgJSON)) {
    return new Response("Not found", { status: 404 });
  }

  if (pkgJSON.type !== "file") {
    return new Response("Not found", { status: 404 });
  }

  const content = Buffer.from(pkgJSON.content, "base64").toString("utf-8");

  return ctx.json(JSON.parse(content));
});

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
  return new Response("Not found", {
    status: 404,
  });
});

export default app;
