import {
  loadSession,
  touchSession,
  type LloydsCliSession,
  BROWSER_PROFILE_DIR,
  USER_AGENT,
  BROWSER_LAUNCH_ARGS,
} from "./auth.js";
import type { LloydsTransaction } from "./aggregator.js";

const BASE_URL = "https://secure.lloydsbank.co.uk";
const DASHBOARD_URL =
  "https://secure.lloydsbank.co.uk/personal/a/account_overview_personal/";

let verbose = false;
let _session: LloydsCliSession | null = null;
let _context: any = null;
let _client: LloydsApiClient | null = null;

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

/**
 * Load session or exit with guidance. Memoised — only reads disk once per process.
 */
export function requireSession(): LloydsCliSession {
  if (_session) return _session;
  const session = loadSession();
  if (!session) {
    console.error("Not logged in. Run: lloyds login");
    process.exit(0);
  }
  _session = session;
  return _session;
}

// Lazy-load the Playwright context (only needed for logout, which must navigate a page).
async function getContext(session: LloydsCliSession): Promise<any> {
  if (_context) return _context;
  const { chromium } = await import("playwright");
  _context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: true,
    args: BROWSER_LAUNCH_ARGS,
    ignoreDefaultArgs: ["--enable-automation"],
    userAgent: USER_AGENT,
    viewport: { width: 1024, height: 768 },
    locale: "en-GB",
    timezoneId: "Europe/London",
    permissions: [],
    hasTouch: false,
    isMobile: false,
  });
  return _context;
}

/**
 * Get (or lazily create) the API client. Memoised per process.
 */
export async function getClient(): Promise<LloydsApiClient> {
  if (_client) return _client;
  const session = requireSession();
  _client = new LloydsApiClient(session.arrangementId, session);
  return _client;
}

/**
 * Close the Playwright browser/context. Called in the finally block in index.ts.
 */
export async function cleanup(): Promise<void> {
  if (_context) {
    await _context.close().catch(() => {});
    _context = null;
  }
  _client = null;
}

export class LloydsApiClient {
  private arrangementId: string;
  private session: LloydsCliSession;
  private cookieHeader: string;

  constructor(arrangementId: string, session: LloydsCliSession) {
    this.arrangementId = arrangementId;
    this.session = session;
    // Build Cookie header once from the saved session.
    // Bun's native fetch (unlike browser fetch) can set Cookie/Referer freely.
    this.cookieHeader = session.cookies
      .filter((c) => {
        const d = c.domain.startsWith(".") ? c.domain.slice(1) : c.domain;
        return "secure.lloydsbank.co.uk".endsWith(d);
      })
      .filter((c) => c.expires === -1 || c.expires > Date.now() / 1000)
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }

  private async request<T>(
    urlPath: string,
    params?: Record<string, string>
  ): Promise<T> {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const fullUrl = `${BASE_URL}${urlPath}${qs}`;

    if (verbose) console.error(`-> GET ${fullUrl}`);

    // Use Bun's native fetch — no browser overhead, no Playwright Bun bugs.
    // context.request.get() (POC) also makes a direct HTTP request (not a browser
    // page fetch), so this mirrors the same approach in a Bun-compatible way.
    const response = await fetch(fullUrl, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-GB,en;q=0.9",
        "Cache-Control": "no-cache",
        "IB-app-valid-end": "123",
        Referer: DASHBOARD_URL,
        "User-Agent": USER_AGENT,
        Cookie: this.cookieHeader,
      },
    });

    if (verbose) console.error(`<- ${response.status}`);

    const text = await response.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
      if (verbose) console.error(`<- body: ${text.slice(0, 300)}`);
      throw new Error("Session expired. Run: lloyds login");
    }

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const result = JSON.parse(text) as T;
    touchSession();
    return result;
  }

  async getAccounts(): Promise<any[]> {
    return this.request<any[]>(
      "/personal/retail/aov-api/browser/aov/v1/accounts/account-type/C"
    );
  }

  async getMonthlyTransactions(month: string, page = 0): Promise<any> {
    return this.request<any>(
      `/personal/retail/statement-api/browser/arrangements/${this.arrangementId}/monthly-transactions`,
      {
        month,
        size: "120",
        page: page.toString(),
        completeDescription: "true",
      }
    );
  }

  /** Fetch all pages of transactions for a month, handling pagination. */
  async fetchAllTransactions(monthKey: string): Promise<LloydsTransaction[]> {
    const PAGE_SIZE = 120;
    const all: LloydsTransaction[] = [];
    let page = 0;
    let batch: any;

    do {
      batch = await this.getMonthlyTransactions(monthKey, page);
      if (batch.transactions) all.push(...batch.transactions);
      page++;
    } while (batch.transactions && batch.transactions.length >= PAGE_SIZE);

    return all;
  }

  async performLogout(): Promise<void> {
    // Logout requires a browser page (server-side session invalidation via navigation).
    const session = this.session;
    const context = await getContext(session);
    const page = await context.newPage();
    try {
      await page
        .goto(`${BASE_URL}/personal/unauth/pages/loggedoff.jsp`, {
          waitUntil: "networkidle",
          timeout: 15_000,
        })
        .catch(() => {});
    } finally {
      await page.close().catch(() => {});
    }
  }
}
