import { test, describe, beforeEach, afterEach, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveSession, loadSession, clearSession } from "./auth.js";

const testDir = path.join(os.tmpdir(), "vanguard-cli-test-" + Date.now());
const testSessionPath = path.join(testDir, "session.json");

const validSession = {
  cookies: [{ name: "test", value: "123", domain: ".example.com", path: "/" }],
  origins: [],
  xsrfToken: "xsrf-abc-123",
  hierarchyId: "000-XXXXXXXXXX",
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
    const loaded = loadSession(testSessionPath);
    expect(loaded).toEqual(validSession);
  });

  test("loadSession rejects session without xsrfToken", () => {
    const bad = { ...validSession, xsrfToken: "" };
    fs.writeFileSync(testSessionPath, JSON.stringify(bad));
    expect(loadSession(testSessionPath)).toBeNull();
  });

  test("loadSession rejects session without hierarchyId", () => {
    const bad = { ...validSession, hierarchyId: "" };
    fs.writeFileSync(testSessionPath, JSON.stringify(bad));
    expect(loadSession(testSessionPath)).toBeNull();
  });

  test("loadSession rejects session without cookies array", () => {
    const { cookies, ...rest } = validSession;
    fs.writeFileSync(testSessionPath, JSON.stringify(rest));
    expect(loadSession(testSessionPath)).toBeNull();
  });

  test("loadSession rejects session without createdAt", () => {
    const { createdAt, ...rest } = validSession;
    fs.writeFileSync(testSessionPath, JSON.stringify(rest));
    expect(loadSession(testSessionPath)).toBeNull();
  });

  test("loadSession rejects session with negative createdAt", () => {
    const bad = { ...validSession, createdAt: -1 };
    fs.writeFileSync(testSessionPath, JSON.stringify(bad));
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
