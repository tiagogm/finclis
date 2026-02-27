import { wiseGet, requireSession } from "../client.js";
import { DEFAULT_TTL_MS } from "../auth.js";

export async function whoamiCommand(): Promise<void> {
  const session = requireSession();

  try {
    const profiles = await wiseGet("/v2/profiles");
    const personal = profiles.find((p: any) => p.type === "PERSONAL");

    if (!personal) {
      console.log(`Profile ID: ${session.profileId}`);
      console.log("Session is valid.");
      return;
    }

    const name = personal.details
      ? `${personal.details.firstName || ""} ${personal.details.lastName || ""}`.trim()
      : personal.fullName || "Unknown";

    console.log(`Name:       ${name}`);
    console.log(`Profile ID: ${personal.id}`);
    if (personal.details?.dateOfBirth) {
      console.log(`DOB:        ${personal.details.dateOfBirth}`);
    }
    if (personal.details?.phoneNumber) {
      console.log(`Phone:      ${personal.details.phoneNumber}`);
    }

    // Session expiry
    if (session.createdAt) {
      const ttl = session.ttlMs || DEFAULT_TTL_MS;
      const expiresAt = session.createdAt + ttl;
      const remaining = expiresAt - Date.now();
      if (remaining > 0) {
        const secs = Math.floor(remaining / 1000);
        const mins = Math.floor(secs / 60);
        const hours = Math.floor(mins / 60);
        const label = hours > 0 ? `${hours}h ${mins % 60}m` : mins > 0 ? `${mins}m` : `${secs}s`;
        console.log(`Expires in: ${label}`);
      }
    }

    // Show business profiles too
    const business = profiles.filter((p: any) => p.type === "BUSINESS");
    if (business.length > 0) {
      console.log("");
      for (const b of business) {
        const bName = b.details?.name || b.fullName || "Unknown";
        console.log(`Business:   ${bName} (${b.id})`);
      }
    }
  } catch (err: any) {
    if (err.message.includes("401")) {
      console.error("Session expired. Run: wise login");
      process.exit(0);
    }
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
