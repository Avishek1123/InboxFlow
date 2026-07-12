import { createHash, randomBytes } from "crypto";

export function generateSheetSyncApiKey(): {
  key: string;
  hash: string;
  prefix: string;
} {
  const key = `ifl_${randomBytes(24).toString("base64url")}`;
  const hash = hashSheetSyncApiKey(key);
  const prefix = key.slice(0, 14);
  return { key, hash, prefix };
}

export function hashSheetSyncApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
