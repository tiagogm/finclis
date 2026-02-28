import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, mockRequireSession, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { whoamiCommand } = await import("./whoami.js");

describe("whoami --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
    mockRequireSession.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs raw JSON when --json flag is set", async () => {
    const profiles = [
      { id: 123, type: "PERSONAL", details: { firstName: "Test", lastName: "User" } },
    ];
    mockWiseGet.mockResolvedValueOnce(profiles);
    mockRequireSession.mockReturnValueOnce({
      token: "tok", profileId: 123, createdAt: Date.now(),
    });

    await whoamiCommand({ json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.profiles).toEqual(profiles);
    expect(parsed.profileId).toBe(123);
  });
});
