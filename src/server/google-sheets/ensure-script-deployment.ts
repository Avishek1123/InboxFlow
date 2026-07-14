import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

export type ExecutionApiDeployment = {
  deploymentId: string | null;
  reused: boolean;
};

async function deleteExecutionApiDeployments(
  api: ReturnType<typeof google.script>,
  scriptId: string
): Promise<void> {
  try {
    const list = await api.projects.deployments.list({ scriptId });
    for (const d of list.data.deployments ?? []) {
      const isApi = d.entryPoints?.some(
        (ep) => ep.entryPointType === "EXECUTION_API"
      );
      if (isApi && d.deploymentId) {
        await api.projects.deployments.delete({
          scriptId,
          deploymentId: d.deploymentId,
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[apps-script] delete deployments:", msg);
  }
}

/** Find or create an API executable deployment (required for scripts.run). */
export async function ensureExecutionApiDeployment(
  auth: OAuth2Client,
  scriptId: string,
  options?: { forceNew?: boolean }
): Promise<ExecutionApiDeployment> {
  const api = google.script({ version: "v1", auth });

  if (options?.forceNew) {
    await deleteExecutionApiDeployments(api, scriptId);
  } else {
    try {
      const list = await api.projects.deployments.list({ scriptId });
      for (const d of list.data.deployments ?? []) {
        const hasApi = d.entryPoints?.some(
          (ep) => ep.entryPointType === "EXECUTION_API"
        );
        if (hasApi && d.deploymentId) {
          return { deploymentId: d.deploymentId, reused: true };
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[apps-script] list deployments:", msg);
    }
  }

  const version = await api.projects.versions.create({
    scriptId,
    requestBody: { description: `InboxFlow ${new Date().toISOString()}` },
  });
  const versionNumber = version.data.versionNumber;
  if (!versionNumber) {
    return { deploymentId: null, reused: false };
  }

  try {
    const dep = await api.projects.deployments.create({
      scriptId,
      requestBody: {
        versionNumber,
        manifestFileName: "appsscript",
        description: "InboxFlow API executable",
        entryPoints: [
          {
            entryPointType: "EXECUTION_API",
            executionApi: {
              entryPointConfig: { access: "MYSELF" },
            },
          },
        ],
      } as {
        versionNumber: number;
        manifestFileName: string;
        description: string;
        entryPoints: Array<{
          entryPointType: string;
          executionApi: { entryPointConfig: { access: string } };
        }>;
      },
    });
    return { deploymentId: dep.data.deploymentId ?? null, reused: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[apps-script] EXECUTION_API deployment failed, trying minimal:", msg);
  }

  try {
    const dep = await api.projects.deployments.create({
      scriptId,
      requestBody: {
        versionNumber,
        manifestFileName: "appsscript",
        description: "InboxFlow",
      },
    });
    return { deploymentId: dep.data.deploymentId ?? null, reused: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[apps-script] deployment skipped:", msg);
    return { deploymentId: null, reused: false };
  }
}

/** @deprecated Use ensureExecutionApiDeployment */
export async function ensureHeadDeployment(
  auth: OAuth2Client,
  scriptId: string
): Promise<boolean> {
  const { deploymentId } = await ensureExecutionApiDeployment(auth, scriptId);
  return Boolean(deploymentId);
}

/**
 * Web app deployment — user opens URL once to authorize + install the time trigger
 * (works when scripts.run / GCP project link fails).
 */
export async function ensureWebAppDeployment(
  auth: OAuth2Client,
  scriptId: string,
  options?: { forceNewVersion?: boolean }
): Promise<{ deploymentId: string | null; url: string | null }> {
  const api = google.script({ version: "v1", auth });
  const forceNewVersion = options?.forceNewVersion ?? false;

  let existingDeploymentId: string | null = null;
  let existingUrl: string | null = null;

  try {
    const list = await api.projects.deployments.list({ scriptId });
    for (const d of list.data.deployments ?? []) {
      const web = d.entryPoints?.find((ep) => ep.entryPointType === "WEB_APP");
      const url = web?.webApp?.url;
      if (d.deploymentId && url) {
        existingDeploymentId = d.deploymentId;
        existingUrl = url;
        if (!forceNewVersion) {
          return { deploymentId: d.deploymentId, url };
        }
        break;
      }
    }
  } catch (err) {
    console.warn(
      "[apps-script] list web apps:",
      err instanceof Error ? err.message : err
    );
  }

  try {
    const version = await api.projects.versions.create({
      scriptId,
      requestBody: {
        description: `InboxFlow web auth ${new Date().toISOString()}`,
      },
    });
    const versionNumber = version.data.versionNumber;
    if (!versionNumber) {
      return { deploymentId: existingDeploymentId, url: existingUrl };
    }

    const entryPoints = [
      {
        entryPointType: "WEB_APP",
        webApp: {
          entryPointConfig: {
            access: "MYSELF",
            executeAs: "USER_ACCESSING",
          },
        },
      },
    ] as Array<{
      entryPointType: string;
      webApp: {
        entryPointConfig: { access: string; executeAs: string };
      };
    }>;

    if (existingDeploymentId && forceNewVersion) {
      try {
        const updated = await api.projects.deployments.update({
          scriptId,
          deploymentId: existingDeploymentId,
          requestBody: {
            deploymentConfig: {
              scriptId,
              versionNumber,
              manifestFileName: "appsscript",
              description: "InboxFlow enable auto-sync (web)",
            },
          },
        });
        const url =
          updated.data.entryPoints?.find((ep) => ep.entryPointType === "WEB_APP")
            ?.webApp?.url ??
          existingUrl ??
          `https://script.google.com/macros/s/${existingDeploymentId}/exec`;
        return { deploymentId: existingDeploymentId, url };
      } catch (updateErr) {
        console.warn(
          "[apps-script] web app update:",
          updateErr instanceof Error ? updateErr.message : updateErr
        );
      }
    }

    const dep = await api.projects.deployments.create({
      scriptId,
      requestBody: {
        versionNumber,
        manifestFileName: "appsscript",
        description: "InboxFlow enable auto-sync (web)",
        entryPoints,
      } as {
        versionNumber: number;
        manifestFileName: string;
        description: string;
        entryPoints: typeof entryPoints;
      },
    });

    const deploymentId = dep.data.deploymentId ?? null;
    let url =
      dep.data.entryPoints?.find((ep) => ep.entryPointType === "WEB_APP")?.webApp
        ?.url ?? null;

    if (!url && deploymentId) {
      url = `https://script.google.com/macros/s/${deploymentId}/exec`;
    }

    return { deploymentId, url };
  } catch (err) {
    console.warn(
      "[apps-script] web app deployment:",
      err instanceof Error ? err.message : err
    );
    return { deploymentId: existingDeploymentId, url: existingUrl };
  }
}
