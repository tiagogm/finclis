import { wiseGet, getProfileId } from "../client.js";
import { prompt } from "../auth.js";

export async function recipientsCommand(): Promise<void> {
  try {
    const profileId = getProfileId();
    const recipients = await wiseGet(`/v1/accounts?profile=${profileId}`);

    if (!Array.isArray(recipients) || recipients.length === 0) {
      console.log("No recipients found.");
      return;
    }

    const external = recipients.filter((r: any) => r.type !== "balance");

    if (external.length === 0) {
      console.log("No external recipients found.");
      return;
    }

    let displayed = external.slice(0, 10);
    let isSearchResult = false;

    while (true) {
      const label = isSearchResult ? "Results" : "Recipients";
      console.log(`\n${label} (${displayed.length}):\n`);
      printTable(displayed);

      const input = (await prompt(`\nSelect [1-${displayed.length}] or search: `)).trim();

      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= displayed.length) {
        printRecipientDetails(displayed[num - 1]);
        return;
      }

      if (input.length > 0) {
        const q = input.toLowerCase();
        const matches = external.filter((r: any) => {
          const name = (r.accountHolderName || r.name?.fullName || "").toLowerCase();
          const curr = (r.currency || "").toLowerCase();
          const summary = (r.accountSummary || "").toLowerCase();
          return name.includes(q) || curr.includes(q) || summary.includes(q);
        });

        if (matches.length === 0) {
          console.log(`No recipients matching "${input}".`);
          displayed = external.slice(0, 10);
          isSearchResult = false;
        } else {
          displayed = matches;
          isSearchResult = true;
        }
      }
    }
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

function shortName(r: any): string {
  const full = r.accountHolderName || r.name?.fullName || "Unknown";
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function maskedAccount(r: any): string {
  const accountNum = r.displayFields?.find((f: any) =>
    f.key?.includes("accountNumber") || f.key?.includes("iban") || f.key?.includes("clabe")
  )?.value;
  const last4 = accountNum?.replace(/\D/g, "")?.slice(-4);
  return last4 ? `xxx-${last4}` : "";
}

function routeLabel(r: any): string {
  const labelMap: Record<string, string> = {
    "Bank code": "BIC/SWIFT",
    "SWIFT / BIC code": "BIC/SWIFT",
    "UK sort code": "UK",
    "ACH routing number": "US ACH",
    "Routing number": "US",
    "BSB code": "AU",
    "Institution number": "CA",
    "IFSC code": "IN",
  };
  const raw = r.displayFields?.[0]?.label || r.type || "";
  return labelMap[raw] || raw;
}

function printTable(recipients: any[]): void {
  const rows = recipients.map((r: any, i: number) => ({
    num: String(i + 1),
    id: String(r.id),
    name: shortName(r),
    curr: r.currency || "???",
    account: maskedAccount(r),
    route: routeLabel(r),
  }));

  const w = {
    num: Math.max(1, ...rows.map(r => r.num.length)),
    id: Math.max(2, ...rows.map(r => r.id.length)),
    name: Math.max(4, ...rows.map(r => r.name.length)),
    curr: Math.max(3, ...rows.map(r => r.curr.length)),
    account: Math.max(7, ...rows.map(r => r.account.length)),
    route: Math.max(5, ...rows.map(r => r.route.length)),
  };

  console.log(
    `  ${"#".padEnd(w.num)}  ${"ID".padEnd(w.id)}  ${"Name".padEnd(w.name)}  ${"Cur".padEnd(w.curr)}  ${"Account".padEnd(w.account)}  Route`
  );
  console.log(`  ${"─".repeat(w.num + w.id + w.name + w.curr + w.account + w.route + 10)}`);

  for (const r of rows) {
    console.log(
      `  ${r.num.padStart(w.num)}  ${r.id.padEnd(w.id)}  ${r.name.padEnd(w.name)}  ${r.curr.padEnd(w.curr)}  ${r.account.padEnd(w.account)}  ${r.route}`
    );
  }
}

function printRecipientDetails(r: any): void {
  const rows: [string, string][] = [
    ["Recipient ID", String(r.id)],
    ["Name", r.accountHolderName || r.name?.fullName || "Unknown"],
    ["Currency", r.currency || "???"],
    ["Type", r.type || ""],
  ];

  if (r.accountSummary) {
    rows.push(["Account", r.accountSummary]);
  }

  const fields = r.displayFields;
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (f.label && f.value) {
        rows.push([f.label, f.value]);
      }
    }
  }

  if (r.country) {
    rows.push(["Country", r.country]);
  }

  console.log("");
  const maxKey = Math.max(...rows.map(([k]) => k.length));
  for (const [key, value] of rows) {
    console.log(`${key.padEnd(maxKey + 2)}${value}`);
  }
}
