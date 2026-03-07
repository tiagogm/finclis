import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockMonzoGet, mockMonzoPut, mockRequireSession, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { potsCommand, potsDepositCommand } = await import("./pots.js");

describe("pots --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockMonzoGet.mockReset();
    mockRequireSession.mockReset();
  });

  afterEach(() => stdout.restore());

  it("filters deleted pots and outputs active ones", async () => {
    mockRequireSession.mockResolvedValueOnce({
      access_token: "tok",
      refresh_token: "ref",
      expires_at: 9999999999,
      account_id: "acc_test",
      client_id: "client_x",
      client_secret: "secret_x",
    });
    mockMonzoGet.mockResolvedValueOnce({
      pots: [
        { id: "pot_1", name: "Savings", balance: 50000, currency: "GBP", deleted: false },
        { id: "pot_2", name: "Old Pot", balance: 0, currency: "GBP", deleted: true },
        { id: "pot_3", name: "Holiday", balance: 25000, currency: "GBP", deleted: false },
      ],
    });

    await potsCommand({ json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe("pot_1");
    expect(parsed[1].id).toBe("pot_3");
  });
});

describe("pots deposit --yes", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockMonzoGet.mockReset();
    mockMonzoPut.mockReset();
    mockRequireSession.mockReset();
  });

  afterEach(() => stdout.restore());

  it("calls monzoPut with correct pence conversion", async () => {
    mockRequireSession.mockResolvedValueOnce({
      access_token: "tok",
      refresh_token: "ref",
      expires_at: 9999999999,
      account_id: "acc_test",
      client_id: "client_x",
      client_secret: "secret_x",
    });
    // getPotName calls monzoGet
    mockMonzoGet.mockResolvedValueOnce({
      pots: [{ id: "pot_1", name: "Savings" }],
    });
    mockMonzoPut.mockResolvedValueOnce({ balance: 15050, currency: "GBP" });

    await potsDepositCommand("pot_1", "10.50", { yes: true });

    expect(mockMonzoPut).toHaveBeenCalledTimes(1);
    const [path, params] = mockMonzoPut.mock.calls[0];
    expect(path).toBe("/pots/pot_1/deposit");
    expect(params.source_account_id).toBe("acc_test");
    expect(params.amount).toBe("1050");
  });
});
