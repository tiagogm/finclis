import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CACHE_DIR = path.join(os.homedir(), ".lloyds-cli", "cache");
const TXN_DIR = path.join(CACHE_DIR, "transactions");
const SUM_DIR = path.join(CACHE_DIR, "summaries");

export function readCachedTransactions(monthKey: string): any[] | null {
  const file = path.join(TXN_DIR, `${monthKey}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

export function writeCachedTransactions(monthKey: string, data: any[]): void {
  fs.mkdirSync(TXN_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(TXN_DIR, `${monthKey}.json`),
    JSON.stringify(data, null, 2),
    { mode: 0o600 }
  );
}

export function readCachedSummary(monthKey: string): any | null {
  const file = path.join(SUM_DIR, `${monthKey}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

export function writeCachedSummary(monthKey: string, data: any): void {
  fs.mkdirSync(SUM_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(SUM_DIR, `${monthKey}.json`),
    JSON.stringify(data, null, 2),
    { mode: 0o600 }
  );
}
