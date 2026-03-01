import fs from "node:fs";
import { clearSession, loadSession, BASE_URL, BROWSER_PROFILE_DIR } from "../auth.js";

// Vanguard auth cookies to clear (preserve device-trust cookies for 2FA)
const AUTH_COOKIES = ["XSRF-TOKEN", "VGI_SESSION", "VGI_COOKIE"];

export async function logoutCommand(): Promise<void> {
  const session = loadSession(undefined, { skipExpiry: true });

  if (!session) {
    console.log("No active session.");
    return;
  }

  // Best-effort: clear auth cookies from persistent browser profile
  // while preserving device-trust so we don't have to 2FA again
  if (fs.existsSync(BROWSER_PROFILE_DIR)) {
    try {
      const { chromium } = await import("playwright");
      const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
        headless: true,
      });

      const cookies = await context.cookies();
      const authCookies = cookies.filter((c: any) => AUTH_COOKIES.includes(c.name));
      if (authCookies.length > 0) {
        await context.clearCookies({
          name: new RegExp(`^(${AUTH_COOKIES.join("|")})$`),
        });
        console.log(`Cleared ${authCookies.length} auth cookie(s) from browser profile.`);
      }

      // Clear localStorage for Vanguard origins
      for (const p of context.pages()) {
        await p.close();
      }
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/blank`, { waitUntil: "commit" }).catch(() => {});
      await page.evaluate(() => localStorage.clear()).catch(() => {});

      await context.close();
    } catch {
      // Best-effort — browser profile may not exist or Playwright issue
    }
  }

  clearSession();
  console.log("Logged out.");
}
