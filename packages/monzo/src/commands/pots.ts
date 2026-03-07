import crypto from "node:crypto";
import { monzoGet, monzoPut, requireSession } from "../client.js";
import { prompt } from "../auth.js";
import { writeJson, handleJsonError } from "../json.js";
import type { BaseCommandOpts } from "../json.js";

function formatMoney(pence: number, currency = "GBP"): string {
  const amount = pence / 100;
  return `${currency} ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function potsCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const session = await requireSession();
    const data = await monzoGet(`/pots?current_account_id=${encodeURIComponent(session.account_id)}`);
    const pots: any[] = (data.pots || []).filter((p: any) => !p.deleted);

    if (opts.json) {
      writeJson(pots);
      return;
    }

    if (pots.length === 0) {
      console.log("No pots found.");
      return;
    }

    const rows = pots.map((p: any) => ({
      name: p.name || "",
      id: p.id || "",
      balance: formatMoney(p.balance || 0, p.currency),
      goal: p.goal_amount ? formatMoney(p.goal_amount, p.currency) : "",
      locked: p.locked ? "yes" : "no",
    }));

    const w = {
      name: Math.max(4, ...rows.map((r) => r.name.length)),
      id: Math.max(2, ...rows.map((r) => r.id.length)),
      balance: Math.max(7, ...rows.map((r) => r.balance.length)),
      goal: Math.max(4, ...rows.map((r) => r.goal.length)),
      locked: 6,
    };

    console.log(
      `${"Name".padEnd(w.name)}  ${"ID".padEnd(w.id)}  ${"Balance".padEnd(w.balance)}  ${"Goal".padEnd(w.goal)}  Locked`
    );
    console.log(
      `${"─".repeat(w.name)}  ${"─".repeat(w.id)}  ${"─".repeat(w.balance)}  ${"─".repeat(w.goal)}  ${"─".repeat(w.locked)}`
    );

    for (const r of rows) {
      console.log(
        `${r.name.padEnd(w.name)}  ${r.id.padEnd(w.id)}  ${r.balance.padEnd(w.balance)}  ${r.goal.padEnd(w.goal)}  ${r.locked}`
      );
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

interface PotMoveOpts {
  yes?: boolean;
  verbose?: boolean;
}

async function getPotName(session: { account_id: string }, potId: string): Promise<string> {
  const data = await monzoGet(`/pots?current_account_id=${encodeURIComponent(session.account_id)}`);
  const pot = (data.pots || []).find((p: any) => p.id === potId);
  return pot?.name || potId;
}

export async function potsDepositCommand(
  potId: string,
  amountStr: string,
  opts: PotMoveOpts = {}
): Promise<void> {
  try {
    const session = await requireSession();
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.error("Amount must be a positive number (e.g. 10.50).");
      process.exit(1);
    }

    const pence = Math.round(amount * 100);
    const potName = await getPotName(session, potId);

    if (!opts.yes) {
      const ans = await prompt(
        `Deposit £${amount.toFixed(2)} into '${potName}' (${potId})? [y/N] `
      );
      if (ans.trim().toLowerCase() !== "y") {
        console.log("Cancelled.");
        return;
      }
    }

    const result = await monzoPut(`/pots/${potId}/deposit`, {
      source_account_id: session.account_id,
      amount: String(pence),
      dedupe_id: crypto.randomUUID(),
    });

    const newBalance = formatMoney(result.balance || 0, result.currency);
    console.log(`Deposited. New pot balance: ${newBalance}`);
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

export async function potsWithdrawCommand(
  potId: string,
  amountStr: string,
  opts: PotMoveOpts = {}
): Promise<void> {
  try {
    const session = await requireSession();
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.error("Amount must be a positive number (e.g. 10.50).");
      process.exit(1);
    }

    const pence = Math.round(amount * 100);
    const potName = await getPotName(session, potId);

    if (!opts.yes) {
      const ans = await prompt(
        `Withdraw £${amount.toFixed(2)} from '${potName}' (${potId})? [y/N] `
      );
      if (ans.trim().toLowerCase() !== "y") {
        console.log("Cancelled.");
        return;
      }
    }

    const result = await monzoPut(`/pots/${potId}/withdraw`, {
      destination_account_id: session.account_id,
      amount: String(pence),
      dedupe_id: crypto.randomUUID(),
    });

    const newBalance = formatMoney(result.balance || 0, result.currency);
    console.log(`Withdrawn. New pot balance: ${newBalance}`);
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
