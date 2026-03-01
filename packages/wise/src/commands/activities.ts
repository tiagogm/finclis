import { wiseGet, getProfileId, setVerbose } from "../client.js";
import { prompt } from "../auth.js";
import { parseMonth, monthBounds } from "../validate.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

const ANSI: Record<string, string> = {
  strong: "\x1b[1m",
  green: "\x1b[32m",
  positive: "\x1b[32m",
  red: "\x1b[31m",
};
const RESET = "\x1b[0m";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatTitle(title: string, isTTY: boolean): string {
  if (isTTY) {
    return title.replace(/<(strong|green|positive|red)>(.*?)<\/\1>/g, (_match, tag, content) => {
      return `${ANSI[tag]}${content}${RESET}`;
    });
  }
  return title.replace(/<\/?(strong|green|positive|red)>/g, "");
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
    date: (a.createdOn || a.visibleOn)?.slice(0, 10) || "",
    status: a.status || "",
    type: a.type || "",
    title: formatTitle(a.title || "", isTTY),
    amount: formatTitle(formatAmount(a.primaryAmount, a.secondaryAmount), isTTY),
  }));

  const w = {
    date: Math.max(4, ...rows.map(r => r.date.length)),
    status: Math.max(6, ...rows.map(r => r.status.length)),
    type: Math.max(4, ...rows.map(r => r.type.length)),
    title: Math.max(5, ...rows.map(r => stripAnsi(r.title).length)),
    amount: Math.max(6, ...rows.map(r => stripAnsi(r.amount).length)),
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

interface FetchOpts {
  profileId: number;
  size: number;
  since?: string;
  until?: string;
  status?: string;
  type?: string;
  cursor?: string;
}

async function fetchActivities(opts: FetchOpts): Promise<{ activities: any[]; cursor: string | null }> {
  const params = new URLSearchParams({ size: String(opts.size) });
  if (opts.since) params.append("since", opts.since);
  if (opts.until) params.append("until", opts.until);
  if (opts.status) params.append("status", opts.status);
  if (opts.type) params.append("monetaryResourceType", opts.type);
  if (opts.cursor) params.append("nextCursor", opts.cursor);

  const data = await wiseGet(`/v1/profiles/${opts.profileId}/activities?${params}`);
  const activities = Array.isArray(data) ? data : (data.activities || []);
  const cursor = Array.isArray(data) ? null : (data.cursor || null);
  return { activities, cursor };
}

const MAX_PAGES = 100;

interface ActivitiesOpts extends BaseCommandOpts {
  month?: string | true;
  status?: string;
  type?: string;
  size?: string;
  from?: string;
  to?: string;
}

export async function activitiesCommand(opts: ActivitiesOpts): Promise<void> {
  try {
    if (opts.verbose) setVerbose(true);
    const profileId = getProfileId();

    if (opts.json) {
      let since: string | undefined;
      let until: string | undefined;

      if (opts.from || opts.to) {
        since = opts.from ? new Date(opts.from).toISOString() : undefined;
        until = opts.to ? new Date(opts.to + "T23:59:59.999Z").toISOString() : undefined;
      } else if (opts.month) {
        const now = new Date();
        const { month, year } = opts.month === true
          ? { month: now.getMonth() + 1, year: now.getFullYear() }
          : parseMonth(opts.month as string) ?? { month: now.getMonth() + 1, year: now.getFullYear() };
        const bounds = monthBounds(month, year);
        since = bounds.since;
        until = bounds.until;
      }

      const status = opts.status?.toUpperCase() || "COMPLETED";
      const allActivities: any[] = [];
      let cursor: string | undefined;
      let pages = 0;

      do {
        const result = await fetchActivities({
          profileId,
          size: 100,
          since,
          until,
          status,
          type: opts.type,
          cursor,
        });
        allActivities.push(...result.activities);
        cursor = result.cursor ?? undefined;
        pages++;
      } while (cursor && pages < MAX_PAGES);

      writeJson(allActivities);
      return;
    }

    const isTTY = process.stdout.isTTY ?? false;
    const size = opts.size ? Number(opts.size) : 10;

    if (opts.size && (isNaN(size) || !Number.isInteger(size) || size < 1 || size > 100)) {
      console.error("Size must be a whole number between 1 and 100.");
      process.exit(0);
    }

    const status = opts.status?.toUpperCase();
    const now = new Date();
    const nowMonth = now.getMonth() + 1;
    const nowYear = now.getFullYear();
    const isMonthMode = opts.month !== undefined;
    let currentMonth: number;
    let currentYear: number;

    if (isMonthMode) {
      if (opts.month === true) {
        currentMonth = nowMonth;
        currentYear = nowYear;
      } else {
        const parsed = parseMonth(opts.month as string);
        if (!parsed) {
          console.error(`Invalid month: "${opts.month}". Expected MM-YYYY (e.g. 02-2026).`);
          process.exit(0);
        }
        if (parsed.year > nowYear || (parsed.year === nowYear && parsed.month > nowMonth)) {
          console.error(`Invalid month: "${opts.month}" is in the future.`);
          process.exit(0);
        }
        currentMonth = parsed.month;
        currentYear = parsed.year;
      }
    } else {
      currentMonth = 0;
      currentYear = 0;
    }

    let cursor: string | undefined;

    while (true) {
      const fetchOpts: FetchOpts = { profileId, size, status, type: opts.type };

      if (isMonthMode) {
        const bounds = monthBounds(currentMonth, currentYear);
        fetchOpts.since = bounds.since;
        fetchOpts.until = bounds.until;
      }

      if (cursor) fetchOpts.cursor = cursor;

      const result = await fetchActivities(fetchOpts);

      if (isMonthMode) {
        console.log(`\nActivities (${result.activities.length}) — ${monthLabel(currentMonth, currentYear)}\n`);
      } else {
        console.log(`\nActivities (${result.activities.length})\n`);
      }

      printActivities(result.activities, isTTY);

      const nav: string[] = [];
      if (result.cursor) nav.push("[n]ext page");
      if (isMonthMode) {
        nav.push("[p]rev month");
        nav.push("[f]orward month");
      }
      nav.push("[q]uit");

      if (nav.length === 1) {
        break;
      }

      // Compute whether forward month would still be in the past/present
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const canGoForward = isMonthMode &&
        (nextYear < nowYear || (nextYear === nowYear && nextMonth <= nowMonth));

      const visibleNav = nav.filter(n => n !== "[f]orward month" || canGoForward);

      let input: string;
      while (true) {
        input = (await prompt(`\n${visibleNav.join("  ")}  `)).trim().toLowerCase();
        if (
          (input === "n" && result.cursor) ||
          (input === "p" && isMonthMode) ||
          (input === "f" && canGoForward) ||
          input === "q" ||
          input === ""
        ) break;
      }

      if (input === "n" && result.cursor) {
        cursor = result.cursor;
      } else if (input === "p" && isMonthMode) {
        currentMonth--;
        if (currentMonth < 1) {
          currentMonth = 12;
          currentYear--;
        }
        cursor = undefined;
      } else if (input === "f" && canGoForward) {
        currentMonth = nextMonth;
        currentYear = nextYear;
        cursor = undefined;
      } else if (input === "q" || input === "") {
        break;
      }
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
