import readline from "node:readline";

export const API_URL = "https://api.kraken.com";

export interface KrakenSession {
  apiKey: string;
  apiSecret: string;
}

const SERVICE = "com.kraken-cli";

// Abstracted secrets store — allows injection in tests
export interface SecretsStore {
  set(opts: { service: string; name: string; value: string }): Promise<void>;
  get(opts: { service: string; name: string }): Promise<string | null>;
  delete(opts: { service: string; name: string }): Promise<void>;
}

let _secrets: SecretsStore = Bun.secrets as unknown as SecretsStore;

export function _setSecrets(store: SecretsStore): void {
  _secrets = store;
}

export async function saveSession(session: KrakenSession): Promise<void> {
  await _secrets.set({ service: SERVICE, name: "session", value: JSON.stringify(session) });
}

export async function loadSession(): Promise<KrakenSession | null> {
  try {
    const raw = await _secrets.get({ service: SERVICE, name: "session" });
    if (!raw) {
      console.error("Not logged in. Run: kraken login");
      return null;
    }
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.apiKey !== "string" ||
      !parsed.apiKey ||
      typeof parsed.apiSecret !== "string" ||
      !parsed.apiSecret
    ) {
      console.error("Invalid session. Run: kraken login");
      return null;
    }
    return parsed as KrakenSession;
  } catch {
    console.error("Not logged in. Run: kraken login");
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await _secrets.delete({ service: SERVICE, name: "session" });
  } catch {
    // doesn't exist, that's fine
  }
}

export async function prompt(question: string, hidden = false): Promise<string> {
  if (hidden) {
    const { execSync } = await import("node:child_process");

    const restoreEcho = () => {
      try { execSync("stty echo", { stdio: "inherit" }); } catch {}
    };

    process.on("exit", restoreEcho);
    process.on("SIGINT", () => { restoreEcho(); process.exit(130); });
    process.on("SIGTERM", () => { restoreEcho(); process.exit(143); });

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
    }
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}
