import { describe, it, expect, spyOn, beforeEach } from "bun:test";

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
    // Set up mock session via _setSecrets from auth module
    const { _setSecrets } = await import("./auth.js");
    _setSecrets({
      set: async () => {},
      get: async ({ name }: { service: string; name: string }) => {
        if (name === "session") return JSON.stringify({ apiKey: "testkey", apiSecret: "dGVzdHNlY3JldA==" });
        return null;
      },
      delete: async () => {},
    });

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
