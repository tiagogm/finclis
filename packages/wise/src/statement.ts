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
