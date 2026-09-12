export type BalanceType = "cash" | "portfolio";
export type BalanceSource = "reported" | "derived";
export type TransactionDirection = "credit" | "debit";

export interface StatementTransaction {
  date: string; // "YYYY-MM-DD"
  amount: number; // positive, major currency units
  direction: TransactionDirection;
  description: string;
  currency: string; // ISO 4217, e.g. "GBP"
}

export interface StatementBalance {
  opening: number;
  closing: number;
  type: BalanceType;
  source: BalanceSource;
}

export interface StatementCashBalance {
  asOf: string; // "YYYY-MM-DD"
  amount: number;
}

export interface StatementPeriod {
  month: string; // "YYYY-MM"
  start: string; // "YYYY-MM-DD"
  end: string; // "YYYY-MM-DD"
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

export function deriveClosingBalance(currentBalance: number, flowsSincePeriodEnd: number): number {
  return currentBalance - flowsSincePeriodEnd;
}

export function deriveOpeningBalance(closingBalance: number, netFlowDuringPeriod: number): number {
  return closingBalance - netFlowDuringPeriod;
}

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
    console.log(
      `Cash Balance:     ${fmtAmount(statement.cashBalance.amount, statement.currency)} (as of ${statement.cashBalance.asOf})`
    );
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
