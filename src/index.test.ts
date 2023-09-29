import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Worker", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
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
});
