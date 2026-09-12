# Wise `statement` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `wise statement --month YYYY-MM [--currency CODE] --json` producing the common `Statement` schema. Wise's `balance-statements/.../statement.json` endpoint (already used by the existing `statements` command) is expected to return period-native opening/closing balances directly (`startOfStatementBalance` / `endOfStatementBalance`), so this is the one platform where `balance.source` should normally be `"reported"`.

**Architecture:** A pure mapper `buildWiseStatement()` in a new `packages/wise/src/statement.ts` maps the raw `statement.json` response (plus the currently-known account balance, as a fallback input) into a `Statement`. A new `packages/wise/src/commands/statement.ts` reuses the same balance-lookup + `statement.json` fetch as the existing `commands/statements.ts`, but accepts `--month` instead of `--from`/`--to`.

**Tech Stack:** TypeScript, Commander, Bun test runner, `@finclis/cli-utils` (`Statement`, `monthToPeriod`, `deriveOpeningBalance`, `printStatement` — already merged to `main`).

**Spec:** `docs/superpowers/specs/2026-09-12-unified-statement-command-design.md`

## Global Constraints

- `--month YYYY-MM` (default: current month), `--currency <CODE>` (defaults to the account's first/primary `STANDARD` balance), `--json`, `-v/--verbose`.
- If `statement.json` returns `startOfStatementBalance`/`endOfStatementBalance`, use them verbatim (`balance.source = "reported"`). If either is missing (defensive fallback — the real API response has not been observed against this codebase yet), approximate `closing` from the currently-known balance amount and derive `opening` via `deriveOpeningBalance`, and add a note explaining the approximation (`balance.source = "derived"`).
- On any error: `handleJsonError(err)` under `--json`, else `console.error("Failed: " + err.message)` + `process.exit(0)` — matches `commands/statements.ts`.

---

### Task 1: Pure statement mapper

**Files:**
- Create: `packages/wise/src/statement.ts`
- Test: `packages/wise/src/statement.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface WiseStatementInput {
    currency: string;
    period: StatementPeriod;
    balanceId: number | string;
    currentBalanceAmount: number;
    statement: any; // raw statement.json response
  }

  export function buildWiseStatement(input: WiseStatementInput): Statement;
  ```

- [ ] **Step 1: Write the failing test**

Create `packages/wise/src/statement.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildWiseStatement } from "./statement.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

describe("buildWiseStatement", () => {
  it("uses reported start/end balances when present", () => {
    const statement = buildWiseStatement({
      currency: "GBP",
      period,
      balanceId: 42,
      currentBalanceAmount: 1500,
      statement: {
        startOfStatementBalance: { amount: { value: 1234.56, currency: "GBP" } },
        endOfStatementBalance: { amount: { value: 1500, currency: "GBP" } },
        transactions: [
          { date: "2026-08-05T10:00:00Z", amount: { value: -3.5, currency: "GBP" }, details: { description: "Coffee shop" } },
        ],
      },
    });

    expect(statement.balance).toEqual({ opening: 1234.56, closing: 1500, type: "cash", source: "reported" });
    expect(statement.notes).toEqual([]);
  });

  it("falls back to deriving from the current balance when reported fields are missing", () => {
    const statement = buildWiseStatement({
      currency: "GBP",
      period,
      balanceId: 42,
      currentBalanceAmount: 1500,
      statement: {
        transactions: [
          { date: "2026-08-05T10:00:00Z", amount: { value: 200, currency: "GBP" }, details: { description: "Deposit" } },
          { date: "2026-08-06T10:00:00Z", amount: { value: -50, currency: "GBP" }, details: { description: "Fee" } },
        ],
      },
    });

    expect(statement.balance.closing).toBe(1500);
    expect(statement.balance.opening).toBe(1350); // 1500 - (200 - 50)
    expect(statement.balance.source).toBe("derived");
    expect(statement.notes).toContain(
      "Vendor did not return period-native balances; closing balance approximated from the current balance."
    );
  });

  it("maps transactions with direction and totals credits/debits", () => {
    const statement = buildWiseStatement({
      currency: "GBP",
      period,
      balanceId: 42,
      currentBalanceAmount: 1500,
      statement: {
        startOfStatementBalance: { amount: { value: 1000, currency: "GBP" } },
        endOfStatementBalance: { amount: { value: 1500, currency: "GBP" } },
        transactions: [
          { date: "2026-08-05T10:00:00Z", amount: { value: 600, currency: "GBP" }, details: { description: "Deposit" } },
          { date: "2026-08-06T10:00:00Z", amount: { value: -100, currency: "GBP" }, details: { type: "CARD" } },
        ],
      },
    });

    expect(statement.credits).toBe(600);
    expect(statement.debits).toBe(100);
    expect(statement.transactionCount).toBe(2);
    expect(statement.transactions).toEqual([
      { date: "2026-08-05", amount: 600, direction: "credit", description: "Deposit", currency: "GBP" },
      { date: "2026-08-06", amount: 100, direction: "debit", description: "CARD", currency: "GBP" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/wise && bun test statement.test.ts`
Expected: FAIL — `buildWiseStatement` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/wise/src/statement.ts`:

```ts
import { deriveOpeningBalance, type Statement, type StatementPeriod, type StatementTransaction } from "@finclis/cli-utils";

export interface WiseStatementInput {
  currency: string;
  period: StatementPeriod;
  balanceId: number | string;
  currentBalanceAmount: number;
  statement: any;
}

function toStatementTransaction(t: any, fallbackCurrency: string): StatementTransaction {
  const value = t.amount.value;
  return {
    date: (t.date || "").slice(0, 10),
    amount: Math.abs(value),
    direction: value >= 0 ? "credit" : "debit",
    description: t.details?.description || t.details?.type || "",
    currency: t.amount.currency || fallbackCurrency,
  };
}

export function buildWiseStatement(input: WiseStatementInput): Statement {
  const txs = input.statement.transactions || [];
  const credits = txs.filter((t: any) => t.amount.value > 0).reduce((s: number, t: any) => s + t.amount.value, 0);
  const debits = txs.filter((t: any) => t.amount.value < 0).reduce((s: number, t: any) => s + Math.abs(t.amount.value), 0);

  const reportedStart = input.statement.startOfStatementBalance?.amount?.value;
  const reportedEnd = input.statement.endOfStatementBalance?.amount?.value;

  const notes: string[] = [];
  let opening: number;
  let closing: number;
  let source: "reported" | "derived";

  if (reportedStart !== undefined && reportedEnd !== undefined) {
    opening = reportedStart;
    closing = reportedEnd;
    source = "reported";
  } else {
    closing = input.currentBalanceAmount;
    opening = deriveOpeningBalance(closing, credits - debits);
    source = "derived";
    notes.push("Vendor did not return period-native balances; closing balance approximated from the current balance.");
  }

  return {
    platform: "wise",
    account: { id: String(input.balanceId), name: `${input.currency} balance` },
    accountType: "bank",
    period: input.period,
    currency: input.currency,
    balance: { opening, closing, type: "cash", source },
    cashBalance: null,
    credits,
    debits,
    transactionCount: txs.length,
    transactionsAvailable: true,
    transactions: txs.map((t: any) => toStatementTransaction(t, input.currency)),
    notes,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/wise && bun test statement.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/wise/src/statement.ts packages/wise/src/statement.test.ts
git commit -m "feat(wise): add pure statement mapper"
```

---

### Task 2: `statement` command (I/O)

**Files:**
- Create: `packages/wise/src/commands/statement.ts`
- Test: `packages/wise/src/commands/statement.test.ts`

**Interfaces:**
- Consumes: `buildWiseStatement` (Task 1); `wiseGet`, `getProfileId` from `../client.js`; `validateCurrency` from `../validate.js`; `monthToPeriod`, `printStatement`, `writeJson`, `handleJsonError` from `@finclis/cli-utils`.
- Produces: `export async function statementCommand(opts?: StatementOpts): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `packages/wise/src/commands/statement.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object using reported balances", async () => {
    const balances = [
      { id: 42, currency: "GBP", type: "STANDARD", amount: { value: 1500, currency: "GBP" } },
    ];
    const statement = {
      startOfStatementBalance: { amount: { value: 1234.56, currency: "GBP" } },
      endOfStatementBalance: { amount: { value: 1500, currency: "GBP" } },
      transactions: [
        { date: "2026-08-05T10:00:00Z", amount: { value: -3.5, currency: "GBP" }, details: { description: "Coffee shop" } },
      ],
    };
    mockWiseGet.mockResolvedValueOnce(balances).mockResolvedValueOnce(statement);

    await statementCommand({ month: "2026-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("wise");
    expect(parsed.period.month).toBe("2026-08");
    expect(parsed.balance).toEqual({ opening: 1234.56, closing: 1500, type: "cash", source: "reported" });
    expect(parsed.transactionCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/wise && bun test commands/statement.test.ts`
Expected: FAIL — `commands/statement.ts` doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/wise/src/commands/statement.ts`:

```ts
import { wiseGet, getProfileId } from "../client.js";
import { validateCurrency } from "../validate.js";
import { buildWiseStatement } from "../statement.js";
import { monthToPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
  currency?: string;
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  try {
    const profileId = getProfileId();
    const monthStr = opts.month ?? currentMonthString();
    const period = monthToPeriod(monthStr);

    const balances = await wiseGet(`/v4/profiles/${profileId}/balances?types=STANDARD`);
    if (!balances.length) {
      throw new Error("No balances found");
    }
    const currency = opts.currency ? validateCurrency(opts.currency) : undefined;
    const balance = currency ? balances.find((b: any) => b.currency === currency) : balances[0];
    if (!balance) {
      throw new Error(`No ${currency} balance found`);
    }
    const resolvedCurrency = balance.currency;
    const balanceId = balance.id || balance.balanceId;

    const params = new URLSearchParams({
      currency: resolvedCurrency,
      intervalStart: `${period.start}T00:00:00.000Z`,
      intervalEnd: `${period.end}T23:59:59.999Z`,
      type: "FLAT",
    });
    const url = `/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json?${params}`;
    const rawStatement = await wiseGet(url);

    const statement = buildWiseStatement({
      currency: resolvedCurrency,
      period,
      balanceId,
      currentBalanceAmount: balance.amount.value,
      statement: rawStatement,
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

Run: `cd packages/wise && bun test commands/statement.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/wise/src/commands/statement.ts packages/wise/src/commands/statement.test.ts
git commit -m "feat(wise): add statement command"
```

---

### Task 3: Register the command

**Files:**
- Modify: `packages/wise/src/index.ts`

- [ ] **Step 1: Add the import and command registration**

Add near the other command imports (alongside the existing `import { statementsCommand } from "./commands/statements.js";`):

```ts
import { statementCommand } from "./commands/statement.js";
```

Add after the existing `statements` command block:

```ts
program
  .command("statement")
  .description("Standard bank-statement-style report for a month")
  .option("--month <YYYY-MM>", "Month to report on (default: current)")
  .option("--currency <CODE>", "Balance currency (default: primary balance)")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .addHelpText("after", "\nExamples:\n  wise statement --month 2026-08\n  wise statement --month 2026-08 --currency EUR --json")
  .action(statementCommand);
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/wise && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full wise test suite**

Run: `cd packages/wise && bun test`
Expected: all tests pass (existing + the 4 new ones).

- [ ] **Step 4: Commit**

```bash
git add packages/wise/src/index.ts
git commit -m "feat(wise): register statement command"
```

## Manual verification (for the human to run — requires a live Wise session)

```bash
cd packages/wise
bun src/index.ts statement --month <a-recent-YYYY-MM>
bun src/index.ts statement --month <a-recent-YYYY-MM> --json | jq .
```

Confirm: `balance.source` is `"reported"` (i.e. the live `statement.json` really does return `startOfStatementBalance`/`endOfStatementBalance` — if it comes back `"derived"` instead, the field names in `buildWiseStatement` need adjusting to match the real response, which you should paste back for a follow-up fix). Compare totals against `wise statements --currency <code> --from <period.start> --to <period.end>`.
