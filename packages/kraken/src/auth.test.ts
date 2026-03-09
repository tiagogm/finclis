import { describe, it, expect, mock, beforeEach } from "bun:test";
import { saveSession, loadSession, clearSession, _setSecrets, type KrakenSession } from "./auth.js";

// Mock Bun.secrets via the injectable store
const mockSecrets = new Map<string, string>();
_setSecrets({
  set: mock(async ({ name, value }: { service: string; name: string; value: string }) => {
    mockSecrets.set(name, value);
  }),
  get: mock(async ({ name }: { service: string; name: string }) => {
    return mockSecrets.get(name) ?? null;
  }),
  delete: mock(async ({ name }: { service: string; name: string }) => {
    mockSecrets.delete(name);
  }),
});

describe("saveSession / loadSession", () => {
  beforeEach(() => {
    mockSecrets.clear();
  });

  it("saves and loads a valid session", async () => {
    const session: KrakenSession = { apiKey: "mykey", apiSecret: "mysecret" };
    await saveSession(session);
    const loaded = await loadSession();
    expect(loaded).toEqual(session);
  });

  it("returns null when no session stored", async () => {
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });

  it("returns null for invalid session shape", async () => {
    mockSecrets.set("session", JSON.stringify({ apiKey: 123 }));
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });
});

describe("clearSession", () => {
  it("removes the stored session", async () => {
    const session: KrakenSession = { apiKey: "k", apiSecret: "s" };
    await saveSession(session);
    await clearSession();
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });
});
