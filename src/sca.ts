import { API_URL, prompt } from "./auth.js";

let scaVerbose = false;

export function setScaVerbose(enabled: boolean): void {
  scaVerbose = enabled;
}

/**
 * Check if a response is an SCA challenge (403 with x-2fa-approval header).
 * Returns the one-time-token (OTT) if present, null otherwise.
 */
export async function isScaChallenge(res: Response): Promise<string | null> {
  if (res.status === 403) {
    const ott = res.headers.get("x-2fa-approval");
    if (scaVerbose) {
      console.error(`SCA: x-2fa-approval=${ott}`);
      console.error(`SCA: x-2fa-approval-result=${res.headers.get("x-2fa-approval-result")}`);
    }
    // Drain body to release connection
    await res.text().catch(() => {});
    return ott;
  }
  return null;
}

interface Challenge {
  primaryChallenge: { type: string };
  alternatives: { type: string }[];
  required: boolean;
  passed: boolean;
}

/**
 * Handle an SCA challenge using the One Time Token framework:
 * 1. GET /v1/one-time-token/status — discover required challenges
 * 2. Trigger + verify each required challenge
 */
export async function handleScaChallenge(
  ott: string,
  token: string
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "One-Time-Token": ott,
  };

  // Step 1: Get OTT status to discover required challenges
  if (scaVerbose) console.error(`-> GET ${API_URL}/v1/one-time-token/status`);
  const statusRes = await fetch(`${API_URL}/v1/one-time-token/status`, {
    headers,
  });
  if (scaVerbose) console.error(`<- ${statusRes.status}`);

  if (!statusRes.ok) {
    throw new Error(`SCA status check failed (${statusRes.status})`);
  }

  const status = await statusRes.json();
  const challenges: Challenge[] = status.oneTimeTokenProperties?.challenges || [];

  if (scaVerbose) {
    console.error(`SCA challenges: ${JSON.stringify(challenges.map(c => ({
      type: c.primaryChallenge.type,
      required: c.required,
      passed: c.passed,
      alternatives: c.alternatives?.map(a => a.type),
    })))}`);
  }

  // Step 2: Find required, unpassed challenges
  const pending = challenges.filter(c => c.required && !c.passed);
  if (pending.length === 0) {
    if (scaVerbose) console.error("SCA: no pending challenges, OTT should be ready");
    return;
  }

  for (const challenge of pending) {
    const chosen = pickCliChallenge(challenge);
    if (!chosen) {
      const allTypes = [
        challenge.primaryChallenge.type,
        ...(challenge.alternatives?.map(a => a.type) || []),
      ];
      throw new Error(
        `SCA requires one of [${allTypes.join(", ")}] which this CLI doesn't support. ` +
        `Complete the transfer at wise.com instead.`
      );
    }
    await resolveChallenge(chosen, headers);
  }
}

// Challenge types this CLI can handle, in preference order
const CLI_SUPPORTED = ["PASSWORD", "SMS", "WHATSAPP", "VOICE", "PIN"];

/**
 * Pick the best CLI-compatible challenge from primary + alternatives.
 */
function pickCliChallenge(challenge: Challenge): string | null {
  const candidates = [
    challenge.primaryChallenge.type,
    ...(challenge.alternatives?.map(a => a.type) || []),
  ];
  for (const preferred of CLI_SUPPORTED) {
    if (candidates.includes(preferred)) return preferred;
  }
  return null;
}

/**
 * Trigger and verify a single challenge by type.
 */
async function resolveChallenge(
  type: string,
  headers: Record<string, string>
): Promise<void> {
  if (scaVerbose) console.error(`SCA: using ${type} challenge`);
  switch (type) {
    case "PASSWORD":
      return await handlePasswordChallenge(headers);
    case "SMS":
      return await handleSmsChallenge(headers);
    case "WHATSAPP":
      return await handleWhatsappChallenge(headers);
    case "VOICE":
      return await handleVoiceChallenge(headers);
    case "PIN":
      return await handlePinChallenge(headers);
  }
}

async function handlePasswordChallenge(headers: Record<string, string>): Promise<void> {
  // Trigger
  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/one-time-token/password/trigger`);
  const triggerRes = await fetch(`${API_URL}/v1/one-time-token/password/trigger`, {
    method: "POST",
    headers,
  });
  if (scaVerbose) console.error(`<- ${triggerRes.status}`);

  if (!triggerRes.ok) {
    throw new Error(`SCA password trigger failed (${triggerRes.status})`);
  }

  console.log("SCA required — enter your Wise password.");
  const password = await prompt("Password: ", true);

  // Verify
  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/identity/one-time-token/password/verify`);
  const verifyRes = await fetch(`${API_URL}/v1/identity/one-time-token/password/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({ password: password.trim() }),
  });
  if (scaVerbose) console.error(`<- ${verifyRes.status}`);

  if (!verifyRes.ok) {
    throw new Error(`SCA password verification failed (${verifyRes.status}). Check your password.`);
  }
  console.log("SCA verified.");
}

async function handleSmsChallenge(headers: Record<string, string>): Promise<void> {
  // Trigger
  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/one-time-token/sms/trigger`);
  const triggerRes = await fetch(`${API_URL}/v1/one-time-token/sms/trigger`, {
    method: "POST",
    headers,
  });
  if (scaVerbose) console.error(`<- ${triggerRes.status}`);

  if (!triggerRes.ok) {
    throw new Error(`SCA SMS trigger failed (${triggerRes.status})`);
  }

  const triggerBody = await triggerRes.json();
  const phone = triggerBody.obfuscatedPhoneNo || "your phone";
  console.log(`SCA required — SMS code sent to ${phone}`);

  const code = await prompt("SMS code: ");

  // Verify
  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/one-time-token/sms/verify`);
  const verifyRes = await fetch(`${API_URL}/v1/one-time-token/sms/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({ otpCode: code.trim() }),
  });
  if (scaVerbose) console.error(`<- ${verifyRes.status}`);

  if (!verifyRes.ok) {
    throw new Error(`SCA SMS verification failed (${verifyRes.status}). Check the code.`);
  }
  console.log("SCA verified.");
}

async function handleWhatsappChallenge(headers: Record<string, string>): Promise<void> {
  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/one-time-token/whatsapp/trigger`);
  const triggerRes = await fetch(`${API_URL}/v1/one-time-token/whatsapp/trigger`, {
    method: "POST",
    headers,
  });
  if (scaVerbose) console.error(`<- ${triggerRes.status}`);

  if (!triggerRes.ok) {
    throw new Error(`SCA WhatsApp trigger failed (${triggerRes.status})`);
  }

  const triggerBody = await triggerRes.json();
  const phone = triggerBody.obfuscatedPhoneNo || "your phone";
  console.log(`SCA required — WhatsApp code sent to ${phone}`);

  const code = await prompt("WhatsApp code: ");

  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/one-time-token/whatsapp/verify`);
  const verifyRes = await fetch(`${API_URL}/v1/one-time-token/whatsapp/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({ otpCode: code.trim() }),
  });
  if (scaVerbose) console.error(`<- ${verifyRes.status}`);

  if (!verifyRes.ok) {
    throw new Error(`SCA WhatsApp verification failed (${verifyRes.status}).`);
  }
  console.log("SCA verified.");
}

async function handleVoiceChallenge(headers: Record<string, string>): Promise<void> {
  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/one-time-token/voice/trigger`);
  const triggerRes = await fetch(`${API_URL}/v1/one-time-token/voice/trigger`, {
    method: "POST",
    headers,
  });
  if (scaVerbose) console.error(`<- ${triggerRes.status}`);

  if (!triggerRes.ok) {
    throw new Error(`SCA voice trigger failed (${triggerRes.status})`);
  }

  const triggerBody = await triggerRes.json();
  const phone = triggerBody.obfuscatedPhoneNo || "your phone";
  console.log(`SCA required — voice call to ${phone}`);

  const code = await prompt("Voice code: ");

  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/one-time-token/voice/verify`);
  const verifyRes = await fetch(`${API_URL}/v1/one-time-token/voice/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({ otpCode: code.trim() }),
  });
  if (scaVerbose) console.error(`<- ${verifyRes.status}`);

  if (!verifyRes.ok) {
    throw new Error(`SCA voice verification failed (${verifyRes.status}).`);
  }
  console.log("SCA verified.");
}

async function handlePinChallenge(headers: Record<string, string>): Promise<void> {
  console.log("SCA required — enter your Wise PIN.");
  const pin = await prompt("PIN: ", true);

  if (scaVerbose) console.error(`-> POST ${API_URL}/v1/one-time-token/pin/verify`);
  const verifyRes = await fetch(`${API_URL}/v1/one-time-token/pin/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pin: pin.trim() }),
  });
  if (scaVerbose) console.error(`<- ${verifyRes.status}`);

  if (!verifyRes.ok) {
    throw new Error(`SCA PIN verification failed (${verifyRes.status}). Check your PIN.`);
  }
  console.log("SCA verified.");
}
