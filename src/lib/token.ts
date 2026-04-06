import crypto from "crypto";

/** Generates a cryptographically secure 256-bit random token (64 hex chars). */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** SHA-256 hash of a raw token — this is what gets stored in the database. */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Returns a Date that is `hours` from now. */
export function makeExpiry(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
