import { API_URL, loadSession, Session } from "./auth.js";
import { isScaChallenge, handleScaChallenge } from "./sca.js";

let verbose = false;

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

/**
 * Extract a human-readable error message from an API response.
 * Avoids dumping raw response bodies that may contain tokens or PII.
 */
async function apiError(res: Response): Promise<Error> {
  let message = `API error ${res.status}`;
  try {
    const body = await res.json();
    if (body.message) {
      message += `: ${body.message}`;
    } else if (body.error) {
      message += `: ${body.error}`;
    } else if (body.title) {
      message += `: ${body.title}`;
    }
  } catch {
    // Not JSON — just use status code
  }
  return new Error(message);
}

/**
 * Load session or exit with an error.
 */
export function requireSession(): Session {
  const session = loadSession();
  if (!session) {
    process.exit(1);
  }
  return session;
}

/**
 * Get the stored profile ID, or fail.
 */
export function getProfileId(): number {
  return requireSession().profileId;
}

/**
 * Make an authenticated GET request with automatic SCA retry.
 */
export async function wiseGet(path: string): Promise<any> {
  const session = requireSession();

  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.token}`,
  };

  if (verbose) console.error(`-> GET ${url}`);
  let res = await fetch(url, { headers });
  if (verbose) console.error(`<- ${res.status}`);

  const ott = isScaChallenge(res);
  if (ott) {
    if (verbose) console.error(`<- 403 (SCA challenge)`);
    await handleScaChallenge(ott, session.token);
    if (verbose) console.error(`-> GET ${url} (SCA retry)`);
    res = await fetch(url, {
      headers: { ...headers, "x-2fa-approval": ott },
    });
    if (verbose) console.error(`<- ${res.status}`);
  }

  if (!res.ok) {
    throw await apiError(res);
  }

  return res.json();
}

/**
 * Make an authenticated POST request with automatic SCA retry.
 */
export async function wisePost(
  path: string,
  body: any,
  extraHeaders: Record<string, string> = {}
): Promise<any> {
  const session = requireSession();

  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.token}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (verbose) console.error(`-> POST ${url}`);
  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (verbose) console.error(`<- ${res.status}`);

  const ott = isScaChallenge(res);
  if (ott) {
    if (verbose) console.error(`<- 403 (SCA challenge)`);
    await handleScaChallenge(ott, session.token);
    if (verbose) console.error(`-> POST ${url} (SCA retry)`);
    res = await fetch(url, {
      method: "POST",
      headers: { ...headers, "x-2fa-approval": ott },
      body: JSON.stringify(body),
    });
    if (verbose) console.error(`<- ${res.status}`);
  }

  if (!res.ok) {
    throw await apiError(res);
  }

  return res.json();
}

/**
 * Make an authenticated PUT request with automatic SCA retry.
 */
export async function wisePut(path: string): Promise<any> {
  const session = requireSession();

  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.token}`,
  };

  if (verbose) console.error(`-> PUT ${url}`);
  let res = await fetch(url, { method: "PUT", headers });
  if (verbose) console.error(`<- ${res.status}`);

  const ott = isScaChallenge(res);
  if (ott) {
    if (verbose) console.error(`<- 403 (SCA challenge)`);
    await handleScaChallenge(ott, session.token);
    if (verbose) console.error(`-> PUT ${url} (SCA retry)`);
    res = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "x-2fa-approval": ott },
    });
    if (verbose) console.error(`<- ${res.status}`);
  }

  if (!res.ok) {
    throw await apiError(res);
  }

  return res.json();
}
