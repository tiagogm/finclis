import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveSession, loadSession, clearSession } from "./auth.js";

// Use a temp dir instead of real ~/.wise-cli
const testDir = path.join(os.tmpdir(), "wise-cli-test-" + Date.now());
const testSessionPath = path.join(testDir, "session.json");

describe("session storage", () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("saveSession writes token to disk", () => {
    const session = { token: "abc-123", profileId: 456 };
    saveSession(session, testSessionPath);
    const raw = fs.readFileSync(testSessionPath, "utf-8");
    assert.deepStrictEqual(JSON.parse(raw), session);
  });

  test("loadSession reads token from disk", () => {
    const session = { token: "abc-123", profileId: 456 };
    fs.writeFileSync(testSessionPath, JSON.stringify(session));
    const loaded = loadSession(testSessionPath);
    assert.deepStrictEqual(loaded, session);
  });

  test("loadSession returns null when no file exists", () => {
    const loaded = loadSession(testSessionPath);
    assert.strictEqual(loaded, null);
  });

  test("clearSession deletes the file", () => {
    fs.writeFileSync(testSessionPath, "{}");
    clearSession(testSessionPath);
    assert.strictEqual(fs.existsSync(testSessionPath), false);
  });
});
