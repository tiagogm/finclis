import { test, describe, beforeEach, afterEach, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { isPastMonth, loadCachedMonth, saveCachedMonth, parseVanguardMonthLabel } from "./cache.js";

describe("isPastMonth", () => {
  test("past month returns true", () => {
    expect(isPastMonth(1, 2020)).toBe(true);
  });

  test("future month returns false", () => {
    expect(isPastMonth(12, 2099)).toBe(false);
  });

  test("current month returns false", () => {
    const now = new Date();
    expect(isPastMonth(now.getMonth() + 1, now.getFullYear())).toBe(false);
  });

  test("previous month same year returns true", () => {
    const now = new Date();
    if (now.getMonth() >= 1) {
      expect(isPastMonth(now.getMonth(), now.getFullYear())).toBe(true);
    }
  });
});

describe("cache read/write", () => {
  const testDir = path.join(os.tmpdir(), "vanguard-cache-test-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("loadCachedMonth returns null for missing file", () => {
    // Uses default path which won't match testDir, so always null
    expect(loadCachedMonth(2099, 1)).toBeNull();
  });
});

describe("parseVanguardMonthLabel", () => {
  test("parses Jan 2026", () => {
    expect(parseVanguardMonthLabel("Jan 2026")).toEqual({ month: 1, year: 2026 });
  });

  test("parses Dec 2025", () => {
    expect(parseVanguardMonthLabel("Dec 2025")).toEqual({ month: 12, year: 2025 });
  });

  test("returns null for invalid month", () => {
    expect(parseVanguardMonthLabel("Xyz 2026")).toBeNull();
  });

  test("returns null for missing year", () => {
    expect(parseVanguardMonthLabel("Jan")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseVanguardMonthLabel("")).toBeNull();
  });

  test("handles leading/trailing whitespace", () => {
    expect(parseVanguardMonthLabel("  Feb 2026  ")).toEqual({ month: 2, year: 2026 });
  });
});
