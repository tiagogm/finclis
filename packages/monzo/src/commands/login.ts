import { login } from "../auth.js";

export async function loginCommand(): Promise<void> {
  try {
    await login();
  } catch (err: any) {
    console.error(`Login failed: ${err.message}`);
    process.exit(0);
  }
}
