import readline from "node:readline";

export const API_URL = "https://api.kraken.com";

export interface KrakenCredentials {
  apiKey: string;
  apiSecret: string;
  twoFactor?: boolean;
}

const SERVICE = "com.kraken-cli";

export async function saveCredentials(credentials: KrakenCredentials): Promise<void> {
  await Bun.secrets.set({ service: SERVICE, name: "credentials", value: JSON.stringify(credentials) });
}

export async function loadCredentials(): Promise<KrakenCredentials | null> {
  try {
    const raw = await Bun.secrets.get({ service: SERVICE, name: "credentials" });
    if (!raw) {
      console.error("No credentials stored. Run: kraken auth set");
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
      console.error("Invalid credentials. Run: kraken auth set");
      return null;
    }
    return parsed as KrakenCredentials;
  } catch {
    console.error("No credentials stored. Run: kraken auth set");
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  try {
    await Bun.secrets.delete({ service: SERVICE, name: "credentials" });
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

    const onExit = () => restoreEcho();
    const onSigint = () => { restoreEcho(); process.exit(130); };
    const onSigterm = () => { restoreEcho(); process.exit(143); };

    process.on("exit", onExit);
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);

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
      process.removeListener("exit", onExit);
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
    }
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}
