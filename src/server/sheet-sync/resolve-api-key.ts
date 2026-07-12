import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import {
  generateSheetSyncApiKey,
  hashSheetSyncApiKey,
} from "@/lib/sheet-sync/api-key";

export function extractApiKeyFromAppsScriptSource(
  source: string
): string | null {
  const match = source.match(/API_KEY:\s*'([^']+)'/);
  return match?.[1]?.trim() ?? null;
}

export async function readBoundScriptApiKey(
  auth: OAuth2Client,
  scriptId: string
): Promise<string | null> {
  const scriptApi = google.script({ version: "v1", auth });
  const content = await scriptApi.projects.getContent({ scriptId });
  const code = content.data.files?.find((f) => f.name === "Code")?.source;
  if (!code) return null;
  return extractApiKeyFromAppsScriptSource(code);
}

/**
 * Keep the key already embedded in the sheet script when possible so
 * "Update script" (URL-only changes) does not invalidate the timer.
 */
export async function resolveSheetSyncApiKey(params: {
  auth: OAuth2Client;
  scriptId: string;
  storedHash?: string | null;
  rotate?: boolean;
}): Promise<{ key: string; hash: string; prefix: string; rotated: boolean }> {
  if (!params.rotate) {
    const fromScript = await readBoundScriptApiKey(
      params.auth,
      params.scriptId
    );
    if (fromScript?.startsWith("ifl_")) {
      const hash = hashSheetSyncApiKey(fromScript);
      return {
        key: fromScript,
        hash,
        prefix: fromScript.slice(0, 14),
        rotated: params.storedHash !== hash,
      };
    }
  }

  const { key, hash, prefix } = generateSheetSyncApiKey();
  return { key, hash, prefix, rotated: true };
}
