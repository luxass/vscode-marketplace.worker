import { Hono } from "hono";
import { format } from "prettier/standalone";
import typescriptPlugin from "prettier/plugins/typescript";
import estreePlugin from "prettier/plugins/estree";

import type { HonoContext, Repository } from "../../types";
import {
  $Octokit,
  BUILTIN_QUERY,
  base64ToRawText,
  getBuiltinExtensionFiles,
  translate,
} from "../../utils";

// import { dereference } from "../../json-schema/dereference";
import { link } from "../../json-schema/linker";
import { parse } from "../../json-schema/parse";
import { optimize } from "../../json-schema/optimizer";
import { generate } from "../../json-schema/generator";
import { normalize } from "../../json-schema/normalizer";

type BuiltinExtensionHonoContext = HonoContext & {
  Variables: {
    builtinExtensionName: string;
    builtinExtension: Record<string, unknown>;
  };
};

export const builtinExtensionRouter = new Hono<BuiltinExtensionHonoContext>().basePath("/:ext");

builtinExtensionRouter.use("*", async (ctx, next) => {
  const octokit = ctx.get("octokit");
  const params = ctx.req.param();
  if (!params || !params.ext) {
    return ctx.notFound();
  }

  const extName = params.ext;

  const files = await getBuiltinExtensionFiles(
    octokit,
    `extensions/${extName}`,
  );

  if (!files || !("entries" in files) || !files.entries) {
    return ctx.notFound();
  }

  const pkgEntry = files.entries.find((entry) => entry.name === "package.json");
  if (!pkgEntry) {
    return ctx.notFound();
  }

  const { data: pkgJSONData } = await octokit.request(
    "GET /repos/{owner}/{repo}/contents/{path}",
    {
      owner: "microsoft",
      repo: "vscode",
      path: pkgEntry.path!,
    },
  );

  if (Array.isArray(pkgJSONData) || pkgJSONData.type !== "file") {
    return ctx.notFound();
  }

  const pkg = JSON.parse(base64ToRawText(pkgJSONData.content));

  let result = pkg;
  const pkgNLSEntry = files.entries.find(
    (entry) => entry.name === "package.nls.json",
  );

  if (pkgNLSEntry) {
    const { data: pkgNLSJSONData } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: "microsoft",
        repo: "vscode",
        path: pkgNLSEntry.path!,
      },
    );

    if (Array.isArray(pkgNLSJSONData) || pkgNLSJSONData.type !== "file") {
      return ctx.notFound();
    }

    const pkgNLSJSON = JSON.parse(base64ToRawText(pkgNLSJSONData.content));

    result = translate(pkg, pkgNLSJSON);
  }

  ctx.set("builtinExtensionName", extName);
  ctx.set("builtinExtension", result);
  await next();
});

builtinExtensionRouter.get("/", async (ctx) => {
  const ext = ctx.get("builtinExtension");

  return ctx.json(ext);
});

builtinExtensionRouter.get("/contributes", async (ctx) => {
  const ext = ctx.get("builtinExtension");
  if (!ext) {
    return ctx.notFound();
  }

  return ctx.json(ext.contributes);
});

builtinExtensionRouter.get("/configuration", async (ctx) => {
  const ext = ctx.get("builtinExtension");
  if (
    !ext
    || !("contributes" in ext)
    || !ext.contributes
    || typeof ext.contributes !== "object"
    || !("configuration" in ext.contributes)
    || !ext.contributes.configuration
  ) {
    return ctx.notFound();
  }

  return ctx.json(ext.contributes.configuration);
});

builtinExtensionRouter.get("/configuration/codegen", async (ctx) => {
  const ext = ctx.get("builtinExtension");

  if (
    !ext
    || !("contributes" in ext)
    || !ext.contributes
    || typeof ext.contributes !== "object"
    || !("configuration" in ext.contributes)
    || !ext.contributes.configuration
  ) {
    return ctx.notFound();
  }

  const linked = link(ext.contributes.configuration);

  const normalized = normalize(linked, "Builtins");

  const ast = parse(normalized);

  const optimized = optimize(ast);

  const extName = ctx.get("builtinExtensionName");
  if (extName === "vscode-test-resolver") {
    // return ctx.json(optimized);
  }

  const generated = generate(optimized);

  // properties.forEach((property) => {
  //   const parts = property.split(".");
  //   let obj = config;
  //   parts.forEach((part, index) => {
  //     if (index === parts.length - 1) {
  //       obj[part] = undefined;
  //     } else {
  //       obj[part] = obj[part] || {};
  //       obj = obj[part];
  //     }
  //   });
  // });

  console.log(generated);

  return ctx.text(
    await format(generated, {
      parser: "typescript",
      plugins: [estreePlugin, typescriptPlugin],
    }),
  );
});
