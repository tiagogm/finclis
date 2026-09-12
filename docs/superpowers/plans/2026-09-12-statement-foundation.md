# Statement Foundation (cli-utils) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared `Statement` schema types, balance-derivation helpers, and human-readable formatter to `@finclis/cli-utils` that every platform's `statement` command will build on.

**Architecture:** One new file, `packages/cli-utils/src/statement.ts`, exported from `packages/cli-utils/src/index.ts` alongside the existing `json.ts`/`prompt.ts`/`apiError.ts` exports. Pure functions only — no I/O — so they're trivially unit-testable and safe for every platform package to import without side effects.

**Tech Stack:** TypeScript, Bun test runner (`bun:test`), existing monorepo conventions (`workspace:*` dependency, `.js` extension on relative imports for ESM).

**Spec:** `docs/superpowers/specs/2026-09-12-unified-statement-command-design.md`

## Global Constraints

- `platform` is the field name (not `vendor`) — per spec.
- `credits` = money in, `debits` = money out — per spec (standard UK bank-statement convention).
- Amounts in the schema are in major currency units (e.g. `42.10`, not pence/cents) — matches how `wise`, `lloyds-cli`, and `vanguard` already report amounts (only `monzo`'s raw API uses pence; the monzo `statement` command, in a later plan, will convert before building the `Statement` object).
- No process.exit / console.error / throw-and-crash inside this shared module for validation — throw a plain `Error` and let each command's existing catch block decide how to report it (matches the pattern in `packages/*/src/validate.ts`, which callers already wrap in try/catch).

---

### Task 1: `Statement` schema types

**Files:**
- Create: `packages/cli-utils/src/statement.ts`
- Test: `packages/cli-utils/src/statement.test.ts`

**Interfaces:**
- Produces (used by every later task and every platform plan):
  ```ts
  export type BalanceType = "cash" | "portfolio";
  export type BalanceSource = "reported" | "derived";
  export type TransactionDirection = "credit" | "debit";

  export interface StatementTransaction {
    date: string;              // "YYYY-MM-DD"
    amount: number;            // positive, major currency units
    direction: TransactionDirection;
    description: string;
    currency: string;          // ISO 4217, e.g. "GBP"
  }

  export interface StatementBalance {
    opening: number;
    closing: number;
    type: BalanceType;
    source: BalanceSource;
  }

  export interface StatementCashBalance {
    asOf: string;               // "YYYY-MM-DD"
    amount: number;
  }

  export interface StatementPeriod {
    month: string;               // "YYYY-MM"
    start: string;                // "YYYY-MM-DD"
    end: string;                  // "YYYY-MM-DD"
  }

  export interface StatementAccount {
    id: string;
    name: string;
  }

  export interface Statement {
    platform: string;
    account: StatementAccount;
    accountType: "bank" | "investment" | "exchange";
    period: StatementPeriod;
    currency: string;
    balance: StatementBalance;
    cashBalance: StatementCashBalance | null;
    credits: number;
    debits: number;
    transactionCount: number;
    transactionsAvailable: boolean;
    transactions: StatementTransaction[] | null;
    notes: string[];
  }
  ```

There is no runtime behavior to test for plain interfaces — this task just defines them. Skip the TDD test/fail/pass cycle here; go straight to writing the file.

- [ ] **Step 1: Write the types**

Create `packages/cli-utils/src/statement.ts` with exactly the type/interface block above (nothing else yet — later tasks append to this file).

- [ ] **Step 2: Typecheck**

Run: `cd packages/cli-utils && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/cli-utils/src/statement.ts
git commit -m "feat(cli-utils): add Statement schema types"
```

---

### Task 2: `monthToPeriod` — parse and validate `YYYY-MM`

**Files:**
- Modify: `packages/cli-utils/src/statement.ts`
- Test: `packages/cli-utils/src/statement.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no deps on Task 1 types beyond `StatementPeriod`).
- Produces:
  ```ts
  export function monthToPeriod(month: string): StatementPeriod;
  ```
  Throws `Error` with message `` `Invalid month: "${month}". Expected YYYY-MM.` `` when the input doesn't match `/^\d{4}-\d{2}$/` or the month component isn't `01`-`12`.

- [ ] **Step 1: Write the failing test**

Append to `packages/cli-utils/src/statement.test.ts` (create the file if it doesn't exist yet):

```ts
import { describe, it, expect } from "bun:test";
import { monthToPeriod } from "./statement.js";

describe("monthToPeriod", () => {
  it("returns start/end bounds for a valid month", () => {
    const period = monthToPeriod("2026-08");
    expect(period).toEqual({
      month: "2026-08",
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });

  it("handles February in a leap year", () => {
    const period = monthToPeriod("2028-02");
    expect(period.end).toBe("2028-02-29");
  });

  it("throws on malformed input", () => {
    expect(() => monthToPeriod("2026-8")).toThrow('Invalid month: "2026-8". Expected YYYY-MM.');
  });

  it("throws on out-of-range month", () => {
    expect(() => monthToPeriod("2026-13")).toThrow('Invalid month: "2026-13". Expected YYYY-MM.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli-utils && bun test statement.test.ts`
Expected: FAIL — `monthToPeriod is not a function` (or similar, since it doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Append to `packages/cli-utils/src/statement.ts`:

```ts
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function monthToPeriod(month: string): StatementPeriod {
  const m = MONTH_RE.exec(month);
  const monthNum = m ? parseInt(m[2], 10) : NaN;
  if (!m || monthNum < 1 || monthNum > 12) {
    throw new Error(`Invalid month: "${month}". Expected YYYY-MM.`);
  }
  const year = parseInt(m[1], 10);
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    month,
    start: `${m[1]}-${m[2]}-01`,
    end: `${m[1]}-${m[2]}-${pad(lastDay)}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli-utils && bun test statement.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli-utils/src/statement.ts packages/cli-utils/src/statement.test.ts
git commit -m "feat(cli-utils): add monthToPeriod helper"
```

---

### Task 3: Balance derivation helpers

**Files:**
- Modify: `packages/cli-utils/src/statement.ts`
- Test: `packages/cli-utils/src/statement.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function deriveClosingBalance(currentBalance: number, flowsSincePeriodEnd: number): number;
  export function deriveOpeningBalance(closingBalance: number, netFlowDuringPeriod: number): number;
  ```
  `flowsSincePeriodEnd` and `netFlowDuringPeriod` are signed (credits positive, debits negative).

- [ ] **Step 1: Write the failing test**

Append to `packages/cli-utils/src/statement.test.ts`:

```ts
import { deriveClosingBalance, deriveOpeningBalance } from "./statement.js";

describe("deriveClosingBalance", () => {
  it("subtracts flows that happened after the period end", () => {
    // current balance is 1500; +50 arrived after period end, so closing was 1450
    expect(deriveClosingBalance(1500, 50)).toBe(1450);
  });

  it("adds back a withdrawal that happened after the period end", () => {
    expect(deriveClosingBalance(1500, -50)).toBe(1550);
  });
});

describe("deriveOpeningBalance", () => {
  it("subtracts the period's net flow from the closing balance", () => {
    expect(deriveOpeningBalance(1450, 200)).toBe(1250);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli-utils && bun test statement.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Write minimal implementation**

Append to `packages/cli-utils/src/statement.ts`:

```ts
export function deriveClosingBalance(currentBalance: number, flowsSincePeriodEnd: number): number {
  return currentBalance - flowsSincePeriodEnd;
}

export function deriveOpeningBalance(closingBalance: number, netFlowDuringPeriod: number): number {
  return closingBalance - netFlowDuringPeriod;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli-utils && bun test statement.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add packages/cli-utils/src/statement.ts packages/cli-utils/src/statement.test.ts
git commit -m "feat(cli-utils): add balance derivation helpers"
```

---

### Task 4: `printStatement` human-readable formatter

**Files:**
- Modify: `packages/cli-utils/src/statement.ts`
- Test: `packages/cli-utils/src/statement.test.ts`

**Interfaces:**
- Consumes: `Statement` (Task 1).
- Produces:
  ```ts
  export function printStatement(statement: Statement): void;
  ```
  Writes to `console.log`. Format (values right-padded/aligned is not required — keep it simple, one field per line for the header, then a table for transactions if present):

  ```
  Platform:         monzo
  Account:          Current Account
  Period:           2026-08 (2026-08-01 to 2026-08-31)
  Currency:         GBP

  Opening Balance:  GBP 1,234.56
  Closing Balance:  GBP 1,500.00
  Credits:          GBP 2,000.00
  Debits:           GBP 734.56
  Transactions:     42

  Date        Amount         Description
  2026-08-05  +GBP 42.10     Coffee shop
  2026-08-06  -GBP 15.00     Refund

  Notes:
    - Excludes invested capital and unrealized P&L
  ```

  When `transactions` is `null`, omit the transaction table entirely (no "Date/Amount/Description" header). When `notes` is empty, omit the "Notes:" section.

- [ ] **Step 1: Write the failing test**

Append to `packages/cli-utils/src/statement.test.ts`:

```ts
import { printStatement, type Statement } from "./statement.js";

function baseStatement(overrides: Partial<Statement> = {}): Statement {
  return {
    platform: "monzo",
    account: { id: "acc_1", name: "Current Account" },
    accountType: "bank",
    period: { month: "2026-08", start: "2026-08-01", end: "2026-08-31" },
    currency: "GBP",
    balance: { opening: 1234.56, closing: 1500, type: "cash", source: "derived" },
    cashBalance: null,
    credits: 2000,
    debits: 734.56,
    transactionCount: 1,
    transactionsAvailable: true,
    transactions: [
      { date: "2026-08-05", amount: 42.1, direction: "credit", description: "Coffee shop", currency: "GBP" },
    ],
    notes: [],
    ...overrides,
  };
}

describe("printStatement", () => {
  it("prints the header fields and transaction table", () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (s: string) => lines.push(s);
    try {
      printStatement(baseStatement());
    } finally {
      console.log = orig;
    }
    const out = lines.join("\n");
    expect(out).toContain("Platform:         monzo");
    expect(out).toContain("Opening Balance:  GBP 1,234.56");
    expect(out).toContain("Closing Balance:  GBP 1,500.00");
    expect(out).toContain("Coffee shop");
  });

  it("omits the transaction table when transactions is null", () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (s: string) => lines.push(s);
    try {
      printStatement(baseStatement({ transactions: null, transactionsAvailable: false }));
    } finally {
      console.log = orig;
    }
    const out = lines.join("\n");
    expect(out).not.toContain("Description");
  });

  it("includes a Notes section when notes are present", () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (s: string) => lines.push(s);
    try {
      printStatement(baseStatement({ notes: ["Excludes invested capital"] }));
    } finally {
      console.log = orig;
    }
    expect(lines.join("\n")).toContain("Excludes invested capital");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli-utils && bun test statement.test.ts`
Expected: FAIL — `printStatement` not defined.

- [ ] **Step 3: Write minimal implementation**

Append to `packages/cli-utils/src/statement.ts`:

```ts
function fmtAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function printStatement(statement: Statement): void {
  console.log(`Platform:         ${statement.platform}`);
  console.log(`Account:          ${statement.account.name}`);
  console.log(`Period:           ${statement.period.month} (${statement.period.start} to ${statement.period.end})`);
  console.log(`Currency:         ${statement.currency}`);
  console.log("");
  console.log(`Opening Balance:  ${fmtAmount(statement.balance.opening, statement.currency)}`);
  console.log(`Closing Balance:  ${fmtAmount(statement.balance.closing, statement.currency)}`);
  console.log(`Credits:          ${fmtAmount(statement.credits, statement.currency)}`);
  console.log(`Debits:           ${fmtAmount(statement.debits, statement.currency)}`);
  console.log(`Transactions:     ${statement.transactionCount}`);

  if (statement.cashBalance) {
    console.log(`Cash Balance:     ${fmtAmount(statement.cashBalance.amount, statement.currency)} (as of ${statement.cashBalance.asOf})`);
  }

  if (statement.transactions && statement.transactions.length > 0) {
    console.log("");
    console.log("Date        Amount         Description");
    for (const tx of statement.transactions) {
      const sign = tx.direction === "credit" ? "+" : "-";
      const amountStr = `${sign}${fmtAmount(tx.amount, tx.currency)}`;
      console.log(`${tx.date}  ${amountStr.padEnd(13)}  ${tx.description}`);
    }
  }

  if (statement.notes.length > 0) {
    console.log("");
    console.log("Notes:");
    for (const note of statement.notes) {
      console.log(`  - ${note}`);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli-utils && bun test statement.test.ts`
Expected: PASS (10 tests total).

- [ ] **Step 5: Commit**

```bash
git add packages/cli-utils/src/statement.ts packages/cli-utils/src/statement.test.ts
git commit -m "feat(cli-utils): add printStatement formatter"
```

---

### Task 5: Export from package index

**Files:**
- Modify: `packages/cli-utils/src/index.ts`

- [ ] **Step 1: Add exports**

Add to `packages/cli-utils/src/index.ts`:

```ts
export type {
  Statement,
  StatementTransaction,
  StatementBalance,
  StatementCashBalance,
  StatementPeriod,
  StatementAccount,
  BalanceType,
  BalanceSource,
  TransactionDirection,
} from "./statement.js";
export { monthToPeriod, deriveClosingBalance, deriveOpeningBalance, printStatement } from "./statement.js";
```

- [ ] **Step 2: Typecheck the whole workspace**

Run: `cd /Users/tiagogm/Projects/finance/finclis && bunx tsc --build --dry 2>&1 | head -50` (or, if no root build config exists, run `bunx tsc --noEmit` inside `packages/cli-utils` — confirm which applies by checking for a root `tsconfig.json`/`tsconfig.base.json` first).
Expected: no errors.

- [ ] **Step 3: Run full cli-utils test suite**

Run: `cd packages/cli-utils && bun test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/cli-utils/src/index.ts
git commit -m "feat(cli-utils): export statement module"
```
