# Trading212 `statement` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `trading212 statement --month YYYY-MM --json` producing the common `Statement` schema. Trading212 has no point-in-time balance endpoint, so `balance` tracks **uninvested cash only** (`/equity/account/cash`'s `free` field) — not the invested/total value — derived by walking back from the current cash balance using the CSV export's deposit/withdrawal/interest/dividend rows.

**Architecture:** A pure mapper `buildTrading212Statement()` in a new `packages/trading212/src/statement.ts` takes already-fetched/filtered CSV transaction rows and returns a `Statement`. A new `packages/trading212/src/commands/statement.ts` reuses the existing async CSV-export machinery (`fetchCSV()`, already implemented in `commands/summary.ts` for the polling/caching dance — exported in Task 2 for reuse) plus `parseTransactionsCSV()` from `../csv.js`.

**Tech Stack:** TypeScript, Commander, Bun test runner, `@finclis/cli-utils` (`Statement`, `resolveStatementPeriod`, `deriveClosingBalance`, `deriveOpeningBalance`, `printStatement` — already merged to `main`).

**Spec:** `docs/superpowers/specs/2026-09-12-unified-statement-command-design.md`

## Global Constraints

- `--month YYYY-MM` (default: current month), `--json`, `-v/--verbose`.
- Use `resolveStatementPeriod()` from `@finclis/cli-utils`, **not** this package's own `parseMonth`/`monthBounds` — it clamps the current in-progress month's end to today and rejects future months (already fixed at the `cli-utils` level, applied to every other platform's statement command).
- `balance.type = "cash"`, `balance.source = "derived"`. `accountType = "investment"`. `notes` must include `"Excludes invested capital and unrealized P&L"`.
- **Error handling differs from other packages in this rollout**: `trading212`'s existing convention (see `commands/summary.ts`) uses `process.exit(1)` on failure, not `process.exit(0)`. Match that, not the monzo/wise/lloyds convention.
- The CSV export takes ~15–30s per call (Trading212 generates it asynchronously and this command polls for it) — this is expected, inherited, unavoidable behavior; do not try to work around it.
- CSV transaction dates arrive as `"YYYY-MM-DD HH:MM:SS"` or ISO — the first 10 characters are always `"YYYY-MM-DD"` in both cases, so use `.slice(0, 10)` string comparison for date bucketing rather than parsing full `Date` objects (simpler, avoids timezone-parsing edge cases, and lexical `YYYY-MM-DD` comparison is chronologically correct).

---

### Task 1: Pure statement mapper

**Files:**
- Create: `packages/trading212/src/statement.ts`
- Test: `packages/trading212/src/statement.test.ts`

**Interfaces:**
- Consumes: `CSVTx` type from `./csv.js` (already defined — `{ date: string; amount: number; action: string; type: "deposit" | "withdrawal" | "interest" | "dividend" | "other" }`); `deriveClosingBalance`, `deriveOpeningBalance`, `Statement`, `StatementPeriod`, `StatementTransaction` from `@finclis/cli-utils`.
- Produces:
  ```ts
  export interface Trading212StatementInput {
    period: StatementPeriod;
    currency: string;
    periodTxns: CSVTx[];       // transactions with date in [period.start, period.end]
    afterPeriodTxns: CSVTx[];  // transactions with date after period.end, up to today
    currentCashFree: number;   // current `free` cash balance (major units)
  }

  export function buildTrading212Statement(input: Trading212StatementInput): Statement;
  ```

- [ ] **Step 1: Write the failing test**

Create `packages/trading212/src/statement.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildTrading212Statement } from "./statement.js";
import type { CSVTx } from "./csv.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function tx(overrides: Partial<CSVTx> = {}): CSVTx {
  return { date: "2026-08-05 10:00:00", amount: 100, action: "Deposit", type: "deposit", ...overrides };
}

describe("buildTrading212Statement", () => {
  it("derives closing from current cash and flows since period end", () => {
    const statement = buildTrading212Statement({
      period,
      currency: "GBP",
      periodTxns: [tx({ amount: 500, type: "deposit" }), tx({ amount: -50, action: "Withdrawal", type: "withdrawal" })],
      afterPeriodTxns: [tx({ date: "2026-09-05 10:00:00", amount: 20, type: "deposit" })],
      currentCashFree: 1000,
    });

    // closing = 1000 - 20 (flow after period end) = 980
    expect(statement.balance.closing).toBe(980);
    // opening = closing - netFlowDuringPeriod(500 - 50 = 450) = 530
    expect(statement.balance.opening).toBe(530);
    expect(statement.balance.type).toBe("cash");
    expect(statement.balance.source).toBe("derived");
    expect(statement.accountType).toBe("investment");
  });

  it("sums deposits/interest/dividends as credits and withdrawals as debits", () => {
    const statement = buildTrading212Statement({
      period,
      currency: "GBP",
      periodTxns: [
        tx({ amount: 500, type: "deposit" }),
        tx({ amount: 12.5, action: "Interest", type: "interest" }),
        tx({ amount: 8, action: "Dividend", type: "dividend" }),
        tx({ amount: -50, action: "Withdrawal", type: "withdrawal" }),
      ],
      afterPeriodTxns: [],
      currentCashFree: 1000,
    });

    expect(statement.credits).toBeCloseTo(520.5, 2);
    expect(statement.debits).toBe(50);
    expect(statement.transactionCount).toBe(4);
  });

  it("maps each transaction with direction and includes the excludes-invested-capital note", () => {
    const statement = buildTrading212Statement({
      period,
      currency: "GBP",
      periodTxns: [tx({ date: "2026-08-05 10:00:00", amount: -50, action: "Withdrawal", type: "withdrawal" })],
      afterPeriodTxns: [],
      currentCashFree: 1000,
    });

    expect(statement.transactions).toEqual([
      { date: "2026-08-05", amount: 50, direction: "debit", description: "Withdrawal", currency: "GBP" },
    ]);
    expect(statement.notes).toContain("Excludes invested capital and unrealized P&L");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/trading212 && bun test statement.test.ts`
Expected: FAIL — `buildTrading212Statement` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/trading212/src/statement.ts`:

```ts
import { deriveClosingBalance, deriveOpeningBalance, type Statement, type StatementPeriod, type StatementTransaction } from "@finclis/cli-utils";
import type { CSVTx } from "./csv.js";

export interface Trading212StatementInput {
  period: StatementPeriod;
  currency: string;
  periodTxns: CSVTx[];
  afterPeriodTxns: CSVTx[];
  currentCashFree: number;
}

function netFlow(txns: CSVTx[]): { credits: number; debits: number } {
  let credits = 0;
  let debits = 0;
  for (const t of txns) {
    if (t.type === "withdrawal") debits += Math.abs(t.amount);
    else credits += t.amount; // deposit, interest, dividend
  }
  return { credits, debits };
}

function toStatementTransaction(t: CSVTx, currency: string): StatementTransaction {
  return {
    date: t.date.slice(0, 10),
    amount: Math.abs(t.amount),
    direction: t.type === "withdrawal" ? "debit" : "credit",
    description: t.action,
    currency,
  };
}

export function buildTrading212Statement(input: Trading212StatementInput): Statement {
  const { credits, debits } = netFlow(input.periodTxns);
  const after = netFlow(input.afterPeriodTxns);
  const flowsSincePeriodEnd = after.credits - after.debits;

  const closing = deriveClosingBalance(input.currentCashFree, flowsSincePeriodEnd);
  const opening = deriveOpeningBalance(closing, credits - debits);

  return {
    platform: "trading212",
    account: { id: "trading212-cash", name: "Trading212 Cash" },
    accountType: "investment",
    period: input.period,
    currency: input.currency,
    balance: { opening, closing, type: "cash", source: "derived" },
    cashBalance: null,
    credits,
    debits,
    transactionCount: input.periodTxns.length,
    transactionsAvailable: true,
    transactions: input.periodTxns.map((t) => toStatementTransaction(t, input.currency)),
    notes: ["Excludes invested capital and unrealized P&L"],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/trading212 && bun test statement.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/trading212/src/statement.ts packages/trading212/src/statement.test.ts
git commit -m "feat(trading212): add pure statement mapper"
```

---

### Task 2: Export `fetchCSV` for reuse, then add the `statement` command (I/O)

**Files:**
- Modify: `packages/trading212/src/commands/summary.ts` (export `fetchCSV`)
- Create: `packages/trading212/src/commands/statement.ts`
- Create: `packages/trading212/src/commands/__test-helpers.ts` (this package's command layer has no existing unit tests)
- Test: `packages/trading212/src/commands/statement.test.ts`

**Interfaces:**
- Consumes: `fetchCSV` (from `./summary.js`, made exportable in Step 1 below); `parseTransactionsCSV` from `../csv.js`; `t212Get` from `../client.js`; `buildTrading212Statement` (Task 1); `resolveStatementPeriod`, `printStatement`, `writeJson`, `handleJsonError` from `@finclis/cli-utils`.
- Produces: `export async function statementCommand(opts?: StatementOpts): Promise<void>`.

- [ ] **Step 1: Export `fetchCSV` from `summary.ts`**

In `packages/trading212/src/commands/summary.ts`, change the line:

```ts
async function fetchCSV(fromDate: string, toDate: string): Promise<string> {
```

to:

```ts
export async function fetchCSV(fromDate: string, toDate: string): Promise<string> {
```

No other change to that file. Run `cd packages/trading212 && bunx tsc --noEmit` to confirm this alone doesn't break anything, then commit:

```bash
git add packages/trading212/src/commands/summary.ts
git commit -m "refactor(trading212): export fetchCSV for reuse by statement command"
```

- [ ] **Step 2: Write the failing test**

Create `packages/trading212/src/commands/__test-helpers.ts`:

```ts
import { mock } from "bun:test";

export const mockT212Get = mock(() => Promise.resolve({} as any));
export const mockFetchCSV = mock(() => Promise.resolve("" as string));

export function registerMocks() {
  mock.module("../client.js", () => ({
    t212Get: mockT212Get,
    t212Post: mock(() => Promise.resolve({})),
    t212Download: mock(() => Promise.resolve("")),
    t212GetAll: mock(() => Promise.resolve([])),
    setVerbose: mock(() => {}),
    getEnv: mock(() => Promise.resolve("live")),
  }));

  mock.module("./summary.js", () => ({
    fetchCSV: mockFetchCSV,
    summaryCommand: mock(() => Promise.resolve()),
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

Create `packages/trading212/src/commands/statement.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockT212Get, mockFetchCSV, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

const SAMPLE_CSV = [
  "Action,Time,Total",
  "Deposit,2026-08-05 10:00:00,500.00",
  "Withdrawal,2026-08-10 10:00:00,-50.00",
].join("\n");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockT212Get.mockReset();
    mockFetchCSV.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for a past month", async () => {
    mockFetchCSV.mockResolvedValue(SAMPLE_CSV);
    mockT212Get.mockImplementation(async (path: string) => {
      if (path === "/equity/account/cash") return { free: 1000, invested: 0, total: 1000, ppl: 0 };
      if (path === "/equity/account/info") return { currencyCode: "GBP" };
      throw new Error(`Unexpected path: ${path}`);
    });

    await statementCommand({ month: "2026-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("trading212");
    expect(parsed.period.month).toBe("2026-08");
    expect(parsed.transactionCount).toBe(2);
    expect(parsed.credits).toBe(500);
    expect(parsed.debits).toBe(50);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/trading212 && bun test commands/statement.test.ts`
Expected: FAIL — `commands/statement.ts` doesn't exist.

- [ ] **Step 4: Write minimal implementation**

Create `packages/trading212/src/commands/statement.ts`:

```ts
import { t212Get } from "../client.js";
import { fetchCSV } from "./summary.js";
import { parseTransactionsCSV } from "../csv.js";
import { buildTrading212Statement } from "../statement.js";
import { resolveStatementPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  try {
    const monthStr = opts.month ?? currentMonthString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const period = resolveStatementPeriod(monthStr, todayStr);

    const fromDate = `${period.start}T00:00:00.000Z`;
    const toDate = `${todayStr}T23:59:59.999Z`;

    const csvContent = await fetchCSV(fromDate, toDate);
    const allTxns = parseTransactionsCSV(csvContent);

    const periodTxns = allTxns.filter((t) => {
      const d = t.date.slice(0, 10);
      return d >= period.start && d <= period.end;
    });
    const afterPeriodTxns = allTxns.filter((t) => t.date.slice(0, 10) > period.end);

    const [cash, accountInfo] = await Promise.all([
      t212Get("/equity/account/cash"),
      t212Get("/equity/account/info"),
    ]);
    const currency: string = accountInfo.currencyCode ?? "GBP";

    const statement = buildTrading212Statement({
      period,
      currency,
      periodTxns,
      afterPeriodTxns,
      currentCashFree: cash.free,
    });

    if (opts.json) {
      writeJson(statement);
      return;
    }
    printStatement(statement);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/trading212 && bun test commands/statement.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add packages/trading212/src/commands/statement.ts packages/trading212/src/commands/__test-helpers.ts packages/trading212/src/commands/statement.test.ts
git commit -m "feat(trading212): add statement command"
```

---

### Task 3: Register the command

**Files:**
- Modify: `packages/trading212/src/index.ts`

- [ ] **Step 1: Add the import and command registration**

Add the import near the other command imports (check the existing file for the exact pattern — commands are registered directly on `program`, and `history export` reuses `summaryCommand` as its action, per `commands/history.ts`).

```ts
import { statementCommand } from "./commands/statement.js";
```

Register a new top-level command:

```ts
program
  .command("statement")
  .description("Standard bank-statement-style report for a month (cash balance only)")
  .option("--month <YYYY-MM>", "Month to report on (default: current)")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .addHelpText("after", "\nExamples:\n  trading212 statement --month 2026-08\n  trading212 statement --month 2026-08 --json")
  .action(statementCommand);
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/trading212 && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full trading212 test suite**

Run: `cd packages/trading212 && bun test`
Expected: all tests pass (existing + the 4 new ones).

- [ ] **Step 4: Commit**

```bash
git add packages/trading212/src/index.ts
git commit -m "feat(trading212): register statement command"
```

## Manual verification (for the human to run — requires a live Trading212 API key)

```bash
cd packages/trading212
bun src/index.ts statement --month <a-recent-YYYY-MM>   # expect a ~15-30s wait for the CSV export
bun src/index.ts statement --month <a-recent-YYYY-MM> --json | jq .
```

Confirm: `credits`/`debits`/`transactionCount` roughly match `bun src/index.ts history export --month <same> --json`; `balance.closing` for the current month is close to `bun src/index.ts cash`'s `free` value (won't be exact if a trade or fee posted between the two calls — that's expected, not a bug, since only external deposits/withdrawals are tracked, not trading activity).
