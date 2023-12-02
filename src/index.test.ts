import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("worker", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      vars: {
        WORKER_ENV: "production",
      },
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it("should return latest vscode release", async () => {
    const resp = await worker.fetch("/releases/latest");
    if (resp) {
      const latest = await resp.json();
      expect(latest).toBeTypeOf("object");
      expect(latest).toHaveProperty("tag");
    }
  });

  it("should return list of all vscode releases after 1.45.0", async () => {
    const resp = await worker.fetch("/releases");
    if (resp) {
      const releases = await resp.json();
      expect(releases).toBeTypeOf("object");
    }
  });

  it("should return list of all builtin vscode extensions", async () => {
    const resp = await worker.fetch("/builtin-extensions");
    if (resp) {
      const extensions = await resp.json();
      expect(extensions).toBeTypeOf("object");
      expect(extensions).toHaveProperty("extensions");
    }
  });

  it("should return the package.json of a specific builtin vscode extension", async () => {
    const resp = await worker.fetch("/builtin-extensions/javascript");
    if (resp) {
      const extension = await resp.json();
      expect(extension).toBeTypeOf("object");
      expect(extension).toHaveProperty("name");
      expect(extension).toHaveProperty("displayName");
      // @ts-expect-error please be quiet typescript
      expect(extension.name).toBe("javascript");
    }
  });

  it("should work without an nls file", async () => {
    const resp = await worker.fetch("/builtin-extensions/vscode-api-tests");
    if (resp) {
      const extension = await resp.json();
      expect(extension).toBeTypeOf("object");
      expect(extension).toHaveProperty("name");
      // @ts-expect-error please be quiet typescript
      expect(extension.name).toBe("vscode-api-tests");
    }
  });
});
