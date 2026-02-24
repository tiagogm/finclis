import { test, describe, beforeEach, afterEach, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveSession, loadSession, clearSession, touchSession } from "./auth.js";

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
    expect(JSON.parse(raw)).toEqual(session);
  });

  test("loadSession reads token from disk", () => {
    const session = { token: "abc-123", profileId: 456 };
    fs.writeFileSync(testSessionPath, JSON.stringify(session));
    const loaded = loadSession(testSessionPath);
    expect(loaded).toEqual(session);
  });

  test("loadSession returns null when no file exists", () => {
    const loaded = loadSession(testSessionPath);
    expect(loaded).toBeNull();
  });

  test("loadSession returns null for malformed JSON", () => {
    fs.writeFileSync(testSessionPath, '{"token": 123}');
    const loaded = loadSession(testSessionPath);
    expect(loaded).toBeNull();
  });

  test("loadSession returns null for expired session (default TTL)", () => {
    const session = { token: "abc-123", profileId: 456, createdAt: Date.now() - 2 * 60 * 60 * 1000 };
    fs.writeFileSync(testSessionPath, JSON.stringify(session));
    const loaded = loadSession(testSessionPath);
    expect(loaded).toBeNull();
  });

  test("loadSession returns null for expired session (custom TTL)", () => {
    const session = { token: "abc-123", profileId: 456, createdAt: Date.now() - 10 * 60 * 1000, ttlMs: 5 * 60 * 1000 };
    fs.writeFileSync(testSessionPath, JSON.stringify(session));
    const loaded = loadSession(testSessionPath);
    expect(loaded).toBeNull();
  });

  test("loadSession accepts session within custom TTL", () => {
    const session = { token: "abc-123", profileId: 456, createdAt: Date.now() - 3 * 60 * 1000, ttlMs: 5 * 60 * 1000 };
    fs.writeFileSync(testSessionPath, JSON.stringify(session));
    const loaded = loadSession(testSessionPath);
    expect(loaded).toEqual(session);
  });

  test("touchSession bumps createdAt", () => {
    const oldTime = Date.now() - 30 * 60 * 1000;
    const session = { token: "abc-123", profileId: 456, createdAt: oldTime };
    fs.writeFileSync(testSessionPath, JSON.stringify(session));
    touchSession(testSessionPath);
    const raw = JSON.parse(fs.readFileSync(testSessionPath, "utf-8"));
    expect(raw.createdAt).toBeGreaterThan(oldTime);
  });

  test("clearSession deletes the file", () => {
    fs.writeFileSync(testSessionPath, "{}");
    clearSession(testSessionPath);
    expect(fs.existsSync(testSessionPath)).toBe(false);
  });
});
