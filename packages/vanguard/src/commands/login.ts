import { login } from "../auth.js";

interface LoginOpts {
  ttl?: string;
}

export async function loginCommand(opts: LoginOpts = {}): Promise<void> {
  let ttlMinutes: number | undefined;

  if (opts.ttl !== undefined) {
    ttlMinutes = Number(opts.ttl);
    if (!Number.isInteger(ttlMinutes) || ttlMinutes <= 0) {
      console.error("--ttl must be a positive integer (minutes)");
      process.exit(0);
    }
  }

  try {
    await login(ttlMinutes);
  } catch (err: any) {
    console.error(`Login failed: ${err.message}`);
    process.exit(0);
  }
}
