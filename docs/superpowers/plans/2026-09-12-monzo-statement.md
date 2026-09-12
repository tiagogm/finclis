# Monzo `statement` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `monzo statement --month YYYY-MM --json` producing the common `Statement` schema (opening/closing balance derived by walking back from the live balance, full transaction list, credits/debits, transaction count).

**Architecture:** A pure mapper function `buildMonzoStatement()` in a new `packages/monzo/src/statement.ts` takes already-fetched raw data and returns a `Statement` object (no I/O, easy to unit test). A new `packages/monzo/src/commands/statement.ts` does the fetching (reusing `fetchTransactions`, `isOldRange`, `loadCache` already exported from `commands/transactions.ts`) and calls the mapper, then `printStatement`/`writeJson`. This mirrors the existing split in `lloyds-cli` between `aggregator.ts` (pure) and `commands/summary.ts` (I/O).

**Tech Stack:** TypeScript, Commander, Bun test runner, `@finclis/cli-utils` (already has `Statement`, `monthToPeriod`, `deriveClosingBalance`, `deriveOpeningBalance`, `printStatement` — see `packages/cli-utils/src/statement.ts`, already merged to `main`).

**Spec:** `docs/superpowers/specs/2026-09-12-unified-statement-command-design.md`

## Global Constraints

- `--month YYYY-MM` (default: current month), `--json`, `-v/--verbose` — matches every other command's flag conventions in this package.
- Amounts in the `Statement` object are in **pounds** (major units), even though Monzo's raw API returns pence — convert before building the `Statement`.
- Balance is `type: "cash"`, `source: "derived"` (Monzo has no historical point-in-time balance endpoint).
- Reuse the existing 90-day/SCA cache gating from `commands/transactions.ts` unchanged — do not reimplement it.
- On any error: `handleJsonError(err)` under `--json`, else `console.error("Failed: " + err.message)` + `process.exit(0)` — matches every other monzo command.

---

### Task 1: Pure statement mapper

**Files:**
- Create: `packages/monzo/src/statement.ts`
- Test: `packages/monzo/src/statement.test.ts`

**Interfaces:**
- Consumes: `StatementPeriod`, `Statement`, `StatementTransaction`, `deriveClosingBalance`, `deriveOpeningBalance` from `@finclis/cli-utils`.
- Produces:
  ```ts
  export interface MonzoStatementInput {
    accountId: string;
    period: StatementPeriod;             // from monthToPeriod
    currency: string;
    periodTransactions: any[];           // raw Monzo transaction objects within the period
    currentBalancePence: number;
    flowsSincePeriodEndPence: number;    // signed sum of pence for transactions after period end, up to now (0 if isCurrentPeriod)
    isCurrentPeriod: boolean;
  }

  export function buildMonzoStatement(input: MonzoStatementInput): Statement;
  ```
  Used by Task 2's `commands/statement.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/monzo/src/statement.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildMonzoStatement } from "./statement.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function tx(overrides: Partial<any> = {}) {
  return {
    id: "tx_1",
    created: "2026-08-05T10:00:00Z",
    amount: 4210,
    currency: "GBP",
    description: "Coffee shop",
    ...overrides,
  };
}

describe("buildMonzoStatement", () => {
  it("derives opening/closing balance from current balance and flows", () => {
    const statement = buildMonzoStatement({
      accountId: "acc_1",
      period,
      currency: "GBP",
      periodTransactions: [tx({ amount: 4210 }), tx({ id: "tx_2", amount: -1000 })],
      currentBalancePence: 150000,
      flowsSincePeriodEndPence: 5000,
      isCurrentPeriod: false,
    });

    // closing = 150000 - 5000 = 145000 -> 1450.00
    expect(statement.balance.closing).toBe(1450);
    // net flow during period = 4210 - 1000 = 3210 -> opening = 1450 - 32.10 = 1417.90
    expect(statement.balance.opening).toBeCloseTo(1417.9, 2);
    expect(statement.balance.type).toBe("cash");
    expect(statement.balance.source).toBe("derived");
  });

  it("sums credits and debits separately, in pounds", () => {
    const statement = buildMonzoStatement({
      accountId: "acc_1",
      period,
      currency: "GBP",
      periodTransactions: [tx({ amount: 4210 }), tx({ id: "tx_2", amount: -1000 })],
      currentBalancePence: 150000,
      flowsSincePeriodEndPence: 0,
      isCurrentPeriod: false,
    });

    expect(statement.credits).toBeCloseTo(42.1, 2);
    expect(statement.debits).toBeCloseTo(10, 2);
    expect(statement.transactionCount).toBe(2);
  });

  it("maps each transaction with direction and pounds amount", () => {
    const statement = buildMonzoStatement({
      accountId: "acc_1",
      period,
      currency: "GBP",
      periodTransactions: [tx({ amount: -1000, description: "Refund" })],
      currentBalancePence: 150000,
      flowsSincePeriodEndPence: 0,
      isCurrentPeriod: false,
    });

    expect(statement.transactions).toEqual([
      { date: "2026-08-05", amount: 10, direction: "debit", description: "Refund", currency: "GBP" },
    ]);
    expect(statement.transactionsAvailable).toBe(true);
  });

  it("adds an in-progress note for the current period", () => {
    const statement = buildMonzoStatement({
      accountId: "acc_1",
      period,
      currency: "GBP",
      periodTransactions: [],
      currentBalancePence: 150000,
      flowsSincePeriodEndPence: 0,
      isCurrentPeriod: true,
    });

    expect(statement.notes).toContain("Period is still in progress; closing balance reflects the account as of now.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/monzo && bun test statement.test.ts`
Expected: FAIL — `buildMonzoStatement` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/monzo/src/statement.ts`:

```ts
import {
  deriveClosingBalance,
  deriveOpeningBalance,
  type Statement,
  type StatementPeriod,
  type StatementTransaction,
} from "@finclis/cli-utils";

export interface MonzoStatementInput {
  accountId: string;
  period: StatementPeriod;
  currency: string;
  periodTransactions: any[];
  currentBalancePence: number;
  flowsSincePeriodEndPence: number;
  isCurrentPeriod: boolean;
}

function toStatementTransaction(t: any): StatementTransaction {
  return {
    date: (t.created || "").slice(0, 10),
    amount: Math.abs(t.amount) / 100,
    direction: t.amount >= 0 ? "credit" : "debit",
    description: t.description || t.merchant?.name || "",
    currency: t.currency || "GBP",
  };
}

export function buildMonzoStatement(input: MonzoStatementInput): Statement {
  const netFlowDuringPeriodPence = input.periodTransactions.reduce((s, t) => s + t.amount, 0);
  const closingPence = deriveClosingBalance(input.currentBalancePence, input.flowsSincePeriodEndPence);
  const openingPence = deriveOpeningBalance(closingPence, netFlowDuringPeriodPence);

  const credits = input.periodTransactions
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0) / 100;
  const debits = input.periodTransactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0) / 100;

  const notes: string[] = [];
  if (input.isCurrentPeriod) {
    notes.push("Period is still in progress; closing balance reflects the account as of now.");
  }

  return {
    platform: "monzo",
    account: { id: input.accountId, name: "Current Account" },
    accountType: "bank",
    period: input.period,
    currency: input.currency,
    balance: { opening: openingPence / 100, closing: closingPence / 100, type: "cash", source: "derived" },
    cashBalance: null,
    credits,
    debits,
    transactionCount: input.periodTransactions.length,
    transactionsAvailable: true,
    transactions: input.periodTransactions.map(toStatementTransaction),
    notes,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/monzo && bun test statement.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/monzo/src/statement.ts packages/monzo/src/statement.test.ts
git commit -m "feat(monzo): add pure statement mapper"
```

---

### Task 2: `statement` command (I/O)

**Files:**
- Create: `packages/monzo/src/commands/statement.ts`
- Test: `packages/monzo/src/commands/statement.test.ts`

**Interfaces:**
- Consumes: `buildMonzoStatement` (Task 1); `monzoGet`, `requireSession` from `../client.js`; `fetchTransactions`, `isOldRange`, `loadCache` from `./transactions.js` (already exported — see `packages/monzo/src/commands/transactions.ts`); `monthToPeriod`, `printStatement`, `writeJson`, `handleJsonError` from `@finclis/cli-utils`.
- Produces: `export async function statementCommand(opts?: StatementOpts): Promise<void>` — registered in Task 3.

- [ ] **Step 1: Write the failing test**

Create `packages/monzo/src/commands/statement.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockMonzoGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockMonzoGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for a past month", async () => {
    mockMonzoGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/balance")) {
        return { balance: 150000, currency: "GBP" };
      }
      if (path.startsWith("/transactions")) {
        // First call: period range (since=2026-08-01, before=2026-08-31) -> one transaction.
        // Second call: since=period end -> no more transactions (flows after period = 0).
        if (path.includes("since=2026-08-01")) {
          return { transactions: [{ id: "tx_1", created: "2026-08-05T10:00:00Z", amount: 4210, currency: "GBP", description: "Coffee shop" }] };
        }
        return { transactions: [] };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    await statementCommand({ month: "2026-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("monzo");
    expect(parsed.period.month).toBe("2026-08");
    expect(parsed.transactionCount).toBe(1);
    expect(parsed.balance.closing).toBe(1500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/monzo && bun test commands/statement.test.ts`
Expected: FAIL — `commands/statement.ts` doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/monzo/src/commands/statement.ts`:

```ts
import { monzoGet, requireSession } from "../client.js";
import { fetchTransactions, isOldRange, loadCache } from "./transactions.js";
import { buildMonzoStatement } from "../statement.js";
import { monthToPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchAllTransactions(accountId: string, since?: string, before?: string): Promise<any[]> {
  const all: any[] = [];
  let lastId: string | undefined;
  while (true) {
    const batch = await fetchTransactions({ accountId, since: lastId ?? since, before, limit: 100, lastId });
    all.push(...batch);
    if (batch.length < 100) break;
    lastId = batch[batch.length - 1].id;
  }
  return all;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  try {
    const session = await requireSession();
    const monthStr = opts.month ?? currentMonthString();
    const period = monthToPeriod(monthStr);

    const todayStr = new Date().toISOString().slice(0, 10);
    if (period.start > todayStr) {
      throw new Error(`Invalid month: "${monthStr}" is in the future.`);
    }
    const isCurrentPeriod = period.start <= todayStr && todayStr <= period.end;

    const sinceISO = `${period.start}T00:00:00.000Z`;
    const beforeISO = `${period.end}T23:59:59.999Z`;

    let periodTransactions: any[];
    if (isOldRange(sinceISO)) {
      const [year, month] = period.month.split("-").map(Number);
      const cached = loadCache(month, year);
      if (!cached) {
        throw new Error("Data older than 90 days requires a cached sync. Run: monzo transactions --cache");
      }
      periodTransactions = cached;
    } else {
      periodTransactions = await fetchAllTransactions(session.account_id, sinceISO, beforeISO);
    }

    const balanceData = await monzoGet(`/balance?account_id=${encodeURIComponent(session.account_id)}`);
    const currentBalancePence = balanceData.balance;
    const currency = balanceData.currency || "GBP";

    let flowsSincePeriodEndPence = 0;
    if (!isCurrentPeriod) {
      const afterPeriodTxs = await fetchAllTransactions(session.account_id, beforeISO, undefined);
      flowsSincePeriodEndPence = afterPeriodTxs.reduce((s, t) => s + t.amount, 0);
    }

    const statement = buildMonzoStatement({
      accountId: session.account_id,
      period,
      currency,
      periodTransactions,
      currentBalancePence,
      flowsSincePeriodEndPence,
      isCurrentPeriod,
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

Run: `cd packages/monzo && bun test commands/statement.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/monzo/src/commands/statement.ts packages/monzo/src/commands/statement.test.ts
git commit -m "feat(monzo): add statement command"
```

---

### Task 3: Register the command

**Files:**
- Modify: `packages/monzo/src/index.ts`

- [ ] **Step 1: Add the import and command registration**

Add near the other command imports in `packages/monzo/src/index.ts`:

```ts
import { statementCommand } from "./commands/statement.js";
```

Add after the existing `summary` command block:

```ts
program
  .command("statement")
  .description("Standard bank-statement-style report for a month")
  .option("--month <YYYY-MM>", "Month to report on (default: current)")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .addHelpText("after", "\nExamples:\n  monzo statement --month 2026-08\n  monzo statement --month 2026-08 --json")
  .action(statementCommand);
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/monzo && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full monzo test suite**

Run: `cd packages/monzo && bun test`
Expected: all tests pass (existing + the 5 new ones).

- [ ] **Step 4: Commit**

```bash
git add packages/monzo/src/index.ts
git commit -m "feat(monzo): register statement command"
```

## Manual verification (for the human to run — requires a live Monzo login)

```bash
cd packages/monzo
bun src/index.ts statement --month <a-recent-YYYY-MM>
bun src/index.ts statement --month <a-recent-YYYY-MM> --json | jq .
```

Confirm: opening/closing balance look plausible against `monzo balance` and `monzo transactions --month <same>`; `transactionCount` matches the number of rows `monzo transactions --month <same>` prints.
