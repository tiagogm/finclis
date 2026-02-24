import { wiseGet, wisePost, wiseGatewayGet, requireSession, setVerbose } from "../client.js";
import { setScaVerbose } from "../sca.js";
import { prompt } from "../auth.js";
import { validateCurrency, validateBalanceId } from "../validate.js";
import crypto from "node:crypto";

interface SendOpts {
  to?: string;
  from?: string;
  targetCurrency?: string;
  reference?: string;
  verbose?: boolean;
  yes?: boolean;
}

export async function sendCommand(
  amount: string,
  currency: string,
  opts: SendOpts
): Promise<void> {
  try {
    if (opts.verbose) {
      setVerbose(true);
      setScaVerbose(true);
    }

    const session = requireSession();
    const profileId = session.profileId;
    const sourceCurrency = validateCurrency(currency);
    const sourceAmount = parseFloat(amount);

    if (isNaN(sourceAmount) || sourceAmount <= 0) {
      console.error("Amount must be a positive number.");
      process.exit(1);
    }

    // Step 1: Resolve recipient or contact
    let targetAccount: number | undefined;
    let contactId: string | undefined;
    let recipientCurrency: string | undefined;

    if (opts.to) {
      targetAccount = parseInt(opts.to, 10);
      if (isNaN(targetAccount) || targetAccount <= 0) {
        console.error(`Invalid recipient ID: "${opts.to}". Expected a positive number.`);
        process.exit(1);
      }
      const recipient = await wiseGet(`/v2/accounts/${targetAccount}`);
      recipientCurrency = recipient?.currency;
    } else {
      const picked = await pickContact(profileId);
      contactId = picked.contactId;
    }

    // Step 2: Determine target currency
    const targetCurrency = opts.targetCurrency
      ? validateCurrency(opts.targetCurrency)
      : recipientCurrency || sourceCurrency;

    // Step 3: Create quote
    const quoteBody: Record<string, any> = {
      sourceCurrency,
      sourceAmount,
      payOut: "BALANCE",
    };
    if (contactId) {
      // Contact-based: API resolves targetAccount from contactId
      quoteBody.contactId = contactId;
      quoteBody.targetCurrency = targetCurrency;
      console.log(`Creating quote: ${sourceAmount} ${sourceCurrency} -> ${targetCurrency}...`);
    } else {
      quoteBody.targetAccount = targetAccount;
      quoteBody.targetCurrency = targetCurrency;
      console.log(`Creating quote: ${sourceAmount} ${sourceCurrency} -> ${targetCurrency}...`);
    }
    const quote = await wisePost(`/v3/profiles/${profileId}/quotes`, quoteBody);

    // For contact-based sends, extract the resolved targetAccount from the quote
    if (!targetAccount) {
      targetAccount = quote.targetAccount;
      if (!targetAccount) {
        throw new Error("Quote did not resolve a target account from the contact.");
      }
    }

    const balanceOption = quote.paymentOptions?.find(
      (o: any) => o.payIn === "BALANCE" && !o.disabled
    );

    // Step 4: Check transfer requirements
    const customerTransactionId = crypto.randomUUID();
    const details = await collectTransferRequirements(
      targetAccount!,
      quote.id,
      customerTransactionId,
      opts.reference
    );

    // Step 5: Confirmation
    if (!opts.yes) {
      console.log(`\nSend ${sourceAmount.toFixed(2)} ${sourceCurrency} -> ${targetCurrency}`);
      console.log(`  Rate          ${quote.rate}`);
      if (balanceOption) {
        console.log(`  Fee           ${balanceOption.fee.total} ${sourceCurrency}`);
        console.log(`  You send      ${sourceAmount.toFixed(2)} ${sourceCurrency}`);
        console.log(`  They receive  ${balanceOption.targetAmount} ${targetCurrency}`);
      }
      if (details.reference) {
        console.log(`  Reference     ${details.reference}`);
      }
      const confirm = await prompt("\nProceed? [y/N] ");
      if (confirm.toLowerCase() !== "y") {
        console.log("Cancelled.");
        return;
      }
    }

    // Step 6: Create transfer
    console.log("Creating transfer...");
    const transferBody: Record<string, any> = {
      targetAccount,
      quoteUuid: quote.id,
      customerTransactionId,
      details,
    };
    if (opts.from) {
      transferBody.sourceAccount = validateBalanceId(opts.from);
    }
    const transfer = await wisePost("/v1/transfers", transferBody);

    // Step 7: Fund transfer
    console.log("Funding transfer...");
    const payment = await wisePost(
      `/v3/profiles/${profileId}/transfers/${transfer.id}/payments`,
      { type: "BALANCE" }
    );

    // Step 8: Re-fetch transfer for accurate post-funding state
    const funded = await wiseGet(`/v1/transfers/${transfer.id}`);

    // Step 9: Print summary
    console.log("\nTransfer created and funded.\n");
    const fee = balanceOption?.fee?.total;
    printSummary([
      ["Transfer ID", String(funded.id)],
      ["Status", funded.status],
      ["Source", `${funded.sourceValue} ${funded.sourceCurrency}`],
      ["Target", `${funded.targetValue} ${funded.targetCurrency}`],
      ["Rate", String(funded.rate)],
      ...(fee != null ? [["Fee", `${fee} ${sourceCurrency}`] as [string, string]] : []),
      ["Payment", `${payment.status} (${payment.type})`],
      ["Quote ID", quote.id],
    ]);

    if (payment.status === "REJECTED") {
      console.error(`\nPayment rejected: ${payment.errorCode}`);
      console.error(`Transfer ${transfer.id} created but not funded. Fund it manually or retry.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

interface Contact {
  id: string;
  name: string;
  subtitle: string;
}

/**
 * Fetch contacts from the gateway API, paginating through all pages.
 */
interface ContactListResult {
  recent: Contact[];
  all: Contact[];
}

async function fetchContacts(profileId: number): Promise<ContactListResult> {
  const response = await wiseGatewayGet(
    `/v2/profiles/${profileId}/contact-list-page?action=SEND&payInMethod=DEFAULT&recentContactsPageSize=10&contactsPageSize=50&includeExternalIdentifiers=true&enriched=true`
  );

  const parseContacts = (list: any[]): Contact[] =>
    (list || []).map((c: any) => ({
      id: c.id,
      name: c.name || c.display?.title || "Unknown",
      subtitle: c.display?.subtitle || "",
    }));

  return {
    recent: parseContacts(response?.recent?.contacts),
    all: parseContacts(response?.contacts?.contacts),
  };
}

/**
 * Short name: "John S." from "John Smith"
 */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Print contacts as an aligned table.
 */
function printContactTable(contacts: Contact[]): void {
  const rows = contacts.map((c, i) => ({
    num: String(i + 1),
    name: shortName(c.name),
    subtitle: c.subtitle,
  }));

  const w = {
    num: Math.max(1, ...rows.map(r => r.num.length)),
    name: Math.max(4, ...rows.map(r => r.name.length)),
  };

  console.log(`  ${"#".padEnd(w.num)}  ${"Name".padEnd(w.name)}  Info`);
  console.log(`  ${"─".repeat(w.num + w.name + 30)}`);

  for (const r of rows) {
    console.log(`  ${r.num.padStart(w.num)}  ${r.name.padEnd(w.name)}  ${r.subtitle}`);
  }
}

/**
 * Fetch contacts and let the user pick one.
 * Supports search: type text to filter, number to select.
 */
async function pickContact(profileId: number): Promise<{ contactId: string }> {
  const { recent, all } = await fetchContacts(profileId);

  if (recent.length === 0 && all.length === 0) {
    console.error("No contacts found. Add contacts at wise.com first, or use --to <recipientId>.");
    process.exit(1);
  }

  let displayed = recent.length > 0 ? recent : all;
  let isSearchResult = false;

  while (true) {
    const label = isSearchResult ? "Results" : "Recent";
    console.log(`\n${label} (${displayed.length}):\n`);
    printContactTable(displayed);

    const input = (await prompt(`\nSelect [1-${displayed.length}] or search: `)).trim();

    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= displayed.length) {
      return { contactId: displayed[num - 1].id };
    }

    if (input.length > 0) {
      const q = input.toLowerCase();
      const matches = all.filter(c =>
        c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)
      );

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
}

/**
 * Call /v1/transfer-requirements and prompt for any required fields.
 * Loops if refreshRequirementsOnChange fields are updated.
 */
async function collectTransferRequirements(
  targetAccount: number,
  quoteUuid: string,
  customerTransactionId: string,
  reference?: string
): Promise<Record<string, any>> {
  const details: Record<string, any> = {};
  if (reference) details.reference = reference;

  let needsRefresh = true;

  while (needsRefresh) {
    needsRefresh = false;

    const reqBody = {
      targetAccount,
      quoteUuid,
      customerTransactionId,
      details,
    };

    const requirements = await wisePost("/v1/transfer-requirements", reqBody);

    if (!requirements || !requirements.length) break;

    for (const section of requirements) {
      if (needsRefresh) break;
      if (!section.fields) continue;

      for (const field of section.fields) {
        if (needsRefresh) break;
        if (!field.group) continue;

        for (const g of field.group) {
          if (!g.required) continue;
          if (details[g.key] !== undefined) continue; // already provided

          if (g.type === "select" && g.valuesAllowed?.length) {
            console.log(`\n${g.name}:\n`);
            for (let i = 0; i < g.valuesAllowed.length; i++) {
              console.log(`  ${i + 1}. ${g.valuesAllowed[i].name}`);
            }
            const input = await prompt(`\nSelect [1-${g.valuesAllowed.length}]: `);
            const idx = parseInt(input, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= g.valuesAllowed.length) {
              console.error("Invalid selection.");
              process.exit(1);
            }
            details[g.key] = g.valuesAllowed[idx].key;
          } else {
            // text input
            let promptText = `${g.name}`;
            if (g.example) promptText += ` (e.g. ${g.example})`;
            promptText += ": ";
            const value = (await prompt(promptText)).trim();

            if (g.minLength && value.length < g.minLength) {
              console.error(`Must be at least ${g.minLength} characters.`);
              process.exit(1);
            }
            if (g.maxLength && value.length > g.maxLength) {
              console.error(`Must be at most ${g.maxLength} characters.`);
              process.exit(1);
            }
            if (g.validationRegexp && !new RegExp(g.validationRegexp).test(value)) {
              console.error(`Invalid format. Expected: ${g.validationRegexp}`);
              process.exit(1);
            }

            details[g.key] = value;
          }

          if (g.refreshRequirementsOnChange) {
            needsRefresh = true;
            break;
          }
        }
      }
    }
  }

  return details;
}

/**
 * Print aligned key-value summary table.
 */
function printSummary(rows: [string, string][]): void {
  const maxKey = Math.max(...rows.map(([k]) => k.length));
  for (const [key, value] of rows) {
    console.log(`${key.padEnd(maxKey + 2)}${value}`);
  }
}
