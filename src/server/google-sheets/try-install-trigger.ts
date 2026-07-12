import type { OAuth2Client } from "google-auth-library";
import { installAppsScriptTimeTrigger } from "@/server/google-sheets/install-apps-script-trigger";
import { readSheetExportAppsScriptId } from "@/server/repositories/sheet-export-apps-script-id";

/** Install the time-driven trigger via Apps Script API (same OAuth as Gmail connect). */
export async function tryInstallAppsScriptTriggerAfterProvision(params: {
  auth: OAuth2Client;
  exportId: string;
  scriptId: string;
}): Promise<boolean> {
  const scriptId =
    (await readSheetExportAppsScriptId(params.exportId)) ?? params.scriptId;

  const setup = await installAppsScriptTimeTrigger(params.auth, scriptId, {
    skipDeploy: true,
  });

  if (setup.installed) {
    console.info(
      `[sheet-export] Apps Script trigger installed (${setup.triggerCount}) for export ${params.exportId}`
    );
    return true;
  }

  console.info(
    `[sheet-export] Apps Script trigger not installed for export ${params.exportId}:`,
    setup.reason,
    setup.errorMessage ?? ""
  );
  return false;
}
