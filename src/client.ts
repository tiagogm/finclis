// src/client.ts
import { BASE_URL, loadSession } from "./auth.js";
import { isScaChallenge, handleScaChallenge } from "./sca.js";

/**
 * Make an authenticated API request with automatic SCA retry.
 */
export async function wiseGet(path: string): Promise<any> {
  const session = loadSession();
  if (!session) {
    console.error("Not logged in. Run: wise login");
    process.exit(1);
  }

  const url = `${BASE_URL}${path}`;
  const headers = { Authorization: `Bearer ${session.token}` };

  let res = await fetch(url, { headers });

  // Handle SCA challenge
  const ott = isScaChallenge(res);
  if (ott) {
    await handleScaChallenge(ott, session.token);
    // Retry the original request with OTT header
    res = await fetch(url, {
      headers: {
        ...headers,
        "x-2fa-approval": ott,
      },
    });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Get the stored profile ID, or fail.
 */
export function getProfileId(): number {
  const session = loadSession();
  if (!session) {
    console.error("Not logged in. Run: wise login");
    process.exit(1);
  }
  return session.profileId;
}
