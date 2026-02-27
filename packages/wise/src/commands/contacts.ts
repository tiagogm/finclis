import { wiseGatewayGet, getProfileId } from "../client.js";
import { prompt } from "../auth.js";

export async function contactsCommand(): Promise<void> {
  try {
    const profileId = getProfileId();
    const response = await wiseGatewayGet(
      `/v2/profiles/${profileId}/contact-list-page?action=SEND&payInMethod=DEFAULT&recentContactsPageSize=10&contactsPageSize=50&includeExternalIdentifiers=true&enriched=true`
    );

    const recent: any[] = response?.recent?.contacts || [];
    const all: any[] = response?.contacts?.contacts || [];

    if (recent.length === 0 && all.length === 0) {
      console.log("No contacts found.");
      return;
    }

    let displayed = recent.length > 0 ? recent : all;
    let isSearchResult = false;

    while (true) {
      const label = isSearchResult ? "Results" : "Recent";
      const shown = isSearchResult ? displayed : displayed.slice(0, 10);
      console.log(`\n${label} (${shown.length}):\n`);
      printTable(shown);

      const input = (await prompt(`\nSelect [1-${shown.length}] or search: `)).trim();

      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= shown.length) {
        printContactDetails(shown[num - 1]);
        return;
      }

      if (input.length > 0) {
        const q = input.toLowerCase();
        const matches = all.filter((c: any) => {
          const name = (c.name || c.display?.title || "").toLowerCase();
          const subtitle = (c.display?.subtitle || "").toLowerCase();
          return name.includes(q) || subtitle.includes(q);
        });

        if (matches.length === 0) {
          console.log(`No contacts matching "${input}".`);
          displayed = recent.length > 0 ? recent : all;
          isSearchResult = false;
        } else {
          displayed = matches;
          isSearchResult = true;
        }
      }
    }
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function printTable(contacts: any[]): void {
  const rows = contacts.map((c: any, i: number) => ({
    num: String(i + 1),
    id: c.id,
    name: shortName(c.name || c.display?.title || "Unknown"),
    subtitle: c.display?.subtitle || "",
  }));

  const w = {
    num: Math.max(1, ...rows.map(r => r.num.length)),
    name: Math.max(4, ...rows.map(r => r.name.length)),
  };

  for (const r of rows) {
    console.log(`  ${r.num.padStart(w.num)}  ${r.name.padEnd(w.name)}  ${r.subtitle}`);
  }
}

function printContactDetails(c: any): void {
  const rows: [string, string][] = [
    ["Contact ID", c.id],
    ["Name", c.name || c.display?.title || "Unknown"],
  ];

  if (c.display?.subtitle) {
    rows.push(["Info", c.display.subtitle]);
  }

  if (c.self) {
    rows.push(["Self", "Yes"]);
  }

  if (c.legalEntityType) {
    rows.push(["Type", c.legalEntityType]);
  }

  const details = c.display?.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      if (d.label && d.value) {
        rows.push([d.label, d.value]);
      }
    }
  }

  const caps = c.capabilities;
  if (Array.isArray(caps)) {
    for (const cap of caps) {
      if (cap.action && Array.isArray(cap.currencies)) {
        rows.push([`Can ${cap.action.toLowerCase()}`, cap.currencies.join(", ")]);
      }
    }
  }

  console.log("");
  const maxKey = Math.max(...rows.map(([k]) => k.length));
  for (const [key, value] of rows) {
    console.log(`${key.padEnd(maxKey + 2)}${value}`);
  }
}
