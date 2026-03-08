/**
 * Parse a human-readable error message from an API response.
 * Handles field names used across all finclis services:
 *   errors[].message|code (Wise), message, error, code (Trading212), title (Wise)
 */
export async function parseApiError(res: Response, verbose = false): Promise<Error> {
  let message = `API error ${res.status}`;
  try {
    const body = await res.json();
    if (verbose) console.error(`<- body: ${JSON.stringify(body)}`);
    if (body.errors?.length) {
      const msgs = body.errors.map((e: any) => e.message || e.code || JSON.stringify(e));
      message += `: ${msgs.join("; ")}`;
    } else if (body.message) {
      message += `: ${body.message}`;
    } else if (body.error) {
      message += `: ${body.error}`;
    } else if (body.code) {
      message += `: ${body.code}`;
    } else if (body.title) {
      message += `: ${body.title}`;
    }
  } catch {
    // Not JSON — just use status code
  }
  return new Error(message);
}
