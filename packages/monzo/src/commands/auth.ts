import { loadCredentials, saveCredentials, clearCredentials, prompt } from "../auth.js";

export async function authViewCommand(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    console.log("No credentials stored. Run: monzo auth set");
    return;
  }
  printCredentials(creds.client_id, creds.client_secret);
}

export async function authSetCommand(): Promise<void> {
  const clientId = await prompt("Monzo client_id: ");
  const clientSecret = await prompt("Monzo client_secret: ", true);

  if (!clientId || !clientSecret) {
    console.error("Both client_id and client_secret are required.");
    process.exit(0);
  }

  await saveCredentials({ client_id: clientId, client_secret: clientSecret });
  console.log("Credentials saved.");
}

export async function authClearCommand(): Promise<void> {
  await clearCredentials();
  console.log("Credentials removed.");
}

function printCredentials(clientId: string, clientSecret: string): void {
  const masked = clientSecret.length > 12
    ? clientSecret.slice(0, 6) + "…" + clientSecret.slice(-6)
    : "****";
  console.log(`client_id:     ${clientId}`);
  console.log(`client_secret: ${masked}`);
}
