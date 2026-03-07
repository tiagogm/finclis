import { monzoGet, requireSession } from "../client.js";
import { loadSession, saveSession, prompt } from "../auth.js";
import { writeJson, handleJsonError } from "../json.js";
import type { BaseCommandOpts } from "../json.js";

export async function accountsListCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const data = await monzoGet("/accounts");
    const accounts: any[] = data.accounts || [];

    if (opts.json) {
      writeJson(accounts);
      return;
    }

    if (accounts.length === 0) {
      console.log("No accounts found.");
      return;
    }

    const rows = accounts.map((a: any) => ({
      id: a.id || "",
      type: a.type || "",
      description: a.description || "",
      created: (a.created || "").slice(0, 10),
      status: a.closed ? "closed" : "active",
    }));

    const w = {
      id: Math.max(2, ...rows.map((r) => r.id.length)),
      type: Math.max(4, ...rows.map((r) => r.type.length)),
      description: Math.max(11, ...rows.map((r) => r.description.length)),
      created: 10,
      status: Math.max(6, ...rows.map((r) => r.status.length)),
    };

    console.log(
      `${"ID".padEnd(w.id)}  ${"Type".padEnd(w.type)}  ${"Description".padEnd(w.description)}  ${"Created".padEnd(w.created)}  Status`
    );
    console.log(
      `${"─".repeat(w.id)}  ${"─".repeat(w.type)}  ${"─".repeat(w.description)}  ${"─".repeat(w.created)}  ${"─".repeat(w.status)}`
    );

    for (const r of rows) {
      console.log(
        `${r.id.padEnd(w.id)}  ${r.type.padEnd(w.type)}  ${r.description.padEnd(w.description)}  ${r.created.padEnd(w.created)}  ${r.status}`
      );
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

export async function accountsSetCommand(accountId?: string): Promise<void> {
  await requireSession();

  const data = await monzoGet("/accounts");
  const accounts: any[] = (data.accounts || []).filter((a: any) => !a.closed);

  if (accounts.length === 0) {
    console.log("No active accounts found.");
    return;
  }

  const session = await loadSession();
  if (!session) return;

  let selected: any;

  if (accountId) {
    selected = accounts.find((a: any) => a.id === accountId);
    if (!selected) {
      console.error(`Account not found: ${accountId}`);
      process.exit(1);
    }
  } else {
    console.log("Active accounts:");
    accounts.forEach((a: any, i: number) => {
      const current = a.id === session.account_id ? " (current)" : "";
      console.log(`  [${i + 1}] ${a.description || a.type}  (${a.type})  — ${a.id}${current}`);
    });

    const input = await prompt(`Select account [1]: `);
    const idx = input.trim() === "" ? 1 : parseInt(input.trim(), 10);
    if (isNaN(idx) || idx < 1 || idx > accounts.length) {
      console.error("Invalid selection.");
      process.exit(1);
    }
    selected = accounts[idx - 1];
  }

  session.account_id = selected.id;
  await saveSession(session);
  console.log(`Switched to: ${selected.description || selected.id}`);
}
