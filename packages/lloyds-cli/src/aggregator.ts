// Ported from finance-connectors-poc/src/connectors/lloyds/

export interface LloydsTransaction {
  date: number; // Unix timestamp ms
  description: string;
  completeDescription: string[];
  payment_type?: string;
  paymentTypeForPanel?: string;
  money_in?: number;
  money_out?: number;
  balance: number;
  vtdHostCallRequired: boolean;
  txnId: string;
  completeTxnId: string;
}

export enum TransactionType {
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
  INTEREST = "INTEREST",
  OTHER = "OTHER",
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  type: TransactionType;
  reference?: string;
}

export interface FinancialSummary {
  period: { start: string; end: string; name: string };
  balances: {
    opening: number;
    closing: number;
    change: number;
    changePercent: number;
  };
  cashFlow: { deposits: number; withdrawals: number; net: number };
  passiveIncome: { interest: number; dividends: null; total: number };
  currency: string;
  metadata: {
    generatedAt: string;
    connector: string;
    transactionCount: number;
  };
}

export function categorizeTransaction(txn: LloydsTransaction): TransactionType {
  if (
    txn.description === "INTEREST (GROSS)" ||
    txn.description.startsWith("INTEREST")
  ) {
    return TransactionType.INTEREST;
  }
  if (txn.money_in !== undefined) return TransactionType.DEPOSIT;
  if (txn.money_out !== undefined) return TransactionType.WITHDRAWAL;
  return TransactionType.OTHER;
}

export function mapTransaction(txn: LloydsTransaction): Transaction {
  const type = categorizeTransaction(txn);
  const amount = txn.money_in ?? txn.money_out ?? 0;
  return {
    id: txn.txnId,
    date: new Date(txn.date).toISOString(),
    amount,
    currency: "GBP",
    description: txn.completeDescription.join(" - ") || txn.description,
    type,
    reference: txn.completeTxnId,
  };
}

export function buildFinancialSummary(
  transactions: Transaction[],
  rawTransactions: LloydsTransaction[],
  currentBalance: number,
  monthKey: string
): FinancialSummary {
  const deposits = transactions
    .filter((t) => t.type === TransactionType.DEPOSIT)
    .reduce((s, t) => s + t.amount, 0);
  const withdrawals = transactions
    .filter((t) => t.type === TransactionType.WITHDRAWAL)
    .reduce((s, t) => s + t.amount, 0);
  const interest = transactions
    .filter((t) => t.type === TransactionType.INTEREST)
    .reduce((s, t) => s + t.amount, 0);

  let opening = currentBalance;
  let closing = currentBalance;

  if (rawTransactions.length > 0) {
    // Raw transactions are newest-first from API
    const earliest = rawTransactions[rawTransactions.length - 1];
    const latest = rawTransactions[0];

    if (earliest.money_in !== undefined) {
      opening = earliest.balance - earliest.money_in;
    } else if (earliest.money_out !== undefined) {
      opening = earliest.balance + earliest.money_out;
    } else {
      opening = earliest.balance;
    }
    closing = latest.balance;
  }

  const change = closing - opening;
  const changePercent = opening !== 0 ? change / opening : 0;

  const [year, mon] = monthKey.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, mon - 1, 1));
  const endDate = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
  const periodName = startDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      name: periodName,
    },
    balances: { opening, closing, change, changePercent },
    cashFlow: { deposits, withdrawals, net: deposits - withdrawals },
    passiveIncome: { interest, dividends: null, total: interest },
    currency: "GBP",
    metadata: {
      generatedAt: new Date().toISOString(),
      connector: "lloyds",
      transactionCount: transactions.length,
    },
  };
}
