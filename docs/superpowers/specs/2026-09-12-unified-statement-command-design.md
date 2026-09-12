# Unified `statement` command — design

Date: 2026-09-12

## Goal

Add a `statement` command to every CLI package (monzo, wise, lloyds-cli,
trading212, vanguard, kraken) with a consistent interface:

```
<cli> statement --month YYYY-MM --json
```

producing a standard bank-statement-style report: period, opening/closing
balance, credits, debits, transaction count, and (where available) the full
transaction list — normalized into one common JSON shape so a wrapper script
can call all six CLIs identically and merge the results.

## Common JSON schema

```jsonc
{
  "platform": "monzo",
  "account": { "id": "acc_00...", "name": "Current Account" },
  "accountType": "bank" | "investment" | "exchange",
  "period": { "month": "2026-08", "start": "2026-08-01", "end": "2026-08-31" },
  "currency": "GBP",
  "balance": {
    "opening": 1234.56,
    "closing": 1500.00,
    "type": "cash" | "portfolio",     // portfolio = includes holdings value (Vanguard); cash = pure account balance
    "source": "reported" | "derived"  // reported = vendor gave it directly; derived = we computed it
  },
  "cashBalance": { "asOf": "2026-09-12", "amount": 320.00 } | null,  // investment accounts only, current snapshot (no history available)
  "credits": 2000.00,          // money in
  "debits": 734.56,            // money out
  "transactionCount": 42,
  "transactionsAvailable": true,
  "transactions": [
    { "date": "2026-08-05", "amount": 42.10, "direction": "credit" | "debit", "description": "...", "currency": "GBP" }
  ] | null,
  "notes": ["Balance excludes invested capital and unrealized P&L"]  // vendor-specific caveats, omitted if none
}
```

Field naming conventions:
- `platform` — the name matches the README's own term ("CLIs for popular
  financial platforms"); confirmed no existing use of "vendor" anywhere in
  the codebase.
- `credits` = money in, `debits` = money out (standard UK bank-statement
  convention — the reverse of a first draft of this spec).
- `balance.source` distinguishes a vendor-reported point-in-time balance
  from one we derived by walking back from the current balance using flows
  since the period.
- `transactions` is `null` (with `transactionsAvailable: false`) only when
  the platform genuinely has no per-transaction data at this granularity
  (Vanguard). Every other platform always includes the full list.

## Per-platform feasibility

Confirmed by reading each package's existing `client.ts` / `commands/*.ts`.

| Platform | Balance | Transactions | `notes` |
|---|---|---|---|
| **Monzo** | derived — walk back from live `GET /balance` using period transactions | full list | — |
| **Wise** | reported — `balance-statements/.../statement.json` returns period-native opening/closing balances directly | full list | requires `--currency`, defaults to primary balance |
| **Lloyds** | derived, but high-fidelity — each transaction already carries a running `balance` field, so opening/closing come from the first/last transaction rather than estimation | full list | — |
| **Trading212** | derived — walk back from `cash.free` (uninvested cash) using the CSV export's deposit/withdrawal/interest/dividend rows | full list (CSV rows) | "Excludes invested capital and unrealized P&L" |
| **Vanguard** | reported — `InvestmentMonthlyPerformance` gives Opening/Closing **portfolio value** (cash + holdings) directly; `balance.type = "portfolio"` | **totals only** — no per-transaction endpoint exists | "Balance is total portfolio value (cash + holdings)"; `cashBalance` is a current-only snapshot (not period-accurate — no historical cash-only endpoint) |
| **Kraken** | derived per `--asset` — walk back from current `Balance` using Ledger/funding entries only (trades excluded) | full list of funding entries only | "Trades excluded — funding (deposits/withdrawals) only" |

## Flags

- `--month YYYY-MM` — default: current month.
- `--json` — same convention as every existing command.
- `--currency <CODE>` — Wise only; defaults to the account's primary currency.
- `--asset <CODE>` — Kraken only; defaults to the account's primary/base asset.
- `-v, --verbose` — existing convention, logs HTTP requests.

Gating and caching behavior (Monzo's 90-day/SCA cache, Trading212's async
report polling, browser-session TTLs for wise/vanguard/lloyds) is reused
unchanged from each platform's existing commands — `statement` wraps the
same mechanisms rather than reimplementing them.

## Implementation approach

- New shared module `packages/cli-utils/src/statement.ts`:
  - `Statement` / `StatementTransaction` types (the schema above).
  - `printStatement(statement)` — human-readable formatter, reused by all
    six CLIs so non-JSON output looks consistent.
  - `deriveBalanceFromFlows(currentBalance, flowsSincePeriodEnd)` — the
    walk-back helper used by Monzo, Trading212, and Kraken.
- Each package gets `src/commands/statement.ts`: fetches data via the
  package's existing client functions, maps the raw response into the
  common schema, then calls the shared formatter / `writeJson`.
- Registered in each package's `index.ts` alongside existing commands,
  following the current `program.hook("preAction", ...)` + per-command
  `-v, --verbose` pattern.

## Error handling

- Same convention everywhere: `handleJsonError(err)` under `--json`,
  otherwise `console.error` + `process.exit(0)`.
- Missing `--currency`/`--asset` falls back to the account's primary
  currency/asset rather than erroring, and the resolved value is echoed in
  the output so it's never silently ambiguous.

## Testing

- Pure unit tests per platform: given fixture raw-API JSON, assert the
  mapped `Statement` object — following the existing colocated
  `*.test.ts` pattern.
- `deriveBalanceFromFlows()` gets its own unit tests in `cli-utils`.

## Out of scope (for this iteration)

- Kraken trade fills in the transaction list/totals (funding only for now).
- Cross-account report aggregation/orchestration (a separate concern once
  each CLI exposes `statement --json`).
