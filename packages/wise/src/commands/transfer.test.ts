import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { transferCommand } = await import("./transfer.js");

describe("transfer --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs raw transfer JSON when --json flag is set", async () => {
    const transfer = {
      id: 12345,
      status: "funds_converted",
      sourceValue: 100,
      sourceCurrency: "GBP",
      targetValue: 116.50,
      targetCurrency: "EUR",
      rate: 1.1650,
      created: "2026-01-15 10:00:00",
      targetAccount: 67890,
      details: { reference: "Invoice 001" },
    };
    mockWiseGet.mockResolvedValueOnce(transfer);

    await transferCommand("12345", { json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed).toEqual(transfer);
    expect(parsed.id).toBe(12345);
  });
});
