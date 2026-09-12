# Lloyds `statement` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `lloyds statement --month YYYY-MM --json` producing the common `Statement` schema. Lloyds is the highest-fidelity platform: each raw transaction already carries a running `balance` field, so opening/closing balance come directly from the first/last transaction of the month rather than an estimate.

**Architecture:** A pure mapper `buildLloydsStatement()` added to the existing `packages/lloyds-cli/src/aggregator.ts` (which already has the closely related `buildFinancialSummary()` — same file, same responsibility: turning raw Lloyds transaction data into a normalized report). A new `packages/lloyds-cli/src/commands/statement.ts` reuses `getClient()`/`requireSession()` and the existing transaction cache (`readCachedTransactions`/`writeCachedTransactions`), following the same shape as `commands/summary.ts`.

**Tech Stack:** TypeScript, Commander, Bun test runner, `@finclis/cli-utils` (`Statement`, `monthToPeriod`, `printStatement` — already merged to `main`). Note: this package's command layer has no existing unit tests (only `auth.test.ts`/`validate.test.ts` exist) — this plan introduces a `commands/__test-helpers.ts` mocking module, matching the pattern already used in `monzo`/`wise`.

**Spec:** `docs/superpowers/specs/2026-09-12-unified-statement-command-design.md`

## Global Constraints

- `--month YYYY-MM` (default: current month) — note this is a **different format** from the existing `summary`/`transactions` commands' `--month MM-YYYY`. Do not reuse `validate.ts`'s `parseMonth` for this command; use `monthToPeriod` from `@finclis/cli-utils` instead, whose `period.month` output (`"YYYY-MM"`) is already the exact string format `client.fetchAllTransactions()`/`readCachedTransactions()`/`writeCachedTransactions()` expect as `monthKey` (confirmed in `commands/summary.ts`).
- `--json`, `-v/--verbose`, `--no-cache` (Commander sets `opts.cache = false`) — matches `summary`'s existing flags.
- Currency is always `"GBP"` (matches `aggregator.ts`'s existing hardcoding).
- `balance.type = "cash"`, `balance.source = "derived"` — technically computed by us, but from each transaction's own running balance (see `buildFinancialSummary`'s existing opening/closing logic), not an estimate from current-balance walk-back.
- On any error: `handleJsonError(err)` under `--json`, else `console.error("Failed: " + err.message)` + `process.exit(0)` — matches `commands/summary.ts`.

---

### Task 1: Pure statement mapper

**Files:**
- Modify: `packages/lloyds-cli/src/aggregator.ts`
- Test: `packages/lloyds-cli/src/aggregator.test.ts` (new)

**Interfaces:**
- Consumes: `LloydsTransaction` (already defined in this file); `Statement`, `StatementPeriod`, `StatementTransaction` from `@finclis/cli-utils`.
- Produces:
  ```ts
  export function buildLloydsStatement(
    rawTransactions: LloydsTransaction[],
    currentBalance: number,
    period: StatementPeriod,
    accountId: string
  ): Statement;
  ```
  `rawTransactions` must be newest-first (the order the Lloyds API already returns, per the existing comment in `buildFinancialSummary`).

- [ ] **Step 1: Write the failing test**

Create `packages/lloyds-cli/src/aggregator.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildLloydsStatement, type LloydsTransaction } from "./aggregator.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function txn(overrides: Partial<LloydsTransaction> = {}): LloydsTransaction {
  return {
    date: new Date("2026-08-05T00:00:00Z").getTime(),
    description: "PAYMENT",
    completeDescription: ["PAYMENT", "ACME LTD"],
    balance: 1500,
    vtdHostCallRequired: false,
    txnId: "t1",
    completeTxnId: "t1full",
    ...overrides,
  };
}

describe("buildLloydsStatement", () => {
  it("derives opening/closing from the first/last transaction's running balance (newest-first input)", () => {
    // newest-first: latest tx has balance 1500 (closing); earliest tx had balance 1500 - moneyIn = opening
    const raw: LloydsTransaction[] = [
      txn({ txnId: "t2", date: new Date("2026-08-20T00:00:00Z").getTime(), balance: 1500, money_in: 200 }),
      txn({ txnId: "t1", date: new Date("2026-08-05T00:00:00Z").getTime(), balance: 1300, money_out: 50 }),
    ];

    const statement = buildLloydsStatement(raw, 1500, period, "arr_123");

    // earliest (last in array) had money_out=50, balance=1300 -> opening = 1300 + 50 = 1350
    expect(statement.balance.opening).toBe(1350);
    expect(statement.balance.closing).toBe(1500);
    expect(statement.balance.type).toBe("cash");
    expect(statement.balance.source).toBe("derived");
  });

  it("uses currentBalance for opening/closing when there are no transactions", () => {
    const statement = buildLloydsStatement([], 800, period, "arr_123");
    expect(statement.balance.opening).toBe(800);
    expect(statement.balance.closing).toBe(800);
    expect(statement.transactionCount).toBe(0);
    expect(statement.transactions).toEqual([]);
  });

  it("sums credits/debits and maps transaction direction", () => {
    const raw: LloydsTransaction[] = [
      txn({ txnId: "t2", date: new Date("2026-08-20T00:00:00Z").getTime(), balance: 1500, money_in: 200, completeDescription: ["SALARY"] }),
      txn({ txnId: "t1", date: new Date("2026-08-05T00:00:00Z").getTime(), balance: 1300, money_out: 50, completeDescription: ["COFFEE SHOP"] }),
    ];

    const statement = buildLloydsStatement(raw, 1500, period, "arr_123");

    expect(statement.credits).toBe(200);
    expect(statement.debits).toBe(50);
    expect(statement.transactionCount).toBe(2);
    expect(statement.transactions).toEqual([
      { date: "2026-08-20", amount: 200, direction: "credit", description: "SALARY", currency: "GBP" },
      { date: "2026-08-05", amount: 50, direction: "debit", description: "COFFEE SHOP", currency: "GBP" },
    ]);
  });

  it("sets platform, account, and accountType", () => {
    const statement = buildLloydsStatement([], 800, period, "arr_123");
    expect(statement.platform).toBe("lloyds");
    expect(statement.account).toEqual({ id: "arr_123", name: "Current Account" });
    expect(statement.accountType).toBe("bank");
    expect(statement.currency).toBe("GBP");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/lloyds-cli && bun test aggregator.test.ts`
Expected: FAIL — `buildLloydsStatement` not defined.

- [ ] **Step 3: Write minimal implementation**

Add to `packages/lloyds-cli/src/aggregator.ts` (append at the end of the file; add the new import at the top alongside existing code):

```ts
import type { Statement, StatementPeriod, StatementTransaction } from "@finclis/cli-utils";

export function buildLloydsStatement(
  rawTransactions: LloydsTransaction[],
  currentBalance: number,
  period: StatementPeriod,
  accountId: string
): Statement {
  let opening = currentBalance;
  let closing = currentBalance;

  if (rawTransactions.length > 0) {
    // Raw transactions are newest-first from the API.
    const earliest = rawTransactions[rawTransactions.length - 1];
    const latest = rawTransactions[0];

    if (earliest.money_in !== undefined) {
      opening = earliest.balance - earliest.money_in;
    } else if (earliest.money_out !== undefined) {
      opening = earliest.balance + earliest.money_out;
    } else {
      opening = earliest.balance;
    }
    closing = latest.balance;
  }

  const credits = rawTransactions.reduce((s, t) => s + (t.money_in ?? 0), 0);
  const debits = rawTransactions.reduce((s, t) => s + (t.money_out ?? 0), 0);

  const transactions: StatementTransaction[] = rawTransactions.map((t) => ({
    date: new Date(t.date).toISOString().slice(0, 10),
    amount: t.money_in ?? t.money_out ?? 0,
    direction: t.money_in !== undefined ? "credit" : "debit",
    description: t.completeDescription.join(" - ") || t.description,
    currency: "GBP",
  }));

  return {
    platform: "lloyds",
    account: { id: accountId, name: "Current Account" },
    accountType: "bank",
    period,
    currency: "GBP",
    balance: { opening, closing, type: "cash", source: "derived" },
    cashBalance: null,
    credits,
    debits,
    transactionCount: rawTransactions.length,
    transactionsAvailable: true,
    transactions,
    notes: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/lloyds-cli && bun test aggregator.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/lloyds-cli/src/aggregator.ts packages/lloyds-cli/src/aggregator.test.ts
git commit -m "feat(lloyds): add pure statement mapper"
```

---

### Task 2: `statement` command (I/O) + test helpers

**Files:**
- Create: `packages/lloyds-cli/src/commands/statement.ts`
- Create: `packages/lloyds-cli/src/commands/__test-helpers.ts`
- Test: `packages/lloyds-cli/src/commands/statement.test.ts`

**Interfaces:**
- Consumes: `buildLloydsStatement` (Task 1); `getClient`, `requireSession` from `../client.js`; `readCachedTransactions`, `writeCachedTransactions` from `../cache.js`; `isPastMonth` from `../validate.js`; `monthToPeriod`, `printStatement`, `writeJson`, `handleJsonError` from `@finclis/cli-utils`.
- Produces: `export async function statementCommand(opts?: StatementOpts): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `packages/lloyds-cli/src/commands/__test-helpers.ts`:

```ts
import { mock } from "bun:test";

export const mockGetAccounts = mock(() => Promise.resolve([] as any[]));
export const mockFetchAllTransactions = mock(() => Promise.resolve([] as any[]));
export const mockRequireSession = mock(() => ({
  arrangementId: "arr_test123",
  cookies: [],
}));
export const mockReadCachedTransactions = mock(() => null as any[] | null);
export const mockWriteCachedTransactions = mock(() => {});

export function registerMocks() {
  mock.module("../client.js", () => ({
    requireSession: mockRequireSession,
    getClient: mock(() =>
      Promise.resolve({
        getAccounts: mockGetAccounts,
        fetchAllTransactions: mockFetchAllTransactions,
      })
    ),
    setVerbose: mock(() => {}),
    cleanup: mock(() => Promise.resolve()),
  }));

  mock.module("../cache.js", () => ({
    readCachedTransactions: mockReadCachedTransactions,
    writeCachedTransactions: mockWriteCachedTransactions,
    readCachedSummary: mock(() => null),
    writeCachedSummary: mock(() => {}),
  }));
}

export function captureStdout() {
  let output = "";
  const original = process.stdout.write.bind(process.stdout);
  const install = () => {
    process.stdout.write = ((chunk: any) => {
      output += chunk.toString();
      return true;
    }) as any;
  };
  install();
  return {
    getOutput: () => output,
    reset: () => { output = ""; install(); },
    restore: () => { process.stdout.write = original; },
  };
}
```

Create `packages/lloyds-cli/src/commands/statement.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  mockGetAccounts,
  mockFetchAllTransactions,
  mockReadCachedTransactions,
  mockWriteCachedTransactions,
  registerMocks,
  captureStdout,
} from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockGetAccounts.mockReset();
    mockFetchAllTransactions.mockReset();
    mockReadCachedTransactions.mockReset();
    mockReadCachedTransactions.mockReturnValue(null);
    mockWriteCachedTransactions.mockClear();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for a month, fetching live when not cached", async () => {
    mockGetAccounts.mockResolvedValue([{ balanceAmount: { amount: 1500 } }]);
    mockFetchAllTransactions.mockResolvedValue([
      {
        date: new Date("2026-08-20T00:00:00Z").getTime(),
        description: "SALARY",
        completeDescription: ["SALARY"],
        balance: 1500,
        money_in: 200,
        vtdHostCallRequired: false,
        txnId: "t2",
        completeTxnId: "t2full",
      },
    ]);

    await statementCommand({ month: "2026-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("lloyds");
    expect(parsed.period.month).toBe("2026-08");
    expect(parsed.balance.closing).toBe(1500);
    expect(parsed.transactionCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/lloyds-cli && bun test commands/statement.test.ts`
Expected: FAIL — `commands/statement.ts` doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/lloyds-cli/src/commands/statement.ts`:

```ts
import { getClient, requireSession } from "../client.js";
import { readCachedTransactions, writeCachedTransactions } from "../cache.js";
import { isPastMonth } from "../validate.js";
import { buildLloydsStatement } from "../aggregator.js";
import { monthToPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
  cache?: boolean; // Commander --no-cache sets this to false
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  const session = requireSession();

  try {
    const monthStr = opts.month ?? currentMonthString();
    const period = monthToPeriod(monthStr);
    const monthKey = period.month;
    const [year, mon] = monthKey.split("-").map(Number);
    const isPast = isPastMonth(year, mon);
    const useCache = opts.cache !== false;

    let rawTxns: any[] | null = isPast && useCache ? readCachedTransactions(monthKey) : null;

    const client = await getClient();
    let accounts: any[];
    if (rawTxns) {
      accounts = await client.getAccounts();
    } else {
      [rawTxns, accounts] = await Promise.all([
        client.fetchAllTransactions(monthKey),
        client.getAccounts(),
      ]);
      if (isPast) writeCachedTransactions(monthKey, rawTxns);
    }

    const currentBalance = accounts[0]?.balanceAmount?.amount ?? 0;
    const statement = buildLloydsStatement(rawTxns, currentBalance, period, session.arrangementId);

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

Run: `cd packages/lloyds-cli && bun test commands/statement.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/lloyds-cli/src/commands/statement.ts packages/lloyds-cli/src/commands/__test-helpers.ts packages/lloyds-cli/src/commands/statement.test.ts
git commit -m "feat(lloyds): add statement command"
```

---

### Task 3: Register the command

**Files:**
- Modify: `packages/lloyds-cli/src/index.ts`

- [ ] **Step 1: Add the import and command registration**

Add near the other command imports in `packages/lloyds-cli/src/index.ts`:

```ts
import { statementCommand } from "./commands/statement.js";
```

Add after the existing `summary` command block:

```ts
program
  .command("statement")
  .description("Standard bank-statement-style report for a month")
  .option("--month <YYYY-MM>", "Month to report on (default: current month)")
  .option("--no-cache", "Bypass cache and fetch live data")
  .option("-v, --verbose", "Log HTTP requests to stderr")
  .option("--json", "Output raw JSON")
  .action(statementCommand);
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/lloyds-cli && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full lloyds-cli test suite**

Run: `cd packages/lloyds-cli && bun test`
Expected: all tests pass (existing + the 5 new ones).

- [ ] **Step 4: Commit**

```bash
git add packages/lloyds-cli/src/index.ts
git commit -m "feat(lloyds): register statement command"
```

## Manual verification (for the human to run — requires a live Lloyds browser session)

```bash
cd packages/lloyds-cli
bun src/index.ts statement --month <a-recent-YYYY-MM>
bun src/index.ts statement --month <a-recent-YYYY-MM> --json | jq .
```

Confirm: `balance.opening`/`balance.closing` match what `lloyds summary --month <MM-YYYY equivalent>` reports for the same month (note the existing `summary` command takes `MM-YYYY`, not `YYYY-MM`); `transactionCount` matches `lloyds transactions --month <MM-YYYY>` row count.
