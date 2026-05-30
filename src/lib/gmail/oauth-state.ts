import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { GmailOAuthState } from "@/types/gmail";

function signingKey(): string {
  return (
    process.env.TOKEN_ENCRYPTION_KEY ??
    process.env.CRON_SECRET ??
    "inboxflow-dev-signing-key"
  );
}

export function createOAuthState(
  organizationId: string,
  userId: string
): string {
  const payload: GmailOAuthState = {
    organizationId,
    userId,
    nonce: randomBytes(16).toString("hex"),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signingKey())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function parseOAuthState(token: string): GmailOAuthState | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = createHmac("sha256", signingKey())
    .update(data)
    .digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as GmailOAuthState;
  } catch {
    return null;
  }
}
