import type { Statement, StatementPeriod } from "@finclis/cli-utils";

export interface VanguardStatementInput {
  period: StatementPeriod;
  monthData: any;
  cashBalanceAmount: number;
  today: string;
}

export function buildVanguardStatement(input: VanguardStatementInput): Statement {
  if (!input.monthData) {
    throw new Error(`No performance data found for ${input.period.month}`);
  }

  const d = input.monthData.PerformanceDetail ?? {};
  const opening = d.OpeningValue?.Amount ?? 0;
  const closing = d.ClosingValue?.Amount ?? 0;
  const deposits = d.PaymentsIn?.Amount ?? 0;
  const withdrawals = d.PaymentsOut?.Amount ?? 0;

  return {
    platform: "vanguard",
    account: { id: "vanguard-investor", name: "Vanguard Investor Account" },
    accountType: "investment",
    period: input.period,
    currency: "GBP",
    balance: { opening, closing, type: "portfolio", source: "reported" },
    cashBalance: { asOf: input.today, amount: input.cashBalanceAmount },
    credits: deposits,
    debits: withdrawals,
    transactionCount: 0,
    transactionsAvailable: false,
    transactions: null,
    notes: [
      "Balance is total portfolio value (cash + holdings), not cash alone.",
      "Cash balance is a current snapshot, not period-accurate — no historical cash-only endpoint exists.",
    ],
  };
}
