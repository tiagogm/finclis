import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { ratesCommand } = await import("./rates.js");

describe("rates --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs raw rates JSON when --json flag is set", async () => {
    const rates = [
      { source: "GBP", target: "EUR", rate: 1.1650, time: "2026-01-15T10:00:00Z" },
    ];
    mockWiseGet.mockResolvedValueOnce(rates);

    await ratesCommand("GBP", "EUR", { json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed).toEqual(rates);
    expect(parsed[0].rate).toBe(1.1650);
  });
});
