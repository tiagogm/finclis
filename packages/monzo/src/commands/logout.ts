import { logout } from "../auth.js";

export async function logoutCommand(): Promise<void> {
  try {
    await logout();
  } catch (err: any) {
    console.error(`Logout failed: ${err.message}`);
    process.exit(1);
  }
}
