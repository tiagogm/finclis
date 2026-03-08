import { test, describe, beforeEach, afterEach, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveSession, loadSession, clearSession, touchSession } from "./auth.js";

const testDir = path.join(os.tmpdir(), "lloyds-cli-test-" + Date.now());
const testSessionPath = path.join(testDir, "session.json");

const validSession = {
  arrangementId: "12345678",
  cookies: [
    {
      name: "session",
      value: "abc",
      domain: ".lloydsbank.co.uk",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: true,
      secure: true,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
  createdAt: Date.now(),
};

describe("session storage", () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("saveSession writes session to disk", () => {
    saveSession(validSession, testSessionPath);
    const raw = fs.readFileSync(testSessionPath, "utf-8");
    expect(JSON.parse(raw)).toEqual(validSession);
  });

  test("loadSession reads session from disk", () => {
    fs.writeFileSync(testSessionPath, JSON.stringify(validSession));
    expect(loadSession(testSessionPath)).toEqual(validSession);
  });

  test("loadSession rejects session without arrangementId", () => {
    const { arrangementId, ...rest } = validSession;
    fs.writeFileSync(testSessionPath, JSON.stringify(rest));
    expect(loadSession(testSessionPath)).toBeNull();
  });

  test("loadSession rejects session without cookies array", () => {
    const { cookies, ...rest } = validSession;
    fs.writeFileSync(testSessionPath, JSON.stringify(rest));
    expect(loadSession(testSessionPath)).toBeNull();
  });

  test("loadSession rejects session without origins array", () => {
    const { origins, ...rest } = validSession;
    fs.writeFileSync(testSessionPath, JSON.stringify(rest));
    expect(loadSession(testSessionPath)).toBeNull();
  });

  test("loadSession returns null when no file exists", () => {
    expect(loadSession(testSessionPath)).toBeNull();
  });

  test("loadSession returns null for malformed JSON", () => {
    fs.writeFileSync(testSessionPath, "not json");
    expect(loadSession(testSessionPath)).toBeNull();
  });

  test("clearSession deletes the file", () => {
    fs.writeFileSync(testSessionPath, "{}");
    clearSession(testSessionPath);
    expect(fs.existsSync(testSessionPath)).toBe(false);
  });

  test("clearSession is graceful when file does not exist", () => {
    clearSession(testSessionPath);
    expect(fs.existsSync(testSessionPath)).toBe(false);
  });
});

describe("touchSession", () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("updates lastAccessedAt on disk", () => {
    const before = Date.now();
    saveSession(validSession, testSessionPath);
    touchSession(testSessionPath); // _lastTouch is 0 on fresh module load, so this always fires
    const loaded = loadSession(testSessionPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.lastAccessedAt).toBeGreaterThanOrEqual(before);
  });

  test("is a no-op when session file does not exist", () => {
    // Should not throw
    touchSession(testSessionPath);
    expect(fs.existsSync(testSessionPath)).toBe(false);
  });
});
