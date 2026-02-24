import { API_URL, prompt } from "./auth.js";

/**
 * Check if a response is an SCA challenge (403 with x-2fa-approval header).
 * Returns the one-time-token (OTT) if present, null otherwise.
 */
export function isScaChallenge(res: Response): string | null {
  if (res.status === 403) {
    return res.headers.get("x-2fa-approval");
  }
  return null;
}

/**
 * Handle an SCA challenge:
 * 1. Trigger the OTT challenge
 * 2. Prompt user for their password
 * 3. Verify with password
 */
export async function handleScaChallenge(
  ott: string,
  token: string
): Promise<void> {
  // Step 1: Trigger the SCA challenge
  const triggerRes = await fetch(
    `${API_URL}/v1/one-time-token/password/trigger`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ oneTimeToken: ott }),
    }
  );

  if (!triggerRes.ok) {
    throw new Error(`SCA trigger failed (${triggerRes.status})`);
  }

  console.log("SCA required.");

  // Step 2: Ask for password
  const password = await prompt("Password: ", true);

  // Step 3: Verify with password
  const verifyRes = await fetch(
    `${API_URL}/v1/identity/one-time-token/password/verify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ oneTimeToken: ott, password }),
    }
  );

  if (!verifyRes.ok) {
    throw new Error(`SCA verification failed (${verifyRes.status}). Check your password.`);
  }

  console.log("SCA verified.");
}
