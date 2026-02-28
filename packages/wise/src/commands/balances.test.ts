import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { balancesCommand } = await import("./balances.js");

describe("balances --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs raw JSON when --json flag is set", async () => {
    const balances = [
      { id: 1, type: "STANDARD", currency: "GBP", amount: { value: 1000.50, currency: "GBP" } },
      { id: 2, type: "STANDARD", currency: "EUR", amount: { value: 500.00, currency: "EUR" } },
    ];
    mockWiseGet.mockResolvedValueOnce(balances);

    await balancesCommand({ json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed).toEqual(balances);
    expect(parsed[0].amount.value).toBe(1000.50);
  });
});
