import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const BASE_URL = "https://secure.vanguardinvestor.co.uk";
export const DEFAULT_TTL_MS = 60 * 60 * 1000; // 60 minutes

export interface Session {
  cookies: any[];
  origins: any[];
  xsrfToken: string;
  hierarchyId: string;
  createdAt: number;
  ttlMs?: number;
}

export const BROWSER_PROFILE_DIR = path.join(
  os.homedir(),
  ".vanguard-cli",
  "browser-profile"
);

const DEFAULT_SESSION_PATH = path.join(
  os.homedir(),
  ".vanguard-cli",
  "session.json"
);

export function saveSession(
  session: Session,
  sessionPath = DEFAULT_SESSION_PATH
): void {
  const dir = path.dirname(sessionPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), {
    mode: 0o600,
  });
}

export function loadSession(
  sessionPath = DEFAULT_SESSION_PATH,
  opts?: { skipExpiry?: boolean }
): Session | null {
  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed.xsrfToken !== "string" ||
      !parsed.xsrfToken ||
      typeof parsed.hierarchyId !== "string" ||
      !parsed.hierarchyId ||
      !Array.isArray(parsed.cookies) ||
      !Array.isArray(parsed.origins)
    ) {
      console.error("Invalid session. Run: vanguard login");
      return null;
    }

    if (typeof parsed.createdAt !== "number" || parsed.createdAt <= 0) {
      console.error("Invalid session. Run: vanguard login");
      return null;
    }

    if (parsed.ttlMs !== undefined && (typeof parsed.ttlMs !== "number" || parsed.ttlMs <= 0)) {
      console.error("Invalid session. Run: vanguard login");
      return null;
    }

    if (!opts?.skipExpiry) {
      const ttl = parsed.ttlMs ?? DEFAULT_TTL_MS;
      if (Date.now() - parsed.createdAt > ttl) {
        console.error("Session expired. Run: vanguard login");
        return null;
      }
    }

    return parsed as Session;
  } catch {
    console.error("Not logged in. Run: vanguard login");
    return null;
  }
}

export function clearSession(sessionPath = DEFAULT_SESSION_PATH): void {
  try {
    fs.unlinkSync(sessionPath);
  } catch {
    // file doesn't exist, that's fine
  }
}

/**
 * Login to Vanguard via browser.
 *
 * Flow: secure.../login → login.vanguardinvestor.co.uk → my.../auth/login-mfa → dashboard
 * After login Vanguard may redirect to a broken page — we handle this by
 * navigating to the secure root to land on the real dashboard.
 */
export async function login(ttlMinutes?: number): Promise<Session> {
  const { chromium } = await import("playwright");

  console.log("Opening browser for Vanguard login...");
  console.log("Complete login in the browser window (email + 2FA).\n");

  // Use a persistent profile so Vanguard remembers this device for 2FA.
  // launchPersistentContext avoids the automation detection flags.
  fs.mkdirSync(BROWSER_PROFILE_DIR, { recursive: true, mode: 0o700 });

  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  // Auto-close any extra tabs from previous session
  const page = context.pages()[0] || await context.newPage();
  for (const p of context.pages()) {
    if (p !== page) await p.close();
  }

  // Close any new tabs that open (tracking, ads, OAuth popups) — we only need the main page
  context.on("page", (p) => { p.close().catch(() => {}); });

  try {
    await page.goto(`${BASE_URL}/en-GB/login`);

    console.log("Waiting for login to complete (up to 5 minutes)...");

    // Step 1: Wait for OAuth redirect to login domain (confirms page loaded)
    await page.waitForURL(
      (url: URL) => url.hostname === "login.vanguardinvestor.co.uk",
      { timeout: 10_000 }
    ).catch(() => {
      // May already be past this step if cookies are still valid
    });

    // Step 2: Wait for user to complete login + 2FA (leaves login/2FA domains)
    await page.waitForURL(
      (url: URL) => {
        const host = url.hostname;
        return (
          host !== "login.vanguardinvestor.co.uk" &&
          !(host === "my.vanguardinvestor.co.uk" && url.pathname.includes("/auth/"))
        );
      },
      { timeout: 300_000, waitUntil: "commit" }
    );

    // Step 3: Check if we landed on dashboard or broken redirect
    const DASHBOARD_RE = /\/customer\/home\/([\d]+-[\dA-Z]+)/i;
    const currentUrl = page.url();

    if (!DASHBOARD_RE.test(currentUrl)) {
      console.log("Redirecting to dashboard...");
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    }

    console.log(`Dashboard URL: ${page.url()}`);

    // Extract hierarchy ID from URL
    const match = DASHBOARD_RE.exec(page.url());
    if (!match) {
      throw new Error(
        "Could not extract hierarchy ID from dashboard URL: " + page.url()
      );
    }
    const hierarchyId = match[1];

    // Save full storage state (cookies + localStorage origins) for the API client
    const storageState = await context.storageState();

    // Extract XSRF token from cookies (use raw value, no decoding)
    const xsrfCookie = storageState.cookies.find((c: any) => c.name === "XSRF-TOKEN");
    if (!xsrfCookie) {
      throw new Error("Could not find XSRF-TOKEN cookie");
    }
    const xsrfToken = xsrfCookie.value;

    const session: Session = {
      cookies: storageState.cookies,
      origins: storageState.origins,
      xsrfToken,
      hierarchyId,
      createdAt: Date.now(),
      ...(ttlMinutes ? { ttlMs: ttlMinutes * 60 * 1000 } : {}),
    };
    saveSession(session);

    await page.close(); // aborts in-flight requests before flushing profile
    await context.close();

    console.log(`Authenticated successfully. Hierarchy ID: ${hierarchyId}`);
    return session;
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}
