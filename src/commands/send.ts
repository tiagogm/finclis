import { wiseGet, wisePost, requireSession, setVerbose } from "../client.js";
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
    if (opts.verbose) setVerbose(true);

    const session = requireSession();
    const profileId = session.profileId;
    const sourceCurrency = validateCurrency(currency);
    const sourceAmount = parseFloat(amount);

    if (isNaN(sourceAmount) || sourceAmount <= 0) {
      console.error("Amount must be a positive number.");
      process.exit(1);
    }

    // Step 1: Resolve recipient
    let targetAccount: number;
    if (opts.to) {
      targetAccount = parseInt(opts.to, 10);
      if (isNaN(targetAccount) || targetAccount <= 0) {
        console.error(`Invalid recipient ID: "${opts.to}". Expected a positive number.`);
        process.exit(1);
      }
    } else {
      targetAccount = await pickRecipient(profileId);
    }

    // Step 2: Determine target currency
    let targetCurrency: string | undefined;
    if (opts.targetCurrency) {
      targetCurrency = validateCurrency(opts.targetCurrency);
    }

    // Step 3: Create quote
    console.log(`Creating quote: ${sourceAmount} ${sourceCurrency}...`);
    const quoteBody: Record<string, any> = {
      sourceCurrency,
      sourceAmount,
      payOut: "BALANCE",
    };
    if (targetCurrency) {
      quoteBody.targetCurrency = targetCurrency;
    } else {
      quoteBody.targetAccount = targetAccount;
    }
    const quote = await wisePost(`/v3/profiles/${profileId}/quotes`, quoteBody);

    const balanceOption = quote.paymentOptions?.find(
      (o: any) => o.payIn === "BALANCE" && !o.disabled
    );

    // Step 4: Check transfer requirements
    const customerTransactionId = crypto.randomUUID();
    const details = await collectTransferRequirements(
      targetAccount,
      quote.id,
      customerTransactionId,
      opts.reference
    );

    // Step 5: Confirmation
    const effectiveTargetCurrency = targetCurrency || quote.targetCurrency || sourceCurrency;
    if (!opts.yes) {
      console.log(`\nSend ${sourceAmount.toFixed(2)} ${sourceCurrency} -> ${effectiveTargetCurrency}`);
      console.log(`  Rate          ${quote.rate}`);
      if (balanceOption) {
        console.log(`  Fee           ${balanceOption.fee.total} ${sourceCurrency}`);
        console.log(`  You send      ${sourceAmount.toFixed(2)} ${sourceCurrency}`);
        console.log(`  They receive  ${balanceOption.targetAmount} ${effectiveTargetCurrency}`);
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

    // Step 8: Print summary
    console.log("\nTransfer created and funded.\n");
    printSummary([
      ["Quote ID", quote.id],
      ["Rate", String(quote.rate)],
      ["Source", `${transfer.sourceValue} ${transfer.sourceCurrency}`],
      ["Target", `${transfer.targetValue} ${transfer.targetCurrency}`],
      ...(balanceOption ? [["Fee", `${balanceOption.fee.total} ${sourceCurrency}`] as [string, string]] : []),
      ["Transfer ID", String(transfer.id)],
      ["Transfer Status", transfer.status],
      ["Payment Status", payment.status],
      ["Payment Type", payment.type],
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

/**
 * Fetch all recipients, paginating through the v2 API.
 */
async function fetchAllRecipients(profileId: number): Promise<any[]> {
  const all: any[] = [];
  let seekPosition: string | null = null;

  do {
    let url = `/v2/accounts?profileId=${profileId}&size=50`;
    if (seekPosition) url += `&seekPosition=${seekPosition}`;
    const response = await wiseGet(url);
    const page = response?.content;
    if (!page || page.length === 0) break;
    all.push(...page);
    seekPosition = response.seekPositionForNext ?? null;
  } while (seekPosition);

  return all;
}

/**
 * Format a recipient for display: "Name — GBP xxx-8842 (UK sort code)"
 */
function formatRecipient(r: any): string {
  const name = r.name?.fullName || "Unknown";
  const curr = r.currency || "???";

  // Extract last 4 digits from accountSummary or displayFields
  const accountNum = r.displayFields?.find((f: any) =>
    f.key?.includes("accountNumber") || f.key?.includes("iban") || f.key?.includes("clabe")
  )?.value;
  const last4 = accountNum?.replace(/\D/g, "")?.slice(-4);
  const masked = last4 ? `xxx-${last4}` : "";

  // Bank/account type label from first displayField (e.g. "UK sort code")
  const bankLabel = r.displayFields?.[0]?.label || r.type || "";

  const parts = [name, "—", [curr, masked].filter(Boolean).join(" ")];
  if (bankLabel) parts.push(`(${bankLabel})`);
  return parts.join(" ");
}

/**
 * Fetch saved recipients and let the user pick one.
 * Supports search: type text to filter, number to select.
 */
async function pickRecipient(profileId: number): Promise<number> {
  const allRecipients = await fetchAllRecipients(profileId);

  if (allRecipients.length === 0) {
    console.error("No saved recipients found. Create one at wise.com first, or use --to <id>.");
    process.exit(1);
  }

  let filtered = allRecipients;

  while (true) {
    console.log(`\nRecipients (${filtered.length}):\n`);
    for (let i = 0; i < filtered.length; i++) {
      console.log(`  ${i + 1}. ${formatRecipient(filtered[i])}`);
    }

    const input = (await prompt(`\nSelect [1-${filtered.length}] or search by name/currency: `)).trim();

    // Number = selection
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= filtered.length) {
      return filtered[num - 1].id;
    }

    // Text = filter
    if (input.length > 0) {
      const q = input.toLowerCase();
      filtered = allRecipients.filter((r: any) => {
        const name = (r.name?.fullName || "").toLowerCase();
        const curr = (r.currency || "").toLowerCase();
        const summary = (r.accountSummary || "").toLowerCase();
        return name.includes(q) || curr.includes(q) || summary.includes(q);
      });

      if (filtered.length === 0) {
        console.log(`No recipients matching "${input}".`);
        filtered = allRecipients;
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
