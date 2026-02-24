import { wiseGet, getProfileId } from "../client.js";
import { prompt } from "../auth.js";
import { parseMonth, monthBounds } from "../validate.js";

const ANSI: Record<string, string> = {
  strong: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};
const RESET = "\x1b[0m";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatTitle(title: string, isTTY: boolean): string {
  if (isTTY) {
    return title.replace(/<(strong|green|red)>(.*?)<\/\1>/g, (_match, tag, content) => {
      return `${ANSI[tag]}${content}${RESET}`;
    });
  }
  return title.replace(/<\/?(strong|green|red)>/g, "");
}

export function monthLabel(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function formatAmount(primary: string, secondary: string | undefined | null): string {
  if (secondary) return `${primary} → ${secondary}`;
  return primary;
}

function printActivities(activities: any[], isTTY: boolean): void {
  if (activities.length === 0) {
    console.log("No activities found.");
    return;
  }

  const rows = activities.map((a: any) => ({
    date: a.createdOn?.slice(0, 10) || "",
    status: a.status || "",
    type: a.type || "",
    title: formatTitle(a.title || "", isTTY),
    amount: formatAmount(a.primaryAmount, a.secondaryAmount),
  }));

  const w = {
    date: Math.max(4, ...rows.map(r => r.date.length)),
    status: Math.max(6, ...rows.map(r => r.status.length)),
    type: Math.max(4, ...rows.map(r => r.type.length)),
    title: Math.max(5, ...rows.map(r => stripAnsi(r.title).length)),
    amount: Math.max(6, ...rows.map(r => r.amount.length)),
  };

  console.log(
    `${"Date".padEnd(w.date)}  ${"Status".padEnd(w.status)}  ${"Type".padEnd(w.type)}  ${"Title".padEnd(w.title)}  ${"Amount"}`
  );
  console.log(
    `${"─".repeat(w.date)}  ${"─".repeat(w.status)}  ${"─".repeat(w.type)}  ${"─".repeat(w.title)}  ${"─".repeat(w.amount)}`
  );

  for (const r of rows) {
    const titlePad = w.title - stripAnsi(r.title).length;
    console.log(
      `${r.date.padEnd(w.date)}  ${r.status.padEnd(w.status)}  ${r.type.padEnd(w.type)}  ${r.title}${" ".repeat(titlePad)}  ${r.amount}`
    );
  }
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}
