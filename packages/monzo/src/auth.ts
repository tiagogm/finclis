import path from "node:path";
import os from "node:os";
import http from "node:http";
import readline from "node:readline";
import crypto from "node:crypto";

export const API_URL = "https://api.monzo.com";
export const AUTH_URL = "https://auth.monzo.com";

export interface MonzoSession {
  access_token: string;
  refresh_token?: string;  // absent for public clients
  expires_at: number;      // Unix seconds
  account_id: string;
  client_id: string;
  client_secret: string;
}

const SERVICE = "com.monzo-cli";
export const CACHE_DIR = path.join(os.homedir(), ".monzo-cli", "cache");

export async function saveSession(session: MonzoSession): Promise<void> {
  await Bun.secrets.set({ service: SERVICE, name: "session", value: JSON.stringify(session) });
}

export async function loadSession(): Promise<MonzoSession | null> {
  try {
    const raw = await Bun.secrets.get({ service: SERVICE, name: "session" });
    if (!raw) {
      console.error("Not logged in. Run: monzo login");
      return null;
    }
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.access_token !== "string" ||
      typeof parsed.expires_at !== "number" ||
      typeof parsed.account_id !== "string" ||
      typeof parsed.client_id !== "string" ||
      typeof parsed.client_secret !== "string"
    ) {
      console.error("Invalid session. Run: monzo login");
      return null;
    }
    return parsed as MonzoSession;
  } catch {
    console.error("Not logged in. Run: monzo login");
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await Bun.secrets.delete({ service: SERVICE, name: "session" });
  } catch {
    // doesn't exist, that's fine
  }
}

export async function prompt(question: string, hidden = false): Promise<string> {
  if (hidden) {
    // execSync with hardcoded stty commands — no user input, safe from injection
    const { execSync } = await import("node:child_process");

    const restoreEcho = () => {
      try { execSync("stty echo", { stdio: "inherit" }); } catch {}
    };
    const onSigInt = () => { restoreEcho(); process.exit(130); };
    const onSigTerm = () => { restoreEcho(); process.exit(143); };

    process.on("exit", restoreEcho);
    process.on("SIGINT", onSigInt);
    process.on("SIGTERM", onSigTerm);

    process.stdout.write(question);
    try {
      execSync("stty -echo", { stdio: "inherit" });
      const rl = readline.createInterface({
        input: process.stdin,
        output: new (await import("node:stream")).Writable({
          write(_chunk, _encoding, callback) { callback(); },
        }),
      });
      const answer = await new Promise<string>((resolve) => {
        rl.question("", (ans) => { rl.close(); resolve(ans); });
      });
      return answer;
    } finally {
      restoreEcho();
      process.stdout.write("\n");
      process.removeListener("exit", restoreEcho);
      process.removeListener("SIGINT", onSigInt);
      process.removeListener("SIGTERM", onSigTerm);
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function waitForCode(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);

      // Ignore non-callback requests (favicon, prefetch, etc.)
      if (!url.pathname.startsWith("/callback")) {
        res.writeHead(204);
        res.end();
        return;
      }

      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      const state = url.searchParams.get("state");

      // Validate state to prevent CSRF
      if (state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Monzo CLI</h1><p>Error: Invalid state parameter (possible CSRF).</p></body></html>");
        server.close();
        reject(new Error("OAuth callback state mismatch (possible CSRF attack)"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<html><body><h1>Monzo CLI</h1><p>${
          code
            ? "Authenticated! You can close this tab and return to the terminal."
            : `Error: ${error || "No code received."}`
        }</p></body></html>`
      );

      server.close();

      if (code) {
        resolve(code);
      } else {
        reject(new Error(`OAuth error: ${error || "no code in callback"}`));
      }
    });

    server.listen(port, "127.0.0.1", () => {});
    server.on("error", reject);
  });
}

async function tryOpenBrowser(url: string): Promise<void> {
  const { exec } = await import("node:child_process");
  const cmds = process.platform === "darwin" ? ["open"] :
    process.platform === "win32" ? ["start"] : ["xdg-open", "sensible-browser"];

  for (const cmd of cmds) {
    try {
      await new Promise<void>((resolve, reject) => {
        exec(`${cmd} "${url}"`, (err) => (err ? reject(err) : resolve()));
      });
      return;
    } catch {
      // try next
    }
  }
}

export async function login(): Promise<void> {
  let clientId = process.env.MONZO_CLIENT_ID || "";
  let clientSecret = process.env.MONZO_CLIENT_SECRET || "";

  if (!clientId) {
    clientId = await prompt("Monzo client_id: ");
  }
  if (!clientSecret) {
    clientSecret = await prompt("Monzo client_secret: ");
  }

  const redirectUri = "http://localhost:3000/callback";
  const state = crypto.randomUUID();
  const port = 3000;

  const authUrl =
    `${AUTH_URL}/?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  console.log("\nOpening browser for Monzo authorization...");
  console.log(`Auth URL: ${authUrl}\n`);

  const codePromise = waitForCode(port, state);

  try {
    await tryOpenBrowser(authUrl);
  } catch {
    console.log("Could not open browser. Open this URL manually:");
    console.log(authUrl);
  }

  console.log("Waiting for authorization (check your browser and Monzo app)...");
  const code = await codePromise;

  // Exchange code for tokens
  const tokenRes = await fetch(`${API_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    if (body.includes("evicted")) {
      throw new Error(
        "Auth code was invalidated by Monzo (another active session interfered).\n" +
        "Close all Monzo browser tabs and the Monzo web app, then try: monzo login"
      );
    }
    throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

  // Monzo requires the user to confirm the login in the app before the token is active.
  // Poll /accounts until it succeeds (up to 5 minutes).
  console.log("\nCheck your Monzo app and approve the login request...");

  const pollDeadline = Date.now() + 5 * 60 * 1000;
  type AccountsData = { accounts: Array<{ id: string; type: string; description: string; closed: boolean }> };
  let accountsData: AccountsData | null = null;

  while (Date.now() < pollDeadline) {
    const accountsRes = await fetch(`${API_URL}/accounts`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (accountsRes.ok) {
      accountsData = (await accountsRes.json()) as AccountsData;
      break;
    }

    if (accountsRes.status !== 403) {
      throw new Error(`Failed to fetch accounts (${accountsRes.status})`);
    }

    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 3000));
  }

  process.stdout.write("\n");

  if (!accountsData) {
    throw new Error("Timed out waiting for Monzo app approval. Try logging in again.");
  }

  const active = accountsData.accounts.filter((a) => !a.closed);
  if (active.length === 0) {
    throw new Error("No active accounts found");
  }

  let selectedAccount = active[0];

  if (active.length > 1) {
    console.log(`Found ${active.length} accounts:`);
    active.forEach((a, i) => {
      console.log(`  [${i + 1}] ${a.description || a.type}  (${a.type})  — ${a.id}`);
    });
    const input = await prompt(`Select account [1]: `);
    const idx = input.trim() === "" ? 1 : parseInt(input.trim(), 10);
    if (isNaN(idx) || idx < 1 || idx > active.length) {
      throw new Error("Invalid selection");
    }
    selectedAccount = active[idx - 1];
  }

  const session: MonzoSession = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    account_id: selectedAccount.id,
    client_id: clientId,
    client_secret: clientSecret,
  };

  await saveSession(session);
  console.log(`\nAuthenticated. Account: ${selectedAccount.description || selectedAccount.id}`);
}

export async function logout(): Promise<void> {
  const session = await loadSession();
  if (!session) {
    console.log("No active session.");
    return;
  }

  try {
    await fetch(`${API_URL}/oauth2/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    // best effort
  }

  await clearSession();
  console.log("Logged out.");
}

export async function refreshSession(session: MonzoSession): Promise<MonzoSession> {
  if (!session.refresh_token) {
    throw new Error("No refresh token available. Run: monzo login");
  }
  const res = await fetch(`${API_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: session.client_id,
      client_secret: session.client_secret,
      refresh_token: session.refresh_token,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const updated: MonzoSession = {
    ...session,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
  };

  await saveSession(updated);
  return updated;
}

