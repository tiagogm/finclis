import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { registerMocks } from "./__test-helpers.js";

registerMocks();

// CACHE_DIR comes from the mocked auth.js module (see __test-helpers.ts).
const { loadCache } = await import("./transactions.js");
const CACHE_DIR = "/tmp/monzo-cli-test-cache";

function cacheFile(accountId: string, year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return path.join(CACHE_DIR, `transactions-${accountId}-${year}-${mm}.json`);
}

describe("loadCache account scoping", () => {
  beforeEach(() => {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    for (const f of [cacheFile("acc_a", 2026, 1), cacheFile("acc_b", 2026, 1)]) {
      try { fs.unlinkSync(f); } catch {}
    }
  });

  it("reads cache entries scoped to the given account", () => {
    fs.writeFileSync(cacheFile("acc_a", 2026, 1), JSON.stringify([{ id: "tx_a" }]));
    expect(loadCache("acc_a", 1, 2026)).toEqual([{ id: "tx_a" }]);
  });

  it("does not read another account's cache entry", () => {
    fs.writeFileSync(cacheFile("acc_a", 2026, 1), JSON.stringify([{ id: "tx_a" }]));
    expect(loadCache("acc_b", 1, 2026)).toBeNull();
  });
});
