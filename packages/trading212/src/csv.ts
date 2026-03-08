function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

export type CSVTxType = "deposit" | "withdrawal" | "interest" | "dividend" | "other";

export interface CSVTx {
  date: string;
  amount: number;
  action: string;
  type: CSVTxType;
}

function classifyAction(action: string): CSVTxType {
  const lower = action.toLowerCase();
  if (lower === "deposit") return "deposit";
  if (lower === "withdrawal" || lower === "card debit") return "withdrawal";
  if (lower.includes("interest") || lower.includes("lending")) return "interest";
  if (lower.includes("dividend")) return "dividend";
  return "other";
}

export function parseTransactionsCSV(csvContent: string): CSVTx[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());

  const actionIndex = headers.findIndex(
    (h) => h === "action" || h === "type" || h === "transaction type"
  );
  const timeIndex = headers.findIndex(
    (h) => h === "time" || h === "date" || h === "datetime" || h === "date/time"
  );
  const amountIndex = headers.findIndex(
    (h) =>
      h === "total" ||
      h === "amount" ||
      h === "result" ||
      h.startsWith("total (")
  );

  if (actionIndex === -1) {
    console.warn("CSV parser: Could not find action/type column. Headers:", headers);
    return [];
  }

  const transactions: CSVTx[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const action = fields[actionIndex] || "";
    const type = classifyAction(action);

    if (type === "other") continue;

    const dateStr = timeIndex !== -1 ? fields[timeIndex] : "";
    let amount = 0;

    if (amountIndex !== -1) {
      const amountStr = fields[amountIndex] || "0";
      amount = parseFloat(amountStr.replace(/[^0-9.-]/g, "")) || 0;
    }

    transactions.push({ date: dateStr, amount, action, type });
  }

  return transactions;
}
