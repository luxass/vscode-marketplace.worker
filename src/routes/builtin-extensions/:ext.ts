import { Hono } from "hono";
import type { HonoContext, Repository } from "../../types";
import { $Octokit, BUILTIN_QUERY, base64ToRawText, translate } from "../../utils";

export const builtinExtensionRouter = new Hono<HonoContext>();

builtinExtensionRouter.get("/:ext", async (ctx) => {
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
