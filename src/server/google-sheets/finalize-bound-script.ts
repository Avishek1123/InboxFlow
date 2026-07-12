import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import {
  appsScriptUserSettingsMessage,
  isAppsScriptUserSettingsError,
} from "@/lib/gmail/google-api-errors";
import {
  buildAppsScriptManifest,
  buildGoogleAppsScript,
} from "@/lib/sheet-sync/apps-script";
import type { AppsScriptConfig } from "@/lib/sheet-sync/apps-script";
import { installAppsScriptTimeTrigger } from "@/server/google-sheets/install-apps-script-trigger";

export type FinalizeBoundScriptResult = {
  scriptId: string;
  triggerInstalled: boolean;
  setupNote?: string;
};

export async function pushBoundScriptContent(params: {
  auth: OAuth2Client;
  scriptId: string;
  scriptConfig: AppsScriptConfig;
}): Promise<void> {
  const scriptApi = google.script({ version: "v1", auth: params.auth });
  try {
    await scriptApi.projects.updateContent({
      scriptId: params.scriptId,
      requestBody: {
        files: [
          {
            name: "appsscript",
            type: "JSON",
            source: buildAppsScriptManifest(),
          },
          {
            name: "Code",
            type: "SERVER_JS",
            source: buildGoogleAppsScript(params.scriptConfig),
          },
        ],
      },
    });
  } catch (err) {
    if (isAppsScriptUserSettingsError(err)) {
      throw new Error(appsScriptUserSettingsMessage());
    }
    throw err;
  }
}

/**
 * Attach InboxFlow code to a spreadsheet-bound project and install a time trigger.
 */
export async function finalizeBoundScriptProject(params: {
  auth: OAuth2Client;
  spreadsheetId: string;
  scriptConfig: AppsScriptConfig;
}): Promise<FinalizeBoundScriptResult> {
  const scriptApi = google.script({ version: "v1", auth: params.auth });

  const project = await scriptApi.projects.create({
    requestBody: {
      title: "InboxFlow Sync",
      parentId: params.spreadsheetId,
    },
  });

  const scriptId = project.data.scriptId;
  if (!scriptId) {
    throw new Error("Google did not return an Apps Script project id");
  }

  await pushBoundScriptContent({
    auth: params.auth,
    scriptId,
    scriptConfig: params.scriptConfig,
  });

  const setup = await installAppsScriptTimeTrigger(params.auth, scriptId, {
    fresh: true,
    skipDeploy: true,
  });

  if (setup.installed) {
    return { scriptId, triggerInstalled: true };
  }

  return {
    scriptId,
    triggerInstalled: false,
      setupNote:
        "Your sheet has data. Grant Google permissions on this page, then open the sheet once to finish the timer.",
  };
}
