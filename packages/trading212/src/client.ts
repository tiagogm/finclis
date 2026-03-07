import { loadConfig, baseUrl, type Env } from "./auth.js";

let verbose = false;

const RATE_LIMIT_COOLDOWN_MS = 60_000;

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

async function apiError(res: Response): Promise<Error> {
  let message = `API error ${res.status}`;
  try {
    const body = await res.json();
    if (verbose) console.error(`<- body: ${JSON.stringify(body)}`);
    if (body.message) {
      message += `: ${body.message}`;
    } else if (body.error) {
      message += `: ${body.error}`;
    } else if (body.code) {
      message += `: ${body.code}`;
    }
  } catch {
    // Not JSON — just use status code
  }
  return new Error(message);
}

async function sleep(ms: number): Promise<void> {
  // Suppress terminal echo while waiting so keystrokes don't clutter output
  try {
    const { execSync } = await import("node:child_process");
    execSync("stty -echo 2>/dev/null", { stdio: "inherit" });
    await new Promise((resolve) => setTimeout(resolve, ms));
    execSync("stty echo 2>/dev/null", { stdio: "inherit" });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function fetchWithRateLimitRetry(url: string, auth: string, maxRetries = 5): Promise<Response> {
  let res = await fetch(url, { headers: { Authorization: auth } });

  for (let attempt = 1; attempt <= maxRetries && res.status === 429; attempt++) {
    const retryAfter = res.headers.get("retry-after");
    const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_COOLDOWN_MS;
    process.stderr.write(`\nRate limited (429). Waiting ${waitMs / 1000}s... (attempt ${attempt}/${maxRetries})\n`);
    await sleep(waitMs);
    if (verbose) console.error(`-> GET ${url} (retry ${attempt})`);
    res = await fetch(url, { headers: { Authorization: auth } });
  }

  return res;
}

async function requireConfig() {
  const config = await loadConfig();
  if (!config) {
    process.exit(1);
  }
  return config;
}

export async function getEnv(): Promise<Env> {
  return (await requireConfig()).env;
}

export async function t212Post(path: string, body: unknown): Promise<any> {
  const config = await requireConfig();
  const url = `${baseUrl(config.env)}${path}`;
  const auth = `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}`;

  if (verbose) console.error(`-> POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (verbose) console.error(`<- ${res.status}`);

  if (!res.ok) {
    throw await apiError(res);
  }

  const json = await res.json();
  if (verbose) {
    console.error(`<- body: ${JSON.stringify(json).slice(0, 2000)}`);
  }
  return json;
}

export async function t212Download(url: string): Promise<string> {
  if (verbose) console.error(`-> GET ${url} (download)`);
  const res = await fetch(url);
  if (verbose) console.error(`<- ${res.status}`);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  return res.text();
}

export async function t212Get(path: string): Promise<any> {
  const config = await requireConfig();
  const url = `${baseUrl(config.env)}${path}`;
  const auth = `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}`;

  if (verbose) console.error(`-> GET ${url}`);
  const res = await fetchWithRateLimitRetry(url, auth);
  if (verbose) console.error(`<- ${res.status}`);

  if (!res.ok) {
    throw await apiError(res);
  }

  const json = await res.json();
  if (verbose) {
    console.error(`<- body: ${JSON.stringify(json).slice(0, 2000)}`);
  }
  return json;
}

/**
 * Fetch all pages of a paginated endpoint.
 * Trading212 returns { items: [...], nextPagePath: "/equity/..." | null }
 */
export async function t212GetAll(path: string): Promise<any[]> {
  const config = await requireConfig();
  let currentPath: string | null = path;
  const allItems: any[] = [];
  const auth = `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}`;

  while (currentPath !== null) {
    const reqPath: string = currentPath;
    const reqUrl = `${baseUrl(config.env)}${reqPath}`;
    if (verbose) console.error(`-> GET ${reqUrl}`);
    const reqRes = await fetchWithRateLimitRetry(reqUrl, auth);
    if (verbose) console.error(`<- ${reqRes.status}`);

    if (!reqRes.ok) {
      throw await apiError(reqRes);
    }

    const json: unknown = await reqRes.json();
    if (verbose) {
      console.error(`<- body: ${JSON.stringify(json).slice(0, 500)}`);
    }

    if (Array.isArray(json)) {
      allItems.push(...json);
      break;
    }

    const page = json as { items?: any[]; nextPagePath?: string | null };
    if (page.items) {
      allItems.push(...page.items);
    }

    currentPath = page.nextPagePath ?? null;
  }

  return allItems;
}
