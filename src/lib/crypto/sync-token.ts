import { createHash, randomBytes } from "crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto/tokens";

export function generateSyncToken() {
  const token = randomBytes(32).toString("base64url");
  const hash = hashSyncToken(token);
  const prefix = token.slice(0, 8);
  return { token, hash, prefix };
}

export function hashSyncToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function encryptSyncToken(token: string): string {
  return encryptSecret(token);
}

export function decryptSyncToken(encrypted: string): string {
  return decryptSecret(encrypted);
}

export function verifySyncToken(token: string, encrypted: string): boolean {
  try {
    const stored = decryptSyncToken(encrypted);
    return stored === token;
  } catch {
    return false;
  }
}
