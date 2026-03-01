import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CACHE_DIR = path.join(os.homedir(), ".vanguard-cli", "cache");

function cacheKey(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `monthly-${year}-${mm}.json`;
}

export function isPastMonth(month: number, year: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year < currentYear || (year === currentYear && month < currentMonth);
}

export function loadCachedMonth(
  year: number,
  month: number
): any | null {
  const filePath = path.join(CACHE_DIR, cacheKey(year, month));
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCachedMonth(
  year: number,
  month: number,
  data: any
): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
  const filePath = path.join(CACHE_DIR, cacheKey(year, month));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

/**
 * Parse Vanguard's month label format "Jan 2026" into { month, year }.
 */
export function parseVanguardMonthLabel(label: string): { month: number; year: number } | null {
  const months: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };
  const parts = label.trim().split(" ");
  if (parts.length !== 2) return null;
  const month = months[parts[0]];
  const year = parseInt(parts[1], 10);
  if (!month || isNaN(year)) return null;
  return { month, year };
}
