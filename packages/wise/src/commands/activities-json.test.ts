import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { activitiesCommand } = await import("./activities.js");

describe("activities --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs all activities as JSON with --from and --to", async () => {
    const activities = [
      { id: "1", type: "CARD_PAYMENT", status: "COMPLETED", title: "Coffee",
        primaryAmount: "3.50 GBP", createdOn: "2026-01-15T10:00:00Z" },
    ];
    mockWiseGet.mockResolvedValueOnce({ activities, cursor: null });

    await activitiesCommand({
      json: true,
      from: "2026-01-01",
      to: "2026-01-31",
      status: "COMPLETED",
    });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("1");
  });

  it("auto-paginates when cursor is present", async () => {
    const page1 = [{ id: "1", type: "CARD_PAYMENT", status: "COMPLETED", title: "Coffee",
      primaryAmount: "3.50 GBP", createdOn: "2026-01-15T10:00:00Z" }];
    const page2 = [{ id: "2", type: "TRANSFER", status: "COMPLETED", title: "Transfer",
      primaryAmount: "100 GBP", createdOn: "2026-01-16T10:00:00Z" }];

    mockWiseGet
      .mockResolvedValueOnce({ activities: page1, cursor: "cursor123" })
      .mockResolvedValueOnce({ activities: page2, cursor: null });

    await activitiesCommand({ json: true, from: "2026-01-01", to: "2026-01-31" });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed).toHaveLength(2);
  });
});
