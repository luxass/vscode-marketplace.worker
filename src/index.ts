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

function base64ToRawText(base64: string) {
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const paddingChar = "=";
  let output = "";
  let buffer = 0;
  let bufferLength = 0;

  for (let i = 0; i < base64.length; i++) {
    const char = base64.charAt(i);
    const charIndex = base64Chars.indexOf(char);

    if (char === paddingChar) {
      break; // Padding character, stop decoding
    }

    if (charIndex === -1) {
      continue; // Skip invalid characters
    }

    buffer = (buffer << 6) | charIndex;
    bufferLength += 6;

    if (bufferLength >= 8) {
      bufferLength -= 8;
      const charCode = (buffer >> bufferLength) & 0xFF;
      output += String.fromCharCode(charCode);
    }
  }

  return output;
}

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

function translate<T>(originalObject: T, translationValues: any): T {
  if (typeof originalObject !== "object") {
    return originalObject;
  }

  const translatedObject: any = {};

  for (const key in originalObject) {
    const value = originalObject[key];

    if (typeof value === "string") {
      const matches = value.match(/%([^%]+)%/);

      if (matches) {
        const placeholder = matches[1];
        const translation = translationValues[placeholder];

        if (translation) {
          translatedObject[key] = value.replace(`%${placeholder}%`, translation);
        } else {
          translatedObject[key] = value;
        }
      } else {
        translatedObject[key] = value;
      }
    } else if (typeof value === "object") {
      translatedObject[key] = translate(value, translationValues);
    } else {
      translatedObject[key] = value;
    }
  }

  return translatedObject;
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

  const pkgEntry = files.entries.find((entry) => entry.name === "package.json");
  if (!pkgEntry) {
    return new Response("Not found", { status: 404 });
  }

  const pkgNLSEntry = files.entries.find((entry) => entry.name === "package.nls.json");
  if (!pkgNLSEntry) {
    return new Response("Not found", { status: 404 });
  }

  const { data: pkgJSONData } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner: "microsoft",
    repo: "vscode",
    path: pkgEntry.path,
  });

  const { data: pkgNLSJSONData } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner: "microsoft",
    repo: "vscode",
    path: pkgNLSEntry.path,
  });

  if (Array.isArray(pkgJSONData) || Array.isArray(pkgNLSJSONData)) {
    return new Response("Not found", { status: 404 });
  }

  if (pkgJSONData.type !== "file" || pkgNLSJSONData.type !== "file") {
    return new Response("Not found", { status: 404 });
  }
  const pkgJSON = JSON.parse(base64ToRawText(pkgJSONData.content));
  const pkgNLSJSON = JSON.parse(base64ToRawText(pkgNLSJSONData.content));

  const obj = translate(pkgJSON, pkgNLSJSON);
  return ctx.json(obj);
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
