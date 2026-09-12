# Vanguard `statement` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `vanguard statement --month YYYY-MM --json` producing the common `Statement` schema. Vanguard's `InvestmentMonthlyPerformance` endpoint (already used by `commands/summary.ts`) directly reports Opening/Closing **portfolio value** (cash + holdings) for a month — this is the one field Vanguard reports natively, so `balance.source = "reported"`. Per an explicit product decision, `balance` for this platform represents total portfolio value, not cash alone; a `cashBalance` field carries the current (not period-accurate) cash snapshot separately. There is no per-transaction data endpoint on this platform, so `transactions` is `null`.

**Architecture:** A pure mapper `buildVanguardStatement()` in a new `packages/vanguard/src/statement.ts` maps one month's row from the `InvestmentMonthlyPerformance` response (plus a current cash-balance snapshot) into a `Statement`. A new `packages/vanguard/src/commands/statement.ts` fetches both, reusing the exact endpoints already used by `commands/summary.ts` and `commands/balance.ts`.

**Tech Stack:** TypeScript, Commander, Bun test runner, `@finclis/cli-utils` (`Statement`, `resolveStatementPeriod`, `printStatement` — already merged to `main`). Note: this package's command layer has no existing unit tests (only `auth.test.ts`/`cache.test.ts`/`validate.test.ts` exist) — this plan introduces a `commands/__test-helpers.ts`, matching the pattern used in `monzo`/`wise`/`lloyds-cli`.

**Spec:** `docs/superpowers/specs/2026-09-12-unified-statement-command-design.md`

## Global Constraints

- `--month YYYY-MM` (default: current month), `--json`, `-v/--verbose`.
- Use `resolveStatementPeriod()` from `@finclis/cli-utils`, **not** this package's own `parseMonth`/`monthBounds` — it clamps the current in-progress month's end to today and rejects future months.
- `accountType = "investment"`, `balance.type = "portfolio"`, `balance.source = "reported"`.
- `notes` must include exactly these two strings: `"Balance is total portfolio value (cash + holdings), not cash alone."` and `"Cash balance is a current snapshot, not period-accurate — no historical cash-only endpoint exists."`.
- `transactions = null`, `transactionsAvailable = false`, `transactionCount = 0` — no per-transaction endpoint exists on this platform for this data.
- Currency is always `"GBP"` (Vanguard Investor UK).
- On any error: `handleJsonError(err)` under `--json`, else `console.error("Failed: " + err.message)` + `process.exit(0)` — matches `commands/summary.ts`/`commands/balance.ts`.

---

### Task 1: Pure statement mapper

**Files:**
- Create: `packages/vanguard/src/statement.ts`
- Test: `packages/vanguard/src/statement.test.ts`

**Interfaces:**
- Consumes: `Statement`, `StatementPeriod` from `@finclis/cli-utils`.
- Produces:
  ```ts
  export interface VanguardStatementInput {
    period: StatementPeriod;
    monthData: any;              // one entry from the InvestmentMonthlyPerformance array — { Month: string, PerformanceDetail: {...} } — or undefined if no data exists for the period
    cashBalanceAmount: number;
    today: string;                // "YYYY-MM-DD", used as cashBalance.asOf
  }

  export function buildVanguardStatement(input: VanguardStatementInput): Statement;
  ```
  Throws `Error("No performance data found for <period.month>")` when `monthData` is `undefined`.

- [ ] **Step 1: Write the failing test**

Create `packages/vanguard/src/statement.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildVanguardStatement } from "./statement.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function monthData(overrides: Partial<any> = {}) {
  return {
    Month: "Aug 2026",
    PerformanceDetail: {
      OpeningValue: { Amount: 10000 },
      ClosingValue: { Amount: 10500 },
      PaymentsIn: { Amount: 300 },
      PaymentsOut: { Amount: 50 },
      ...overrides,
    },
  };
}

describe("buildVanguardStatement", () => {
  it("uses reported opening/closing portfolio value", () => {
    const statement = buildVanguardStatement({
      period,
      monthData: monthData(),
      cashBalanceAmount: 250,
      today: "2026-09-12",
    });

    expect(statement.balance).toEqual({ opening: 10000, closing: 10500, type: "portfolio", source: "reported" });
    expect(statement.accountType).toBe("investment");
    expect(statement.currency).toBe("GBP");
  });

  it("maps PaymentsIn/PaymentsOut to credits/debits", () => {
    const statement = buildVanguardStatement({
      period,
      monthData: monthData(),
      cashBalanceAmount: 250,
      today: "2026-09-12",
    });

    expect(statement.credits).toBe(300);
    expect(statement.debits).toBe(50);
  });

  it("sets cashBalance as a current snapshot, and no transaction list", () => {
    const statement = buildVanguardStatement({
      period,
      monthData: monthData(),
      cashBalanceAmount: 250,
      today: "2026-09-12",
    });

    expect(statement.cashBalance).toEqual({ asOf: "2026-09-12", amount: 250 });
    expect(statement.transactions).toBeNull();
    expect(statement.transactionsAvailable).toBe(false);
    expect(statement.transactionCount).toBe(0);
  });

  it("includes both required notes", () => {
    const statement = buildVanguardStatement({
      period,
      monthData: monthData(),
      cashBalanceAmount: 250,
      today: "2026-09-12",
    });

    expect(statement.notes).toContain("Balance is total portfolio value (cash + holdings), not cash alone.");
    expect(statement.notes).toContain(
      "Cash balance is a current snapshot, not period-accurate — no historical cash-only endpoint exists."
    );
  });

  it("throws when no data exists for the requested period", () => {
    expect(() =>
      buildVanguardStatement({ period, monthData: undefined, cashBalanceAmount: 0, today: "2026-09-12" })
    ).toThrow("No performance data found for 2026-08");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vanguard && bun test statement.test.ts`
Expected: FAIL — `buildVanguardStatement` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/vanguard/src/statement.ts`:

```ts
import type { Statement, StatementPeriod } from "@finclis/cli-utils";

export interface VanguardStatementInput {
  period: StatementPeriod;
  monthData: any;
  cashBalanceAmount: number;
  today: string;
}

export function buildVanguardStatement(input: VanguardStatementInput): Statement {
  if (!input.monthData) {
    throw new Error(`No performance data found for ${input.period.month}`);
  }

  const d = input.monthData.PerformanceDetail ?? {};
  const opening = d.OpeningValue?.Amount ?? 0;
  const closing = d.ClosingValue?.Amount ?? 0;
  const deposits = d.PaymentsIn?.Amount ?? 0;
  const withdrawals = d.PaymentsOut?.Amount ?? 0;

  return {
    platform: "vanguard",
    account: { id: "vanguard-investor", name: "Vanguard Investor Account" },
    accountType: "investment",
    period: input.period,
    currency: "GBP",
    balance: { opening, closing, type: "portfolio", source: "reported" },
    cashBalance: { asOf: input.today, amount: input.cashBalanceAmount },
    credits: deposits,
    debits: withdrawals,
    transactionCount: 0,
    transactionsAvailable: false,
    transactions: null,
    notes: [
      "Balance is total portfolio value (cash + holdings), not cash alone.",
      "Cash balance is a current snapshot, not period-accurate — no historical cash-only endpoint exists.",
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/vanguard && bun test statement.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/vanguard/src/statement.ts packages/vanguard/src/statement.test.ts
git commit -m "feat(vanguard): add pure statement mapper"
```

---

### Task 2: `statement` command (I/O) + test helpers

**Files:**
- Create: `packages/vanguard/src/commands/statement.ts`
- Create: `packages/vanguard/src/commands/__test-helpers.ts`
- Test: `packages/vanguard/src/commands/statement.test.ts`

**Interfaces:**
- Consumes: `buildVanguardStatement` (Task 1); `vanguardGet`, `requireSession` from `../client.js`; `parseVanguardMonthLabel` from `../cache.js`; `resolveStatementPeriod`, `printStatement`, `writeJson`, `handleJsonError` from `@finclis/cli-utils`.
- Produces: `export async function statementCommand(opts?: StatementOpts): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `packages/vanguard/src/commands/__test-helpers.ts`:

```ts
import { mock } from "bun:test";

export const mockVanguardGet = mock(() => Promise.resolve({} as any));
export const mockRequireSession = mock(() => ({ hierarchyId: "hier_test123" }));

export function registerMocks() {
  mock.module("../client.js", () => ({
    vanguardGet: mockVanguardGet,
    vanguardPost: mock(() => Promise.resolve({})),
    requireSession: mockRequireSession,
    setVerbose: mock(() => {}),
    cleanup: mock(() => Promise.resolve()),
  }));
}

export function captureStdout() {
  let output = "";
  const original = process.stdout.write.bind(process.stdout);
  const install = () => {
    process.stdout.write = ((chunk: any) => { output += chunk.toString(); return true; }) as any;
  };
  install();
  return {
    getOutput: () => output,
    reset: () => { output = ""; install(); },
    restore: () => { process.stdout.write = original; },
  };
}
```

Create `packages/vanguard/src/commands/statement.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockVanguardGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockVanguardGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for a past month", async () => {
    mockVanguardGet.mockImplementation(async (url: string) => {
      if (url.includes("InvestmentMonthlyPerformance")) {
        return [
          {
            Month: "Aug 2026",
            PerformanceDetail: {
              OpeningValue: { Amount: 10000 },
              ClosingValue: { Amount: 10500 },
              PaymentsIn: { Amount: 300 },
              PaymentsOut: { Amount: 50 },
            },
          },
        ];
      }
      if (url.includes("CashBalance")) {
        return { Amount: 250 };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    await statementCommand({ month: "2026-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("vanguard");
    expect(parsed.period.month).toBe("2026-08");
    expect(parsed.balance).toEqual({ opening: 10000, closing: 10500, type: "portfolio", source: "reported" });
    expect(parsed.cashBalance.amount).toBe(250);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/vanguard && bun test commands/statement.test.ts`
Expected: FAIL — `commands/statement.ts` doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/vanguard/src/commands/statement.ts`:

```ts
import { vanguardGet, requireSession } from "../client.js";
import { parseVanguardMonthLabel } from "../cache.js";
import { buildVanguardStatement } from "../statement.js";
import { resolveStatementPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function findMonthData(months: any[], targetMonth: string): any | undefined {
  return months.find((m) => {
    const parsed = parseVanguardMonthLabel(m.Month ?? "");
    if (!parsed) return false;
    const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    return key === targetMonth;
  });
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  const session = requireSession();

  try {
    const monthStr = opts.month ?? currentMonthString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const period = resolveStatementPeriod(monthStr, todayStr);

    const hId = session.hierarchyId;
    const fromDate = `${period.start}T00:00:00.000Z`;
    const toDate = `${period.end}T23:59:59.999Z`;

    const [perfData, cashBalance] = await Promise.all([
      vanguardGet(
        `/en-GB/Api/Performance/InvestmentMonthlyPerformance/Get?hierarchyId=${hId}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`
      ),
      vanguardGet(`/en-GB/SubAccount/${hId}/Api/Portfolio/CashBalance/Get?hierarchyId=${hId}`),
    ]);

    const months: any[] = Array.isArray(perfData) ? perfData : [];
    const monthData = months.length === 1 ? months[0] : findMonthData(months, period.month);

    const statement = buildVanguardStatement({
      period,
      monthData,
      cashBalanceAmount: cashBalance.Amount ?? 0,
      today: todayStr,
    });

    if (opts.json) {
      writeJson(statement);
      return;
    }
    printStatement(statement);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/vanguard && bun test commands/statement.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/vanguard/src/commands/statement.ts packages/vanguard/src/commands/__test-helpers.ts packages/vanguard/src/commands/statement.test.ts
git commit -m "feat(vanguard): add statement command"
```

---

### Task 3: Register the command

**Files:**
- Modify: `packages/vanguard/src/index.ts`

- [ ] **Step 1: Add the import and command registration**

Add near the other command imports:

```ts
import { statementCommand } from "./commands/statement.js";
```

Add after the existing `summary` command block:

```ts
program
  .command("statement")
  .description("Standard statement-style report for a month (portfolio value, not cash alone)")
  .option("--month <YYYY-MM>", "Month to report on (default: current)")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .addHelpText("after", "\nExamples:\n  vanguard statement --month 2026-08\n  vanguard statement --month 2026-08 --json")
  .action(statementCommand);
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/vanguard && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full vanguard test suite**

Run: `cd packages/vanguard && bun test`
Expected: all tests pass (existing + the 6 new ones).

- [ ] **Step 4: Commit**

```bash
git add packages/vanguard/src/index.ts
git commit -m "feat(vanguard): register statement command"
```

## Manual verification (for the human to run — requires a live Vanguard browser session)

```bash
cd packages/vanguard
bun src/index.ts statement --month <a-recent-YYYY-MM>
bun src/index.ts statement --month <a-recent-YYYY-MM> --json | jq .
```

Confirm: `balance.opening`/`balance.closing` match what `bun src/index.ts summary --month <same>` reports; `cashBalance.amount` roughly matches the "Cash" line from `bun src/index.ts balance` (won't be exact if it's a past month — that field is explicitly a *current* snapshot, not period-accurate, per the notes array).
