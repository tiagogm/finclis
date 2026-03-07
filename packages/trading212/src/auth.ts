import readline from "node:readline";

export type Env = "live" | "demo";

export interface Config {
  apiKey: string;
  apiSecret: string;
  env: Env;
}

const SERVICE = "com.trading212-cli";

export async function saveConfig(config: Config): Promise<void> {
  await Bun.secrets.set({ service: SERVICE, name: "config", value: JSON.stringify(config) });
}

export async function loadConfig(): Promise<Config | null> {
  // Env var overrides
  const envKey = process.env.TRADING212_API_KEY;
  const envSecret = process.env.TRADING212_API_SECRET;
  const envEnv = process.env.TRADING212_ENV as Env | undefined;

  if (envKey && envSecret) {
    return { apiKey: envKey, apiSecret: envSecret, env: envEnv || "live" };
  }

  try {
    const raw = await Bun.secrets.get({ service: SERVICE, name: "config" });
    if (!raw) {
      console.error("Not authenticated. Run: trading212 auth set");
      return null;
    }
    const parsed = JSON.parse(raw) as Config;
    if (!parsed.apiKey || !parsed.apiSecret) {
      console.error("Invalid credentials. Run: trading212 auth set");
      return null;
    }
    if (envEnv) parsed.env = envEnv;
    return parsed;
  } catch {
    console.error("Not authenticated. Run: trading212 auth set");
    return null;
  }
}

export async function clearConfig(): Promise<void> {
  try {
    await Bun.secrets.delete({ service: SERVICE, name: "config" });
  } catch {
    // credential doesn't exist, that's fine
  }
}

export function baseUrl(env: Env): string {
  return env === "demo"
    ? "https://demo.trading212.com/api/v0"
    : "https://live.trading212.com/api/v0";
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
        rl.question("", (ans) => {
          rl.close();
          resolve(ans);
        });
      });
      return answer;
    } finally {
      restoreEcho();
      process.stdout.write("\n");
      process.removeListener("exit", restoreEcho);
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
