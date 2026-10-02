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

function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = dmy;
    return new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss)).toISOString();
  }
  const iso = s.replace(" ", "T");
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`;
  const d = new Date(zoned);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

export function parseTransactionsCSV(csvContent: string): CSVTx[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCSVLine(lines[0].replace(/^\uFEFF/, "")).map((h) =>
    h.toLowerCase().trim()
  );

  const actionIndex = headers.findIndex(
    (h) => h === "action" || h === "type" || h === "transaction type"
  );
  const timeIndex = headers.findIndex(
    (h) => h.startsWith("time") || h.startsWith("date")
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

  if (timeIndex === -1) {
    console.warn("CSV parser: Could not find time/date column. Headers:", headers);
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

    transactions.push({ date: normalizeDate(dateStr), amount, action, type });
  }

  return transactions;
}
