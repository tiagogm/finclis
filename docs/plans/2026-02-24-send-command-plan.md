# Send Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `send` command that handles the full transfer flow: quote -> requirements -> transfer -> fund from balance.

**Architecture:** Single command file `src/commands/send.ts` following existing patterns. Verbose logging added to `src/client.ts` via module-level flag. No new modules or abstractions.

**Tech Stack:** TypeScript, Commander.js, Bun test runner, Node.js readline for prompts.

**Design doc:** `docs/plans/2026-02-24-send-command-design.md`

---

### Task 1: Add verbose logging to client.ts

**Files:**
- Modify: `src/client.ts`

**Step 1: Add verbose flag and setter**

At the top of `src/client.ts`, after the imports (line 2), add:

```typescript
let verbose = false;

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}
```

**Step 2: Add verbose logging to wiseGet**

In `wiseGet` (line 46), add logging before and after the fetch call. Replace lines 54-62 with:

```typescript
  if (verbose) console.error(`-> GET ${url}`);
  let res = await fetch(url, { headers });
  if (verbose) console.error(`<- ${res.status}`);

  const ott = isScaChallenge(res);
  if (ott) {
    if (verbose) console.error(`<- 403 (SCA challenge)`);
    await handleScaChallenge(ott, session.token);
    if (verbose) console.error(`-> GET ${url} (SCA retry)`);
    res = await fetch(url, {
      headers: { ...headers, "x-2fa-approval": ott },
    });
    if (verbose) console.error(`<- ${res.status}`);
  }
```

**Step 3: Add verbose logging to wisePost**

Same pattern in `wisePost` (line 74). Replace lines 88-102 with:

```typescript
  if (verbose) console.error(`-> POST ${url}`);
  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (verbose) console.error(`<- ${res.status}`);

  const ott = isScaChallenge(res);
  if (ott) {
    if (verbose) console.error(`<- 403 (SCA challenge)`);
    await handleScaChallenge(ott, session.token);
    if (verbose) console.error(`-> POST ${url} (SCA retry)`);
    res = await fetch(url, {
      method: "POST",
      headers: { ...headers, "x-2fa-approval": ott },
      body: JSON.stringify(body),
    });
    if (verbose) console.error(`<- ${res.status}`);
  }
```

**Step 4: Run typecheck**

Run: `cd /Users/tiago.morais/Projects/wise-cli && bun run typecheck`
Expected: No errors.

**Step 5: Run existing tests**

Run: `cd /Users/tiago.morais/Projects/wise-cli && bun test`
Expected: All existing tests pass (verbose flag defaults to false, no behaviour change).

**Step 6: Commit**

```bash
git add src/client.ts
git commit -m "feat: add verbose HTTP logging to client"
```

---

### Task 2: Add wisePut helper to client.ts

The cancel transfer endpoint uses PUT, and fund transfer uses POST (already covered). But we also need a PUT for cancel. More importantly, the fund endpoint returns JSON even on failure. Let's add `wisePut` now for completeness.

**Files:**
- Modify: `src/client.ts`

**Step 1: Add wisePut function**

After the `wisePost` function, add:

```typescript
/**
 * Make an authenticated PUT request with automatic SCA retry.
 */
export async function wisePut(path: string): Promise<any> {
  const session = requireSession();

  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.token}`,
  };

  if (verbose) console.error(`-> PUT ${url}`);
  let res = await fetch(url, { method: "PUT", headers });
  if (verbose) console.error(`<- ${res.status}`);

  const ott = isScaChallenge(res);
  if (ott) {
    if (verbose) console.error(`<- 403 (SCA challenge)`);
    await handleScaChallenge(ott, session.token);
    if (verbose) console.error(`-> PUT ${url} (SCA retry)`);
    res = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "x-2fa-approval": ott },
    });
    if (verbose) console.error(`<- ${res.status}`);
  }

  if (!res.ok) {
    throw await apiError(res);
  }

  return res.json();
}
```

**Step 2: Run typecheck**

Run: `cd /Users/tiago.morais/Projects/wise-cli && bun run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/client.ts
git commit -m "feat: add wisePut helper to client"
```

---

### Task 3: Create send command — input validation and command registration

**Files:**
- Create: `src/commands/send.ts`
- Modify: `src/index.ts`

**Step 1: Create the send command file with input validation and skeleton**

Create `src/commands/send.ts`:

```typescript
import { wiseGet, wisePost, requireSession, setVerbose } from "../client.js";
import { prompt } from "../auth.js";
import { validateCurrency } from "../validate.js";
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
      transferBody.sourceAccount = parseInt(opts.from, 10);
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
 * Fetch saved recipients and let the user pick one.
 */
async function pickRecipient(profileId: number): Promise<number> {
  const recipients = await wiseGet(`/v2/accounts?profile=${profileId}`);

  if (!recipients || recipients.length === 0) {
    console.error("No saved recipients found. Create one at wise.com first, or use --to <id>.");
    process.exit(1);
  }

  console.log("\nRecipients:\n");
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const name = r.accountHolderName || r.name?.fullName || "Unknown";
    const curr = r.currency || "";
    console.log(`  ${i + 1}. ${name} (${curr})`);
  }

  const input = await prompt(`\nSelect recipient [1-${recipients.length}]: `);
  const idx = parseInt(input, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= recipients.length) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  return recipients[idx].id;
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
      if (!section.fields) continue;

      for (const field of section.fields) {
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
            const value = await prompt(promptText);

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
```

**Step 2: Register the send command in index.ts**

In `src/index.ts`, add the import after line 10:

```typescript
import { sendCommand } from "./commands/send.js";
```

Then after the `move` command block (after line 75), add:

```typescript
program
  .command("send <amount> <currency>")
  .description("Send money to a recipient (quote → transfer → fund)")
  .option("--to <recipientId>", "Recipient account ID (skips interactive picker)")
  .option("--from <balanceId>", "Source balance ID")
  .option("--target-currency <code>", "Target currency (defaults to recipient's currency)")
  .option("--reference <text>", "Payment reference text")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--yes", "Skip confirmation prompt")
  .action(sendCommand);
```

**Step 3: Run typecheck**

Run: `cd /Users/tiago.morais/Projects/wise-cli && bun run typecheck`
Expected: No errors.

**Step 4: Run existing tests**

Run: `cd /Users/tiago.morais/Projects/wise-cli && bun test`
Expected: All existing tests still pass.

**Step 5: Verify command shows in help**

Run: `cd /Users/tiago.morais/Projects/wise-cli && bun ./wise --help`
Expected: `send` command appears in the list with description.

Run: `cd /Users/tiago.morais/Projects/wise-cli && bun ./wise send --help`
Expected: Shows `<amount> <currency>` args and all options.

**Step 6: Commit**

```bash
git add src/commands/send.ts src/index.ts
git commit -m "feat: add send command for full transfer flow"
```

---

### Task 4: Update TODO.md

**Files:**
- Modify: `TODO.md`

**Step 1: Mark the send command as done**

Change `- [ ] Implement 'send' command` to `- [x] Implement 'send' command` in TODO.md.

Also mark `- [ ] Add '--yes' flag to 'move' and 'send'` as partially done (send has --yes, move doesn't yet).

**Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: update TODO — send command implemented"
```

---

### Task 5: Manual integration test

This task is manual — run the CLI against the real Wise API (or sandbox) to verify the full flow.

**Step 1: Test help output**

Run: `cd /Users/tiago.morais/Projects/wise-cli && bun ./wise send --help`
Expected: Shows usage with `<amount> <currency>`, all options listed.

**Step 2: Test with --to flag and --verbose**

Run: `bun ./wise send 0.01 GBP --to <a-real-recipient-id> -v --reference "CLI test"`
Expected:
- Verbose output shows each HTTP call (`-> POST ...`, `<- 200`)
- Confirmation prompt appears with rate, fee, amounts
- After confirming, transfer is created and funded
- Summary table printed

**Step 3: Test interactive recipient picker**

Run: `bun ./wise send 0.01 GBP`
Expected:
- Fetches and displays numbered recipient list
- After selecting, proceeds with quote → requirements → transfer → fund

**Step 4: Test --yes flag**

Run: `bun ./wise send 0.01 GBP --to <id> --yes`
Expected: Skips confirmation, goes straight to transfer creation.

**Step 5: Test cancellation**

Run: `bun ./wise send 0.01 GBP --to <id>`
Expected: At "Proceed? [y/N]" prompt, type `n`. Output: "Cancelled."

**Step 6: Test error cases**

Run: `bun ./wise send 0 GBP`
Expected: "Amount must be a positive number."

Run: `bun ./wise send 100 NOPE`
Expected: Currency validation error.

Run: `bun ./wise send 100 GBP --to abc`
Expected: "Invalid recipient ID" error.
