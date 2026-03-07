import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockMonzoGet, mockRequireSession, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { balanceCommand } = await import("./balance.js");

describe("balance --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockMonzoGet.mockReset();
    mockRequireSession.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs raw balance data as JSON", async () => {
    const balanceData = {
      balance: 150000,
      total_balance: 200000,
      currency: "GBP",
      spend_today: -1500,
    };

    mockRequireSession.mockResolvedValueOnce({
      access_token: "tok",
      refresh_token: "ref",
      expires_at: 9999999999,
      account_id: "acc_test",
      client_id: "client_x",
      client_secret: "secret_x",
    });
    mockMonzoGet.mockResolvedValueOnce(balanceData);

    await balanceCommand({ json: true });

    expect(JSON.parse(stdout.getOutput())).toEqual(balanceData);
  });
});
