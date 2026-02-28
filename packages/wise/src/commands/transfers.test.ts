import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { transfersCommand } = await import("./transfers.js");

describe("transfers --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs raw transfers JSON when --json flag is set", async () => {
    const transfers = [
      {
        id: 123, created: "2026-01-15 10:00:00",
        sourceValue: 100, sourceCurrency: "GBP",
        targetValue: 116.50, targetCurrency: "EUR",
        status: "funds_converted",
      },
      {
        id: 124, created: "2026-01-10 09:00:00",
        sourceValue: 50, sourceCurrency: "GBP",
        targetValue: 58.25, targetCurrency: "EUR",
        status: "outgoing_payment_sent",
      },
    ];
    mockWiseGet.mockResolvedValueOnce(transfers);

    await transfersCommand({ json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed).toEqual(transfers);
    expect(parsed).toHaveLength(2);
  });
});
