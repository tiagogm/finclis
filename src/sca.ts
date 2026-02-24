import { API_URL, prompt } from "./auth.js";

let scaVerbose = false;

export function setScaVerbose(enabled: boolean): void {
  scaVerbose = enabled;
}

/**
 * Check if a response is an SCA challenge (403 with x-2fa-approval header).
 * Returns the one-time-token (OTT) if present, null otherwise.
 */
export function isScaChallenge(res: Response): string | null {
  if (res.status === 403) {
    const ott = res.headers.get("x-2fa-approval");
    if (scaVerbose) {
      console.error(`SCA headers: x-2fa-approval=${ott}`);
      console.error(`SCA headers: x-2fa-approval-result=${res.headers.get("x-2fa-approval-result")}`);
    }
    return ott;
  }
  return null;
}

/**
 * Handle an SCA challenge:
 * 1. Try password-based OTT
 * 2. If 404, try SMS-based OTT
 * 3. Prompt user and verify
 */
export async function handleScaChallenge(
  ott: string,
  token: string
): Promise<void> {
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Try password trigger first
  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/one-time-token/password/trigger`);
  const triggerRes = await fetch(
    `${API_URL}/v1/one-time-token/password/trigger`,
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ oneTimeToken: ott }),
    }
  );
  if (scaVerbose) console.error(`<- ${triggerRes.status}`);

  if (triggerRes.ok) {
    console.log("SCA required — enter your Wise password.");
    const password = await prompt("Password: ", true);

    if (scaVerbose) console.error(`-> POST ${API_URL}/v1/identity/one-time-token/password/verify`);
    const verifyRes = await fetch(
      `${API_URL}/v1/identity/one-time-token/password/verify`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ oneTimeToken: ott, password }),
      }
    );
    if (scaVerbose) console.error(`<- ${verifyRes.status}`);

    if (!verifyRes.ok) {
      throw new Error(`SCA verification failed (${verifyRes.status}). Check your password.`);
    }
    console.log("SCA verified.");
    return;
  }

  // Password trigger failed — try SMS
  if (scaVerbose) {
    try {
      const body = await triggerRes.json();
      console.error(`<- password trigger body: ${JSON.stringify(body)}`);
    } catch {}
    console.error(`-> POST ${API_URL}/v1/one-time-token/sms/trigger`);
  }

  const smsTriggerRes = await fetch(
    `${API_URL}/v1/one-time-token/sms/trigger`,
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ oneTimeToken: ott }),
    }
  );
  if (scaVerbose) console.error(`<- ${smsTriggerRes.status}`);

  if (smsTriggerRes.ok) {
    console.log("SCA required — check your phone for an SMS code.");
    const code = await prompt("SMS code: ");

    if (scaVerbose) console.error(`-> POST ${API_URL}/v1/identity/one-time-token/sms/verify`);
    const verifyRes = await fetch(
      `${API_URL}/v1/identity/one-time-token/sms/verify`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ oneTimeToken: ott, otp: code }),
      }
    );
    if (scaVerbose) console.error(`<- ${verifyRes.status}`);

    if (!verifyRes.ok) {
      throw new Error(`SCA verification failed (${verifyRes.status}). Check the code.`);
    }
    console.log("SCA verified.");
    return;
  }

  // Both failed
  throw new Error(
    `SCA trigger failed — password (${triggerRes.status}), SMS (${smsTriggerRes.status}). ` +
    `Your token may not support SCA via these methods.`
  );
}
