import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

/** True when InboxFlow code was pushed to this Apps Script project. */
export async function boundScriptHasInboxFlowCode(
  auth: OAuth2Client,
  scriptId: string
): Promise<boolean> {
  try {
    const api = google.script({ version: "v1", auth });
    const content = await api.projects.getContent({ scriptId });
    const code =
      content.data.files?.find((f) => f.name === "Code")?.source ?? "";
    return code.includes("INBOXFLOW_CONFIG");
  } catch {
    return false;
  }
}
