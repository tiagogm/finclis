import { monzoGet, requireSession } from "../client.js";
import { saveSession, selectAccount } from "../auth.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

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
    process.exit(0);
  }
}

export async function accountsSetCommand(accountId?: string): Promise<void> {
  const session = await requireSession();

  const data = await monzoGet("/accounts");
  const accounts: any[] = (data.accounts || []).filter((a: any) => !a.closed);

  if (accounts.length === 0) {
    console.log("No active accounts found.");
    return;
  }

  let selected: any;

  if (accountId) {
    selected = accounts.find((a: any) => a.id === accountId);
    if (!selected) {
      console.error(`Account not found: ${accountId}`);
      process.exit(0);
    }
  } else {
    selected = await selectAccount(accounts, session.account_id);
  }

  session.account_id = selected.id;
  await saveSession(session);
  console.log(`Switched to: ${selected.description || selected.id}`);
}
