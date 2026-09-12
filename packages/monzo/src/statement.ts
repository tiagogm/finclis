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
