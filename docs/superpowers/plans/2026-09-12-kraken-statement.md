# Kraken `statement` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `kraken statement --month YYYY-MM [--asset CODE] --json` producing the common `Statement` schema, scoped to a single asset's balance. Kraken has no point-in-time balance endpoint, so balance is derived by walking back from the current `/0/private/Balance` amount using **funding (deposit/withdrawal) ledger entries only** — trades are deliberately excluded from both the balance derivation and the transaction list, per an explicit product decision (a crypto trade converts one asset to another; it is not "money in/out" of the exchange the way a bank statement means it, and mixing it in would make credits/debits meaningless).

**Architecture:** A pure mapper `buildKrakenStatement()` in a new `packages/kraken/src/statement.ts` takes already-fetched ledger entries and returns a `Statement`. A new `packages/kraken/src/commands/statement.ts` fetches the current balance and paginates through `/0/private/Ledgers` for the requested asset (reusing the same endpoint `commands/funding.ts` already uses, filtered client-side to `deposit`/`withdrawal` exactly like `funding.ts`'s existing `clientFilter` behavior).

**Tech Stack:** TypeScript, Commander, Bun test runner, `@finclis/cli-utils` (`Statement`, `resolveStatementPeriod`, `deriveClosingBalance`, `deriveOpeningBalance`, `printStatement` — already merged to `main`).

**Spec:** `docs/superpowers/specs/2026-09-12-unified-statement-command-design.md`

## Global Constraints

- `--month YYYY-MM` (default: current month), `--asset <CODE>` (Kraken's raw asset code, e.g. `XXBT`, `ZUSD` — same codes `/0/private/Balance` and `/0/private/Ledgers`'s `asset` param use; if omitted, default to the first non-zero fiat balance — an asset code starting with `Z`), `--json`, `-v/--verbose`.
- Use `resolveStatementPeriod()` from `@finclis/cli-utils`, **not** this package's own `parseMonth`/`monthBounds` — it clamps the current in-progress month's end to today and rejects future months. Note this package's `monthBounds` returns Unix-seconds timestamps (not ISO strings) — you still need `resolveStatementPeriod` for the YYYY-MM-DD period object, then convert its `start`/`end` to Unix seconds yourself for the Kraken API calls.
- `accountType = "exchange"`, `balance.type = "cash"`, `balance.source = "derived"`. `currency` in the `Statement` is the raw asset code (e.g. `"XXBT"`) — not a real ISO 4217 code, but the only unambiguous identifier Kraken gives you for a non-fiat asset.
- `notes` must include exactly: `"Trades excluded — funding (deposits/withdrawals) only"`.
- **Error handling matches this package's existing convention** (see `commands/funding.ts`/`commands/history.ts`): `process.exit(1)` on failure, not `process.exit(0)`.
- Kraken's `/0/private/Ledgers` paginates; you must fetch **all** pages within the requested time range (not just the first page like the interactive `funding` command does), since a statement needs the complete picture.

---

### Task 1: Pure statement mapper

**Files:**
- Create: `packages/kraken/src/statement.ts`
- Test: `packages/kraken/src/statement.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface LedgerEntry {
    time: number;      // Unix seconds
    type: string;       // "deposit" | "withdrawal" | "trade" | ...
    asset: string;
    amount: string;      // signed decimal string — positive for deposit, negative for withdrawal
    fee: string;
    balance: string;
    refid?: string;
  }

  export interface KrakenStatementInput {
    period: StatementPeriod;
    assetCode: string;
    periodEntries: [string, LedgerEntry][];   // [ledgerId, entry] pairs within the period, ALL types (filtered inside the mapper)
    afterEntries: [string, LedgerEntry][];    // same shape, for entries after period.end up to now
    currentBalance: number;
  }

  export function buildKrakenStatement(input: KrakenStatementInput): Statement;
  ```

- [ ] **Step 1: Write the failing test**

Create `packages/kraken/src/statement.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildKrakenStatement, type LedgerEntry } from "./statement.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    time: 1723000000, // within August 2026
    type: "deposit",
    asset: "ZUSD",
    amount: "500.0000",
    fee: "0.0000",
    balance: "1500.0000",
    refid: "REF1",
    ...overrides,
  };
}

describe("buildKrakenStatement", () => {
  it("derives closing from current balance and flows since period end", () => {
    const statement = buildKrakenStatement({
      period,
      assetCode: "ZUSD",
      periodEntries: [["L1", entry({ amount: "500.0000" })], ["L2", entry({ amount: "-100.0000", type: "withdrawal" })]],
      afterEntries: [["L3", entry({ amount: "50.0000" })]],
      currentBalance: 2000,
    });

    // closing = 2000 - 50 (flow after period end) = 1950
    expect(statement.balance.closing).toBe(1950);
    // opening = closing - netFlowDuringPeriod(500 - 100 = 400) = 1550
    expect(statement.balance.opening).toBe(1550);
    expect(statement.balance.type).toBe("cash");
    expect(statement.balance.source).toBe("derived");
    expect(statement.accountType).toBe("exchange");
  });

  it("excludes trades from totals and the transaction list", () => {
    const statement = buildKrakenStatement({
      period,
      assetCode: "ZUSD",
      periodEntries: [
        ["L1", entry({ amount: "500.0000", type: "deposit" })],
        ["L2", entry({ amount: "-10.0000", type: "trade" })],
      ],
      afterEntries: [],
      currentBalance: 2000,
    });

    expect(statement.credits).toBe(500);
    expect(statement.transactionCount).toBe(1);
    expect(statement.transactions).toHaveLength(1);
    expect(statement.notes).toContain("Trades excluded — funding (deposits/withdrawals) only");
  });

  it("maps deposit/withdrawal entries with direction", () => {
    const statement = buildKrakenStatement({
      period,
      assetCode: "XXBT",
      periodEntries: [["L1", entry({ time: 1723200000, amount: "-0.5000", type: "withdrawal", asset: "XXBT", refid: "REF2" })]],
      afterEntries: [],
      currentBalance: 1,
    });

    expect(statement.transactions).toEqual([
      { date: "2026-08-09", amount: 0.5, direction: "debit", description: "withdrawal (REF2)", currency: "XXBT" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/kraken && bun test statement.test.ts`
Expected: FAIL — `buildKrakenStatement` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/kraken/src/statement.ts`:

```ts
import { deriveClosingBalance, deriveOpeningBalance, type Statement, type StatementPeriod, type StatementTransaction } from "@finclis/cli-utils";

export interface LedgerEntry {
  time: number;
  type: string;
  asset: string;
  amount: string;
  fee: string;
  balance: string;
  refid?: string;
}

export interface KrakenStatementInput {
  period: StatementPeriod;
  assetCode: string;
  periodEntries: [string, LedgerEntry][];
  afterEntries: [string, LedgerEntry][];
  currentBalance: number;
}

function isFunding(entry: LedgerEntry): boolean {
  return entry.type === "deposit" || entry.type === "withdrawal";
}

function netFlow(entries: [string, LedgerEntry][]): { credits: number; debits: number } {
  let credits = 0;
  let debits = 0;
  for (const [, e] of entries) {
    if (e.type === "deposit") credits += parseFloat(e.amount);
    else if (e.type === "withdrawal") debits += Math.abs(parseFloat(e.amount));
  }
  return { credits, debits };
}

export function buildKrakenStatement(input: KrakenStatementInput): Statement {
  const fundingEntries = input.periodEntries.filter(([, e]) => isFunding(e));
  const afterFunding = input.afterEntries.filter(([, e]) => isFunding(e));

  const { credits, debits } = netFlow(fundingEntries);
  const after = netFlow(afterFunding);
  const flowsSincePeriodEnd = after.credits - after.debits;

  const closing = deriveClosingBalance(input.currentBalance, flowsSincePeriodEnd);
  const opening = deriveOpeningBalance(closing, credits - debits);

  const transactions: StatementTransaction[] = fundingEntries
    .map(([, e]): StatementTransaction => ({
      date: new Date(e.time * 1000).toISOString().slice(0, 10),
      amount: Math.abs(parseFloat(e.amount)),
      direction: e.type === "deposit" ? "credit" : "debit",
      description: `${e.type}${e.refid ? ` (${e.refid})` : ""}`,
      currency: input.assetCode,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    platform: "kraken",
    account: { id: input.assetCode, name: `${input.assetCode} balance` },
    accountType: "exchange",
    period: input.period,
    currency: input.assetCode,
    balance: { opening, closing, type: "cash", source: "derived" },
    cashBalance: null,
    credits,
    debits,
    transactionCount: fundingEntries.length,
    transactionsAvailable: true,
    transactions,
    notes: ["Trades excluded — funding (deposits/withdrawals) only"],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/kraken && bun test statement.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/kraken/src/statement.ts packages/kraken/src/statement.test.ts
git commit -m "feat(kraken): add pure statement mapper"
```

---

### Task 2: `statement` command (I/O)

**Files:**
- Create: `packages/kraken/src/commands/statement.ts`
- Test: `packages/kraken/src/commands/statement.test.ts`

**Interfaces:**
- Consumes: `buildKrakenStatement` (Task 1); `krakenPrivatePost` from `../client.js`; `resolveStatementPeriod`, `printStatement`, `writeJson`, `handleJsonError` from `@finclis/cli-utils`. Reuses the existing `packages/kraken/src/commands/__test-helpers.ts` mocking module (already exists — do not recreate it).
- Produces: `export async function statementCommand(opts?: StatementOpts): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `packages/kraken/src/commands/statement.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockKrakenPrivatePost, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for the default fiat asset", async () => {
    mockKrakenPrivatePost.mockImplementation(async (path: string, params: Record<string, string> = {}) => {
      if (path === "/0/private/Balance") {
        return { ZUSD: "2000.0000", XXBT: "0" };
      }
      if (path === "/0/private/Ledgers") {
        if (params.ofs === "0" && params.start === "1754006400") {
          return {
            ledger: {
              L1: { time: 1754006500, type: "deposit", asset: "ZUSD", amount: "500.0000", fee: "0", balance: "2000.0000", refid: "REF1" },
            },
            count: 1,
          };
        }
        return { ledger: {}, count: 0 };
      }
      throw new Error(`Unexpected call: ${path}`);
    });

    await statementCommand({ month: "2025-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("kraken");
    expect(parsed.account.id).toBe("ZUSD");
    expect(parsed.period.month).toBe("2025-08");
    expect(parsed.transactionCount).toBe(1);
  });

  it("uses --asset when explicitly given", async () => {
    mockKrakenPrivatePost.mockImplementation(async (path: string) => {
      if (path === "/0/private/Balance") return { ZUSD: "2000.0000", XXBT: "0.5000" };
      if (path === "/0/private/Ledgers") return { ledger: {}, count: 0 };
      throw new Error(`Unexpected call: ${path}`);
    });

    await statementCommand({ month: "2025-08", asset: "XXBT", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.account.id).toBe("XXBT");
  });

  it("errors clearly when no asset is given and no fiat balance exists", async () => {
    mockKrakenPrivatePost.mockImplementation(async (path: string) => {
      if (path === "/0/private/Balance") return { XXBT: "0.5000" };
      throw new Error(`Unexpected call: ${path}`);
    });

    const originalExit = process.exit;
    process.exit = (() => undefined) as any;
    try {
      await statementCommand({ month: "2025-08", json: true });
    } finally {
      process.exit = originalExit;
    }

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.message).toContain("--asset");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/kraken && bun test commands/statement.test.ts`
Expected: FAIL — `commands/statement.ts` doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/kraken/src/commands/statement.ts`:

```ts
import { krakenPrivatePost } from "../client.js";
import { buildKrakenStatement, type LedgerEntry } from "../statement.js";
import { resolveStatementPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
  asset?: string;
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function defaultFiatAsset(balances: Record<string, string>): string {
  const fiat = Object.entries(balances).find(([asset, amt]) => asset.startsWith("Z") && parseFloat(amt) !== 0);
  if (!fiat) {
    throw new Error("No default fiat balance found — specify an asset explicitly with --asset (e.g. --asset XXBT).");
  }
  return fiat[0];
}

async function fetchAllLedgerEntries(asset: string, startSec: number, endSec: number): Promise<[string, LedgerEntry][]> {
  const all: [string, LedgerEntry][] = [];
  let ofs = 0;
  while (true) {
    const result = await krakenPrivatePost("/0/private/Ledgers", {
      asset,
      start: String(startSec),
      end: String(endSec),
      ofs: String(ofs),
    });
    const entries = Object.entries(result.ledger as Record<string, LedgerEntry>);
    all.push(...entries);
    if (entries.length === 0) break;
    ofs += entries.length;
    const total = result.count as number;
    if (ofs >= total) break;
  }
  return all;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  try {
    const monthStr = opts.month ?? currentMonthString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const period = resolveStatementPeriod(monthStr, todayStr);

    const balances = await krakenPrivatePost("/0/private/Balance", {});
    const assetCode = opts.asset ? opts.asset.toUpperCase() : defaultFiatAsset(balances);
    if (!(assetCode in balances)) {
      throw new Error(`No balance found for asset "${assetCode}".`);
    }
    const currentBalance = parseFloat(balances[assetCode]);

    const periodStartSec = Math.floor(new Date(`${period.start}T00:00:00.000Z`).getTime() / 1000);
    const periodEndSec = Math.floor(new Date(`${period.end}T23:59:59.999Z`).getTime() / 1000);
    const nowSec = Math.floor(Date.now() / 1000);

    const periodEntries = await fetchAllLedgerEntries(assetCode, periodStartSec, periodEndSec);
    const afterEntries =
      periodEndSec < nowSec ? await fetchAllLedgerEntries(assetCode, periodEndSec + 1, nowSec) : [];

    const statement = buildKrakenStatement({
      period,
      assetCode,
      periodEntries,
      afterEntries,
      currentBalance,
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/kraken && bun test commands/statement.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/kraken/src/commands/statement.ts packages/kraken/src/commands/statement.test.ts
git commit -m "feat(kraken): add statement command"
```

---

### Task 3: Register the command

**Files:**
- Modify: `packages/kraken/src/index.ts`

- [ ] **Step 1: Add the import and command registration**

Add near the other command imports:

```ts
import { statementCommand } from "./commands/statement.js";
```

Add a new top-level command (not nested under `funding` — this is account-wide per-asset, matching how `balances` sits at the top level):

```ts
program
  .command("statement")
  .description("Standard statement-style report for a month, scoped to one asset (funding only, trades excluded)")
  .option("--month <YYYY-MM>", "Month to report on (default: current)")
  .option("--asset <CODE>", "Asset to report on, e.g. XXBT, ZUSD (default: primary fiat balance)")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .addHelpText("after", "\nExamples:\n  kraken statement --month 2026-08\n  kraken statement --month 2026-08 --asset XXBT --json")
  .action(statementCommand);
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/kraken && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full kraken test suite**

Run: `cd packages/kraken && bun test`
Expected: all tests pass (existing + the 6 new ones).

- [ ] **Step 4: Commit**

```bash
git add packages/kraken/src/index.ts
git commit -m "feat(kraken): register statement command"
```

## Manual verification (for the human to run — requires a live Kraken API key)

```bash
cd packages/kraken
bun src/index.ts statement --month <a-recent-YYYY-MM>
bun src/index.ts statement --month <a-recent-YYYY-MM> --asset XXBT --json | jq .
```

Confirm: `credits`/`debits`/`transactionCount` match `bun src/index.ts funding history --month <same> --type deposit` and `--type withdrawal` combined; `balance.closing` for the current month is close to the value shown by `bun src/index.ts balances` for the same asset (won't be exact if trades happened, since those are intentionally excluded — that's expected, not a bug).
