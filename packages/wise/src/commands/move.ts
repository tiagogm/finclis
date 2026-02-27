import { wiseGet, wisePost, requireSession } from "../client.js";
import { prompt } from "../auth.js";
import { validateCurrency, validateBalanceId } from "../validate.js";
import crypto from "node:crypto";

interface MoveOpts {
  from: string;
  to: string;
  amount: string;
  sourceBalance?: string;
  targetBalance?: string;
}

export async function moveCommand(opts: MoveOpts): Promise<void> {
  try {
    const session = requireSession();
    const profileId = session.profileId;
    const sourceCurrency = validateCurrency(opts.from);
    const targetCurrency = validateCurrency(opts.to);
    const amount = parseFloat(opts.amount);

    if (isNaN(amount) || amount <= 0) {
      console.error("Amount must be a positive number.");
      process.exit(0);
    }

    const sameCurrency = sourceCurrency === targetCurrency;
    const idempotenceUuid = crypto.randomUUID();

    if (sameCurrency) {
      if (!opts.sourceBalance || !opts.targetBalance) {
        const balances = await wiseGet(
          `/v4/profiles/${profileId}/balances?types=STANDARD,SAVINGS`
        );
        const matching = balances.filter((b: any) => b.currency === sourceCurrency);
        if (matching.length < 2) {
          console.error(`Need at least 2 ${sourceCurrency} balances to move between. Found ${matching.length}.`);
          process.exit(0);
        }
        console.error(`Specify --source-balance and --target-balance. ${sourceCurrency} balances:`);
        for (const b of matching) {
          console.error(`  ${b.id}\t${b.type}\t${b.amount.value} ${b.currency}`);
        }
        process.exit(0);
      }

      // Confirmation
      console.log(`\nMove ${amount} ${sourceCurrency}`);
      console.log(`  From balance: ${opts.sourceBalance}`);
      console.log(`  To balance:   ${opts.targetBalance}`);
      const confirm = await prompt("\nProceed? [y/N] ");
      if (confirm.toLowerCase() !== "y") {
        console.log("Cancelled.");
        return;
      }

      console.log(`Moving ${amount} ${sourceCurrency} between balances...`);
      const movement = await wisePost(
        `/v2/profiles/${profileId}/balance-movements`,
        {
          sourceBalanceId: validateBalanceId(opts.sourceBalance),
          targetBalanceId: validateBalanceId(opts.targetBalance),
          amount: { value: amount, currency: sourceCurrency },
        },
        { "X-idempotence-uuid": idempotenceUuid }
      );

      console.log(`Done. ${movement.type} — ${movement.state}`);
      if (movement.balancesAfter) {
        for (const b of movement.balancesAfter) {
          console.log(`  Balance ${b.id}: ${b.value} ${b.currency}`);
        }
      }
    } else {
      // Cross-currency conversion
      console.log(`Creating quote: ${amount} ${sourceCurrency} → ${targetCurrency}...`);
      const quote = await wisePost(`/v3/profiles/${profileId}/quotes`, {
        sourceCurrency,
        targetCurrency,
        sourceAmount: amount,
        payOut: "BALANCE",
      });

      const balanceOption = quote.paymentOptions?.find(
        (o: any) => o.payIn === "BALANCE" && !o.disabled
      );

      // Confirmation
      console.log(`\nConvert ${amount} ${sourceCurrency} → ${targetCurrency}`);
      console.log(`  Rate: ${quote.rate}`);
      if (balanceOption) {
        console.log(`  You'll get: ${balanceOption.targetAmount} ${targetCurrency}`);
        console.log(`  Fee: ${balanceOption.fee.total} ${sourceCurrency}`);
      }
      const confirm = await prompt("\nProceed? [y/N] ");
      if (confirm.toLowerCase() !== "y") {
        console.log("Cancelled.");
        return;
      }

      console.log("Converting...");
      const movementBody: Record<string, any> = { quoteId: quote.id };
      if (opts.sourceBalance) movementBody.sourceBalanceId = validateBalanceId(opts.sourceBalance);
      if (opts.targetBalance) movementBody.targetBalanceId = validateBalanceId(opts.targetBalance);

      const movement = await wisePost(
        `/v2/profiles/${profileId}/balance-movements`,
        movementBody,
        { "X-idempotence-uuid": idempotenceUuid }
      );

      console.log(`Done. ${movement.sourceAmount?.value} ${movement.sourceAmount?.currency} → ${movement.targetAmount?.value} ${movement.targetAmount?.currency}`);
      console.log(`Rate: ${movement.rate}`);
      if (movement.feeAmounts?.length) {
        for (const fee of movement.feeAmounts) {
          console.log(`Fee: ${fee.value} ${fee.currency}`);
        }
      }
    }
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
