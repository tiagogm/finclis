import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CACHE_PATH = path.join(os.homedir(), ".trading212-cli", "export-cache.json");

interface CacheEntry {
  fromDate: string;
  toDate: string;
  reportId: number;
}

function read(): CacheEntry[] {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as CacheEntry[];
  } catch {
    return [];
  }
}

function write(entries: CacheEntry[]): void {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(entries, null, 2));
}

export function getCachedReportId(fromDate: string, toDate: string): number | null {
  return read().find((e) => e.fromDate === fromDate && e.toDate === toDate)?.reportId ?? null;
}

export function setCachedReportId(fromDate: string, toDate: string, reportId: number): void {
  const entries = read();
  const idx = entries.findIndex((e) => e.fromDate === fromDate && e.toDate === toDate);
  if (idx !== -1) {
    entries[idx].reportId = reportId;
  } else {
    entries.push({ fromDate, toDate, reportId });
  }
  write(entries);
}

/** True when toDate is fully in the past (not the current month). */
export function isPastPeriod(toDate: string): boolean {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(toDate) < startOfToday;
}
