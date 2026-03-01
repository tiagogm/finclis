import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementsCommand } = await import("./statements.js");

describe("statements --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs full statement object as JSON", async () => {
    const balances = [
      { id: 42, currency: "GBP", type: "STANDARD", amount: { value: 1000, currency: "GBP" } },
    ];
    const statement = {
      accountHolder: { type: "PERSONAL", firstName: "Test", lastName: "User" },
      transactions: [
        { date: "2026-01-15T10:00:00Z", amount: { value: -3.50, currency: "GBP" },
          details: { type: "CARD", description: "Coffee shop" } },
      ],
    };
    mockWiseGet
      .mockResolvedValueOnce(balances)
      .mockResolvedValueOnce(statement);

    await statementsCommand({ currency: "GBP", from: "2026-01-01", to: "2026-01-31", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.accountHolder.firstName).toBe("Test");
  });
});
