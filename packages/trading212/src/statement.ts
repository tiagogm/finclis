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
