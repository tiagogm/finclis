import { login } from "../auth.js";

interface LoginOpts {
  ttl?: string;
}

export async function loginCommand(opts: LoginOpts): Promise<void> {
  try {
    const ttl = opts.ttl ? parseInt(opts.ttl, 10) : undefined;
    if (opts.ttl && (!ttl || ttl <= 0)) {
      console.error("TTL must be a positive number (minutes).");
      process.exit(1);
    }
    await login(ttl);
  } catch (err: any) {
    console.error(`Login failed: ${err.message}`);
    process.exit(1);
  }
}
