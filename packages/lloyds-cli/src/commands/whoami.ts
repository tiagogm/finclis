import { getClient, requireSession } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const IDLE_TIMEOUT_SECS = 10 * 60;

function formatTime(secs: number, suffix = ""): string {
  if (secs < 60) return `${secs}s${suffix}`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m${suffix}`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m${suffix}` : `${h}h${suffix}`;
}

function sessionExpiry(
  session: ReturnType<typeof requireSession>
): { label: string; expired: boolean; idleLabel: string | null; idleExpired: boolean } {
  const nowSec = Date.now() / 1000;
  const createdSec = session.createdAt / 1000;

  // Auth session cookies live between 5 minutes and 8 hours after creation.
  // This excludes instant-expiry tracking cookies (< 5m) and long-lived
  // preference cookies (> 8h) that survive well past session expiry.
  const authCookies = session.cookies.filter(
    (c) =>
      c.domain.includes("lloydsbank.co.uk") &&
      c.expires !== -1 &&
      c.expires - createdSec >= 5 * 60 &&
      c.expires - createdSec < 8 * 3600
  );

  const lastAccessed = session.lastAccessedAt ?? session.createdAt;
  const idleSecsLeft = Math.floor(IDLE_TIMEOUT_SECS - (Date.now() - lastAccessed) / 1000);
  const idleExpired = idleSecsLeft <= 0;
  const idleLabel = idleExpired ? "likely expired" : `in ~${formatTime(idleSecsLeft)}`;

  if (authCookies.length === 0) return { label: "unknown", expired: false, idleLabel, idleExpired };

  const soonest = Math.min(...authCookies.map((c) => c.expires));
  const secsLeft = Math.floor(soonest - nowSec);

  if (secsLeft <= 0) {
    return { label: `expired ${formatTime(-secsLeft)} ago`, expired: true, idleLabel: null, idleExpired: false };
  }
  return { label: `in ${formatTime(secsLeft)}`, expired: false, idleLabel, idleExpired };
}

export async function whoamiCommand(opts: BaseCommandOpts = {}): Promise<void> {
  const session = requireSession();
  const expiry = sessionExpiry(session);

  try {
    const client = await getClient();
    const accounts = await client.getAccounts();

    if (accounts.length === 0) {
      throw new Error("No accounts found.");
    }

    const acc = accounts[0];

    if (opts.json) {
      writeJson(acc);
      return;
    }

    const expiryLabel = expiry.expired
      ? `${RED}${expiry.label}${RESET}`
      : expiry.label;

    let idleSuffix = "";
    if (expiry.idleLabel !== null) {
      idleSuffix = expiry.idleExpired
        ? ` (${YELLOW}idle ${expiry.idleLabel}${RESET})`
        : ` (idle ${expiry.idleLabel})`;
    }

    console.log(`Account:         ${acc.accountName}`);
    console.log(`Sort Code:       ${acc.sortCode}`);
    console.log(`Account Number:  ${acc.accountId}`);
    console.log(`Arrangement ID:  ${acc.arrangementId}`);
    console.log(`Session age:     ${formatTime(Math.floor((Date.now() - session.createdAt) / 1000), " ago")}`);
    console.log(`Session expires: ${expiryLabel}${idleSuffix}`);
  } catch (err: any) {
    if (opts.json) {
      handleJsonError(err);
      return;
    }
    if (err.message?.includes("Session expired")) {
      const detail = expiry.expired ? ` (${expiry.label})` : "";
      console.error(`${RED}Session expired${detail}. Run: lloyds login${RESET}`);
    } else {
      console.error(`Failed: ${err.message}`);
    }
    process.exit(0);
  }
}
