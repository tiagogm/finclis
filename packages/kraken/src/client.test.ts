import { describe, it, expect, mock, beforeEach } from "bun:test";

describe("signRequest", () => {
  it("produces correct HMAC-SHA512 signature for known Kraken test vector", async () => {
    const { signRequest } = await import("./client.js");
    // From Kraken official auth docs example
    const apiSecret = "kQH5HW/8p1uGOVjbgWA7FunAmGO8lsSUXNsu3eow76sz84Q18fWxnyRzBHCd3pd5nE9qa99HAZtuZuj6F1huXg==";
    const uriPath = "/0/private/AddOrder";
    const nonce = "1616492376594";
    const postData = `nonce=${nonce}&ordertype=limit&pair=XBTUSD&price=37500&type=buy&volume=1.25`;

    const sig = signRequest(uriPath, nonce, postData, apiSecret);
    expect(sig).toBe("4/dpxb3iT4tp/ZCVEwSnEsLxx0bqyhLpdfOpc6fn7OR8+UClSV5n9E6aSS8MPtnRfp32bAb0nmbRn6H8ndwLUQ==");
  });
});

describe("krakenPrivatePost", () => {
  it("throws with Kraken error message on error array response", async () => {
    mock.module("./auth.js", () => ({
      API_URL: "https://api.kraken.com",
      loadCredentials: mock(() => Promise.resolve({ apiKey: "testkey", apiSecret: "dGVzdHNlY3JldA==" })),
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: ["EGeneral:Invalid arguments"], result: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const { krakenPrivatePost } = await import("./client.js");
    await expect(krakenPrivatePost("/0/private/Balance", {})).rejects.toThrow("EGeneral:Invalid arguments");

    globalThis.fetch = originalFetch;
  });

  it("throws nonce hint for EAPI:Invalid nonce error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: ["EAPI:Invalid nonce"], result: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const { krakenPrivatePost } = await import("./client.js");
    await expect(krakenPrivatePost("/0/private/Balance", {})).rejects.toThrow("Nonce out of order");

    globalThis.fetch = originalFetch;
  });
});

describe("OTP disk cache", () => {
  beforeEach(() => {
    delete process.env.KRAKEN_OTP;
  });

  it("reads OTP from Bun.secrets when no env var or in-process cache", async () => {
    const originalSecrets = globalThis.Bun.secrets;
    const promptMock = mock(() => Promise.resolve("unused"));

    mock.module("./auth.js", () => ({
      API_URL: "https://api.kraken.com",
      loadCredentials: mock(() =>
        Promise.resolve({ apiKey: "testkey", apiSecret: "dGVzdHNlY3JldA==", twoFactor: true }),
      ),
      prompt: promptMock,
    }));

    globalThis.Bun.secrets = {
      get: mock(() => Promise.resolve("cached-otp-from-disk")),
      set: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve()),
    } as any;

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: [], result: { balance: "100" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const { krakenPrivatePost } = await import("./client.js");
    const result = await krakenPrivatePost("/0/private/Balance", {});
    expect(result).toEqual({ balance: "100" });
    expect(promptMock).not.toHaveBeenCalled();

    globalThis.Bun.secrets = originalSecrets;
  });

  it("clears disk cache and retries on EAPI:Invalid signature", async () => {
    const originalSecrets = globalThis.Bun.secrets;
    const deleteMock = mock(() => Promise.resolve());
    let callCount = 0;

    mock.module("./auth.js", () => ({
      API_URL: "https://api.kraken.com",
      loadCredentials: mock(() =>
        Promise.resolve({ apiKey: "testkey", apiSecret: "dGVzdHNlY3JldA==", twoFactor: true }),
      ),
      prompt: mock(() => Promise.resolve("fresh-otp")),
    }));

    globalThis.Bun.secrets = {
      get: mock(() => Promise.resolve("stale-otp")),
      set: mock(() => Promise.resolve()),
      delete: deleteMock,
    } as any;

    globalThis.fetch = async () => {
      callCount++;
      const error = callCount === 1 ? ["EAPI:Invalid signature"] : [];
      const result = callCount === 1 ? {} : { balance: "50" };
      return new Response(JSON.stringify({ error, result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const { krakenPrivatePost } = await import("./client.js");
    const result = await krakenPrivatePost("/0/private/Balance", {});
    expect(result).toEqual({ balance: "50" });
    expect(callCount).toBe(2);
    expect(deleteMock).toHaveBeenCalled();

    globalThis.Bun.secrets = originalSecrets;
  });

  it("env var KRAKEN_OTP always wins over disk cache", async () => {
    process.env.KRAKEN_OTP = "env-otp";
    const originalSecrets = globalThis.Bun.secrets;
    const getMock = mock(() => Promise.resolve("disk-otp"));

    mock.module("./auth.js", () => ({
      API_URL: "https://api.kraken.com",
      loadCredentials: mock(() =>
        Promise.resolve({ apiKey: "testkey", apiSecret: "dGVzdHNlY3JldA==", twoFactor: true }),
      ),
      prompt: mock(() => Promise.resolve("prompt-otp")),
    }));

    globalThis.Bun.secrets = {
      get: getMock,
      set: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve()),
    } as any;

    let capturedBody = "";
    globalThis.fetch = async (url: any, init: any) => {
      capturedBody = init?.body ?? "";
      return new Response(JSON.stringify({ error: [], result: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const { krakenPrivatePost } = await import("./client.js");
    await krakenPrivatePost("/0/private/Balance", {});
    expect(capturedBody).toContain("otp=env-otp");
    expect(getMock).not.toHaveBeenCalled();

    globalThis.Bun.secrets = originalSecrets;
    delete process.env.KRAKEN_OTP;
  });
});
