import { login } from "../auth.js";
import { monzoGet } from "../client.js";
import { validateDate } from "../validate.js";

interface LoginOpts {
  sync?: boolean;
  from?: string;
}

export async function loginCommand(opts: LoginOpts): Promise<void> {
  try {
    if (opts.from) validateDate(opts.from);
    await login({ sync: opts.sync, from: opts.from, fetchFn: monzoGet });
  } catch (err: any) {
    console.error(`Login failed: ${err.message}`);
    process.exit(1);
  }
}
