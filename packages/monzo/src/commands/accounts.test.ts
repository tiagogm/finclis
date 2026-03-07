import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockMonzoGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { accountsListCommand } = await import("./accounts.js");

describe("accounts --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockMonzoGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs account array as JSON", async () => {
    const accounts = [
      { id: "acc_1", type: "uk_retail", description: "Current Account", created: "2020-01-01T00:00:00Z", closed: false },
      { id: "acc_2", type: "uk_retail_joint", description: "Joint Account", created: "2021-06-15T00:00:00Z", closed: false },
    ];
    mockMonzoGet.mockResolvedValueOnce({ accounts });

    await accountsListCommand({ json: true });

    expect(JSON.parse(stdout.getOutput())).toEqual(accounts);
  });
});
