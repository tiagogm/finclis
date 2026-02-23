// src/sca.ts
import { BASE_URL } from "./auth.js";

/**
 * Check if a response is an SCA challenge (403 with x-2fa-approval header).
 */
export function isScaChallenge(res: Response): string | null {
  if (res.status === 403) {
    return res.headers.get("x-2fa-approval");
  }
  return null;
}

/**
 * Trigger an SCA challenge and wait for device approval.
 */
export async function handleScaChallenge(
  ott: string,
  token: string
): Promise<void> {
  // Trigger the SCA challenge
  const triggerRes = await fetch(
    `${BASE_URL}/v1/one-time-token/password/trigger`,
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

  console.log("SCA required — approve on your Wise app...");

  // Poll for approval
  const maxAttempts = 60; // 2 minutes at 2s intervals
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const checkRes = await fetch(
      `${BASE_URL}/v1/one-time-token/password/verify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ oneTimeToken: ott }),
      }
    );

    if (checkRes.ok) {
      console.log("SCA approved.");
      return;
    }

    // If still pending, continue polling
    if (checkRes.status === 403) continue;

    // Unexpected status
    throw new Error(`SCA verify unexpected status: ${checkRes.status}`);
  }

  throw new Error("SCA approval timed out");
}
