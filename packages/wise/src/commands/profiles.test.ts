import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { profilesCommand } = await import("./profiles.js");

describe("profiles --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs raw JSON when --json flag is set", async () => {
    const profiles = [
      { id: 123, type: "PERSONAL", details: { firstName: "Test", lastName: "User" } },
      { id: 456, type: "BUSINESS", details: { name: "Test Corp" } },
    ];
    mockWiseGet.mockResolvedValueOnce(profiles);

    await profilesCommand({ json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed).toEqual(profiles);
    expect(parsed).toHaveLength(2);
  });
});
