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
