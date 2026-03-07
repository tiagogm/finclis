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
    process.exit(1);
  }
  return session;
}

async function getValidSession(): Promise<MonzoSession> {
  let session = await requireSession();
  const nowSecs = Math.floor(Date.now() / 1000);
  if (session.expires_at - 60 < nowSecs) {
    if (!session.refresh_token) {
      console.error("Session expired. Run: monzo login");
      process.exit(1);
    }
    session = await refreshSession(session);
  }
  return session;
}

export async function monzoGet(path: string): Promise<any> {
  const session = await getValidSession();
  const url = `${API_URL}${path}`;

  if (verbose) console.error(`-> GET ${url}`);
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (verbose) console.error(`<- ${res.status}`);

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    if (verbose) console.error(`-> GET ${url} (rate-limit retry)`);
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (verbose) console.error(`<- ${res.status}`);
  }

  if (!res.ok) throw await apiError(res);

  const json = await res.json();
  if (verbose) console.error(`<- body: ${JSON.stringify(json).slice(0, 2000)}`);
  return json;
}

export async function monzoPost(
  path: string,
  body: Record<string, string>,
  contentType = "application/x-www-form-urlencoded"
): Promise<any> {
  const session = await getValidSession();
  const url = `${API_URL}${path}`;

  const encoded = new URLSearchParams(body).toString();

  if (verbose) console.error(`-> POST ${url}`);
  let res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": contentType,
    },
    body: encoded,
  });
  if (verbose) console.error(`<- ${res.status}`);

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    if (verbose) console.error(`-> POST ${url} (rate-limit retry)`);
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": contentType,
      },
      body: encoded,
    });
    if (verbose) console.error(`<- ${res.status}`);
  }

  if (!res.ok) throw await apiError(res);

  return res.json();
}

export async function monzoPut(
  path: string,
  formParams: Record<string, string>
): Promise<any> {
  const session = await getValidSession();
  const url = `${API_URL}${path}`;
  const body = new URLSearchParams(formParams).toString();

  if (verbose) console.error(`-> PUT ${url}`);
  let res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (verbose) console.error(`<- ${res.status}`);

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    if (verbose) console.error(`-> PUT ${url} (rate-limit retry)`);
    res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (verbose) console.error(`<- ${res.status}`);
  }

  if (!res.ok) throw await apiError(res);

  return res.json();
}
