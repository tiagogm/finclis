import { BASE_URL, loadSession, Session } from "./auth.js";

let verbose = false;

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

// Lazy singleton browser + context + page
let _browser: any = null;
let _context: any = null;
let _page: any = null;

async function getPage(session: Session): Promise<any> {
  if (_page) return _page;

  const { chromium } = await import("playwright");
  _browser = await chromium.launch({ headless: true });
  _context = await _browser.newContext({
    storageState: { cookies: session.cookies, origins: session.origins },
  });
  _page = await _context.newPage();
  return _page;
}

async function closeContext(): Promise<void> {
  if (_page) {
    await _page.close().catch(() => {});
    _page = null;
  }
  if (_context) {
    await _context.close().catch(() => {});
    _context = null;
  }
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

/**
 * Load session or exit with an error.
 */
export function requireSession(): Session {
  const session = loadSession();
  if (!session) {
    process.exit(0);
  }
  return session;
}

async function fetchViaPage(
  page: any,
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: any
): Promise<{ status: number; ok: boolean; text: string }> {
  // If page is already on the secure domain, use in-page fetch
  if (page.url().startsWith(BASE_URL)) {
    return page.evaluate(
      async ({ url, method, headers, body }: any) => {
        const opts: RequestInit = { method, headers };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        const text = await res.text();
        return { status: res.status, ok: res.ok, text };
      },
      { url, method, headers, body }
    );
  }

  // First request: page is on about:blank. Use page.goto() to navigate
  // to the API URL (landing on secure.vanguardinvestor.co.uk).
  // Intercept the navigation via page.route() to set correct method/headers/body.
  const handler = async (route: any) => {
    await route.continue({
      method,
      headers: { ...route.request().headers(), ...headers },
      postData: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };
  await page.route(url, handler);
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.unroute(url, handler);

  if (!response) throw new Error("No response from server");
  const text = await response.text();
  return { status: response.status(), ok: response.ok(), text };
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response but got: ${text.slice(0, 200)}`);
  }
}

function buildHeaders(session: Session): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "anti-forgery-token": session.xsrfToken,
  };
}

async function request(
  method: "GET" | "POST",
  urlPath: string,
  session: Session,
  body?: any
): Promise<any> {
  const page = await getPage(session);
  const url = `${BASE_URL}${urlPath}`;
  const headers = buildHeaders(session);

  if (verbose) console.error(`-> ${method} ${url}`);

  // Use page.evaluate(fetch) instead of context.request to work around
  // bun+Playwright IPC bug where context.request hangs (oven-sh/bun#15679).
  const result = await fetchViaPage(page, url, method, headers, body);

  if (verbose) console.error(`<- ${result.status}`);

  // 401/403 -> session expired
  if (result.status === 401 || result.status === 403) {
    await closeContext();
    throw new Error("Session expired. Run: vanguard login");
  }

  if (!result.ok) {
    if (verbose) console.error(`<- body: ${result.text.slice(0, 2000)}`);
    throw new Error(`API error ${result.status}`);
  }

  const json = parseJson(result.text);
  if (verbose) console.error(`<- body: ${result.text.slice(0, 2000)}`);
  return json.Result !== undefined ? json.Result : json;
}

/**
 * Make an authenticated GET request to Vanguard API.
 */
export async function vanguardGet(urlPath: string): Promise<any> {
  const session = requireSession();
  return request("GET", urlPath, session);
}

/**
 * Make an authenticated POST request to Vanguard API.
 */
export async function vanguardPost(urlPath: string, body: any): Promise<any> {
  const session = requireSession();
  return request("POST", urlPath, session, body);
}

/**
 * Close the Playwright browser when done.
 * Call this before process exit in commands that use the client.
 */
export async function cleanup(): Promise<void> {
  await closeContext();
}
