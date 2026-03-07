import { loadSession, refreshSession, MonzoSession, API_URL } from "./auth.js";

let verbose = false;

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
    }
  } catch {
    // not JSON
  }
  return new Error(message);
}

export async function requireSession(): Promise<MonzoSession> {
  const session = await loadSession();
  if (!session) {
    process.exit(0);
  }
  return session;
}

async function getValidSession(): Promise<MonzoSession> {
  let session = await requireSession();
  const nowSecs = Math.floor(Date.now() / 1000);
  if (session.expires_at - 60 < nowSecs) {
    if (!session.refresh_token) {
      console.log("Session expired. Run: monzo login");
      process.exit(0);
    }
    session = await refreshSession(session);
  }
  return session;
}

interface FetchOpts {
  method: string;
  body?: string;
  contentType?: string;
}

async function monzoFetch(path: string, opts: FetchOpts): Promise<any> {
  const session = await getValidSession();
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };
  if (opts.contentType) headers["Content-Type"] = opts.contentType;

  const reqInit: RequestInit = { method: opts.method, headers };
  if (opts.body) reqInit.body = opts.body;

  if (verbose) console.error(`-> ${opts.method} ${url}`);
  let res = await fetch(url, reqInit);
  if (verbose) console.error(`<- ${res.status}`);

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    if (verbose) console.error(`-> ${opts.method} ${url} (rate-limit retry)`);
    res = await fetch(url, reqInit);
    if (verbose) console.error(`<- ${res.status}`);
  }

  if (!res.ok) throw await apiError(res);

  const json = await res.json();
  if (verbose) console.error(`<- body: ${JSON.stringify(json).slice(0, 2000)}`);
  return json;
}

export async function monzoGet(path: string): Promise<any> {
  return monzoFetch(path, { method: "GET" });
}

export async function monzoPost(
  path: string,
  body: Record<string, string>,
): Promise<any> {
  return monzoFetch(path, {
    method: "POST",
    body: new URLSearchParams(body).toString(),
    contentType: "application/x-www-form-urlencoded",
  });
}

export async function monzoPut(
  path: string,
  formParams: Record<string, string>,
): Promise<any> {
  return monzoFetch(path, {
    method: "PUT",
    body: new URLSearchParams(formParams).toString(),
    contentType: "application/x-www-form-urlencoded",
  });
}
