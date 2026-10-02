import { describe, it, expect } from "bun:test";
import { parseTransactionsCSV } from "./csv.js";

describe("parseTransactionsCSV", () => {
  it("normalizes 'YYYY-MM-DD HH:mm:ss' dates to ISO", () => {
    const csv = ["Action,Time,Total", "Deposit,2026-08-05 10:00:00,500.00"].join("\n");
    expect(parseTransactionsCSV(csv)).toEqual([
      { date: "2026-08-05T10:00:00.000Z", amount: 500, action: "Deposit", type: "deposit" },
    ]);
  });

  it("handles 'Time (UTC)' header suffix with DD/MM/YYYY dates", () => {
    const csv = [
      "Action,Time (UTC),Total",
      "Deposit,05/08/2026 10:00:00,500.00",
      "Withdrawal,31/08/2026 23:59:59,-50.00",
    ].join("\n");
    const txns = parseTransactionsCSV(csv);
    expect(txns.map((t) => t.date)).toEqual([
      "2026-08-05T10:00:00.000Z",
      "2026-08-31T23:59:59.000Z",
    ]);
    expect(txns[1]!.type).toBe("withdrawal");
  });

  it("normalizes ISO timestamps with T and Z", () => {
    const csv = ["Action,Time,Total", "Interest,2026-08-05T10:00:00.000Z,1.50"].join("\n");
    const txns = parseTransactionsCSV(csv);
    expect(txns[0]!.date).toBe("2026-08-05T10:00:00.000Z");
    expect(txns[0]!.type).toBe("interest");
  });

  it("strips a BOM from the header row", () => {
    const csv = ["\uFEFFAction,Time,Total", "Deposit,2026-08-05 10:00:00,10.00"].join("\n");
    expect(parseTransactionsCSV(csv)).toHaveLength(1);
  });

  it("keeps unparseable dates as-is so downstream can skip them", () => {
    const csv = ["Action,Time,Total", "Deposit,not-a-date,10.00"].join("\n");
    expect(parseTransactionsCSV(csv)[0]!.date).toBe("not-a-date");
  });
});
