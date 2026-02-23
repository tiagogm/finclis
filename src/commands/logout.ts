import { clearSession } from "../auth.js";

export function logoutCommand(): void {
  clearSession();
  console.log("Session cleared.");
}
