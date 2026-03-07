import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockMonzoGet, mockRequireSession, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { whoamiCommand } = await import("./whoami.js");

describe("whoami --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockMonzoGet.mockReset();
    mockRequireSession.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs authenticated info as JSON", async () => {
    mockRequireSession.mockResolvedValueOnce({
      access_token: "tok",
      refresh_token: "ref",
      expires_at: 9999999999,
      account_id: "acc_abc",
    });
    mockMonzoGet.mockResolvedValueOnce({
      authenticated: true,
      client_id: "client_x",
      user_id: "user_123",
    });

    await whoamiCommand({ json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed).toEqual({
      authenticated: true,
      client_id: "client_x",
      user_id: "user_123",
      account_id: "acc_abc",
    });
  });
});
