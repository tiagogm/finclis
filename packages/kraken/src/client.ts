import { loadSession, API_URL, type KrakenSession } from "./auth.js";

let verbose = false;

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
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

  const secretBytes = Buffer.from(apiSecret, "base64");
  const hmac = new Bun.CryptoHasher("sha512", secretBytes);
  hmac.update(uriPath);
  hmac.update(sha256Hash);
  return hmac.digest("base64");
}

async function requireSession(): Promise<KrakenSession> {
  const session = await loadSession();
  if (!session) {
    process.exit(1);
  }
  return session;
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
  const session = await requireSession();
  const nonce = Date.now().toString();
  const postData = new URLSearchParams({ nonce, ...params }).toString();
  const signature = signRequest(uriPath, nonce, postData, session.apiSecret);

  const url = `${API_URL}${uriPath}`;
  if (verbose) console.error(`-> POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "API-Key": session.apiKey,
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
