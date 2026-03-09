import { loadCredentials, prompt, API_URL, type KrakenCredentials } from "./auth.js";

const SECRETS_SERVICE = "com.kraken-cli";
const SECRETS_OTP_NAME = "otp";

let verbose = false;
let cachedOtp: string | undefined;

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

export function setOtp(value: string): void {
  cachedOtp = value;
}

async function loadOtpFromSecrets(): Promise<string | undefined> {
  try {
    return (await Bun.secrets.get({ service: SECRETS_SERVICE, name: SECRETS_OTP_NAME })) ?? undefined;
  } catch {
    return undefined;
  }
}

async function saveOtpToSecrets(otp: string): Promise<void> {
  await Bun.secrets.set({ service: SECRETS_SERVICE, name: SECRETS_OTP_NAME, value: otp });
}

async function clearOtpCache(): Promise<void> {
  cachedOtp = undefined;
  try {
    await Bun.secrets.delete({ service: SECRETS_SERVICE, name: SECRETS_OTP_NAME });
  } catch {
    // ignore
  }
}

async function resolveOtp(credentials: KrakenCredentials): Promise<string | undefined> {
  if (!credentials.twoFactor) return undefined;
  if (process.env.KRAKEN_OTP) return process.env.KRAKEN_OTP;
  if (cachedOtp) return cachedOtp;
  const fromSecrets = await loadOtpFromSecrets();
  if (fromSecrets) { cachedOtp = fromSecrets; return fromSecrets; }
  const entered = (await prompt("2FA code: ")).trim();
  cachedOtp = entered;
  await saveOtpToSecrets(entered);
  return entered;
}

/**
 * Compute Kraken HMAC-SHA512 request signature.
 * Algorithm: base64( HMAC-SHA512(uriPath + SHA256(nonce + postData), base64Decode(apiSecret)) )
 */
export function signRequest(
  uriPath: string,
  nonce: string,
  postData: string,
  apiSecret: string,
): string {
  const sha256 = new Bun.CryptoHasher("sha256");
  sha256.update(nonce + postData);
  const sha256Hash = sha256.digest(); // Uint8Array

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(apiSecret, "base64");
    if (secretBytes.length === 0) throw new Error("empty");
  } catch {
    throw new Error("Stored API secret is not valid base64. Run 'kraken auth set' to re-enter credentials.");
  }
  const hmac = new Bun.CryptoHasher("sha512", secretBytes);
  hmac.update(uriPath);
  hmac.update(sha256Hash);
  return hmac.digest("base64");
}

async function requireCredentials(): Promise<KrakenCredentials> {
  const credentials = await loadCredentials();
  if (!credentials) {
    process.exit(1);
  }
  return credentials;
}

function parseKrakenError(body: any): string | null {
  if (!body || !Array.isArray(body.error) || body.error.length === 0) return null;
  const msg = body.error[0] as string;
  if (msg.includes("EAPI:Invalid nonce")) {
    return "Nonce out of order — wait a moment and retry";
  }
  return body.error.join("; ");
}

/**
 * POST to a Kraken private endpoint (requires API key + signature).
 */
export async function krakenPrivatePost(
  uriPath: string,
  params: Record<string, string> = {},
): Promise<any> {
  const credentials = await requireCredentials();

  const doRequest = async (): Promise<any> => {
    const otp = await resolveOtp(credentials);
    const nonce = Date.now().toString();
    const allParams = otp ? { nonce, otp, ...params } : { nonce, ...params };
    const postData = new URLSearchParams(allParams).toString();
    const signature = signRequest(uriPath, nonce, postData, credentials.apiSecret);

    const url = `${API_URL}${uriPath}`;
    if (verbose) console.error(`-> POST ${url}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "API-Key": credentials.apiKey,
        "API-Sign": signature,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: postData,
    });

    if (verbose) console.error(`<- ${res.status}`);

    const json = await res.json();
    if (verbose) console.error(`<- body: ${JSON.stringify(json).slice(0, 2000)}`);

    const err = parseKrakenError(json);
    if (err) throw new Error(err);

    return json.result;
  };

  try {
    return await doRequest();
  } catch (e: any) {
    if (credentials.twoFactor && e.message?.includes("Invalid signature")) {
      await clearOtpCache();
      return await doRequest();
    }
    throw e;
  }
}

/**
 * GET a Kraken public endpoint (no auth required).
 */
export async function krakenPublicGet(
  uriPath: string,
  params: Record<string, string> = {},
): Promise<any> {
  const query = new URLSearchParams(params).toString();
  const url = `${API_URL}${uriPath}${query ? `?${query}` : ""}`;

  if (verbose) console.error(`-> GET ${url}`);
  const res = await fetch(url);
  if (verbose) console.error(`<- ${res.status}`);

  if (!res.ok) throw new Error(`API error ${res.status}`);

  const json = await res.json();
  if (verbose) console.error(`<- body: ${JSON.stringify(json).slice(0, 2000)}`);

  const err = parseKrakenError(json);
  if (err) throw new Error(err);

  return json.result;
}
