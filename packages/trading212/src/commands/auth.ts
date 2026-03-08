import { saveConfig, loadConfig, clearConfig, baseUrl, type Env } from "../auth.js";
import { prompt } from "@finclis/cli-utils";

export async function authSetCommand(): Promise<void> {
  const apiKey = await prompt("API key: ", true);
  if (!apiKey.trim()) {
    console.error("API key cannot be empty.");
    process.exit(1);
  }

  const apiSecret = await prompt("API secret: ", true);
  if (!apiSecret.trim()) {
    console.error("API secret cannot be empty.");
    process.exit(1);
  }

  const envInput = await prompt("Environment [live/demo, default: live]: ");
  const env: Env = envInput.trim() === "demo" ? "demo" : "live";

  // Validate by calling account info with Basic auth
  const url = `${baseUrl(env)}/equity/account/info`;
  const auth = `Basic ${btoa(`${apiKey.trim()}:${apiSecret.trim()}`)}`;
  console.log(`Validating against ${env} environment...`);
  const res = await fetch(url, { headers: { Authorization: auth } });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.message || body.error || "";
    } catch {}
    console.error(`Authentication failed (${res.status})${detail ? `: ${detail}` : "."}`);
    process.exit(1);
  }

  const info = await res.json();
  await saveConfig({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), env });
  console.log(`Authenticated successfully.`);
  console.log(`Account ID: ${info.id}`);
  console.log(`Currency:   ${info.currencyCode}`);
  console.log(`Credentials saved to keychain.`);
}

export async function authViewCommand(): Promise<void> {
  const config = await loadConfig();
  if (!config) process.exit(1);

  const key = config.apiKey;
  const masked =
    key.length > 8
      ? `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}`
      : "*".repeat(key.length);

  console.log(`API key:  ${masked}`);
  console.log(`Env:      ${config.env}`);
}

export async function authClearCommand(): Promise<void> {
  await clearConfig();
  console.log("Credentials removed.");
}
