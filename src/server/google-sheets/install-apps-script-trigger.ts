import type { OAuth2Client } from "google-auth-library";
import {
  APPS_SCRIPT_PROPAGATION_DELAY_MS,
  type AppsScriptRunTarget,
  isAppsScriptGcpMismatch,
  runAppsScriptFunction,
  runAppsScriptFunctionWithRetry,
} from "@/server/google-sheets/run-apps-script";
import { ensureExecutionApiDeployment } from "@/server/google-sheets/ensure-script-deployment";

const PRIME_FN = "primeInboxFlowAuthorization";
const SETUP_FN = "setupInboxFlowAutomationFromApi";
const COUNT_FN = "inboxFlowTriggerCount";

export type InstallAppsScriptTriggerResult = {
  installed: boolean;
  triggerCount: number;
  reason?: "ok" | "authorization" | "not_found" | "gcp_project" | "error";
  errorMessage?: string;
};

export type InstallAppsScriptTriggerOptions = {
  /** Just created script project — shorter waits, single pass. */
  fresh?: boolean;
  /** Skip creating a new version/deployment (reuse existing API executable). */
  skipDeploy?: boolean;
  /** After OAuth / polling — modest extra wait. */
  warmup?: boolean;
  /** Recreate API executable deployment (use after linking GCP in script settings). */
  forceRedeploy?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function classifyRunFailure(
  errorMessage: string,
  needsAuthorization?: boolean
): InstallAppsScriptTriggerResult {
  if (isAppsScriptGcpMismatch(errorMessage)) {
    return {
      installed: false,
      triggerCount: 0,
      reason: "gcp_project",
      errorMessage,
    };
  }
  if (needsAuthorization) {
    return {
      installed: false,
      triggerCount: 0,
      reason: "authorization",
      errorMessage,
    };
  }
  if (isAppsScriptNotFound(errorMessage)) {
    return {
      installed: false,
      triggerCount: 0,
      reason: "not_found",
      errorMessage,
    };
  }
  return {
    installed: false,
    triggerCount: 0,
    reason: "error",
    errorMessage: errorMessage || "Apps Script setup failed",
  };
}

function isAppsScriptNotFound(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("not_found") ||
    lower.includes("requested entity was not found")
  );
}

async function readTriggerCount(
  auth: OAuth2Client,
  target: AppsScriptRunTarget,
  devMode: boolean
): Promise<number> {
  const res = await runAppsScriptFunction(auth, target, COUNT_FN, { devMode });
  if (!res.ok) return 0;
  const n = Number(res.response);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function tryInstallPass(
  auth: OAuth2Client,
  target: AppsScriptRunTarget,
  devMode: boolean,
  opts: { maxAttempts: number; initialDelayMs: number }
): Promise<InstallAppsScriptTriggerResult> {
  if (devMode === false && !target.deploymentId) {
    return {
      installed: false,
      triggerCount: 0,
      reason: "error",
      errorMessage: "No API executable deployment id",
    };
  }

  // Install trigger first (ScriptApp only). UrlFetch prime runs after sync, not here.
  const setup = await runAppsScriptFunctionWithRetry(auth, target, SETUP_FN, {
    devMode,
    maxAttempts: opts.maxAttempts,
    initialDelayMs: opts.initialDelayMs,
  });

  if (setup.ok) {
    const count = await readTriggerCount(auth, target, devMode);
    if (count > 0) {
      return { installed: true, triggerCount: count, reason: "ok" };
    }
    return {
      installed: false,
      triggerCount: 0,
      reason: "error",
      errorMessage: "Setup ran but no time trigger was created",
    };
  }

  return classifyRunFailure(setup.errorMessage ?? "", setup.needsAuthorization);
}

/** Install time trigger via Apps Script API only (no spreadsheet UI). */
export async function installAppsScriptTimeTrigger(
  auth: OAuth2Client,
  scriptId: string,
  options?: InstallAppsScriptTriggerOptions
): Promise<InstallAppsScriptTriggerResult> {
  const fresh = options?.fresh ?? false;

  const deployment = await ensureExecutionApiDeployment(auth, scriptId, {
    forceNew: options?.forceRedeploy ?? !options?.skipDeploy,
  });
  if (!options?.skipDeploy) {
    await sleep(fresh ? 800 : 2000);
  }

  const target: AppsScriptRunTarget = {
    scriptId,
    deploymentId: deployment.deploymentId,
  };

  const initialDelayMs = fresh
    ? 1200
    : options?.warmup
      ? 2500
      : APPS_SCRIPT_PROPAGATION_DELAY_MS;
  const maxAttempts = fresh ? 4 : options?.warmup ? 3 : 4;

  let result: InstallAppsScriptTriggerResult = {
    installed: false,
    triggerCount: 0,
    reason: "error",
    errorMessage: "No deployment",
  };

  if (target.deploymentId) {
    result = await tryInstallPass(auth, target, false, {
      maxAttempts,
      initialDelayMs,
    });
    if (
      result.installed ||
      result.reason === "authorization" ||
      result.reason === "gcp_project"
    ) {
      return result;
    }
  }

  result = await tryInstallPass(auth, target, true, {
    maxAttempts: 3,
    initialDelayMs: 1500,
  });

  if (
    result.installed ||
    result.reason === "authorization" ||
    result.reason === "gcp_project"
  ) {
    return result;
  }

  if (target.deploymentId) {
    const count = await readTriggerCount(auth, target, false);
    if (count > 0) {
      return { installed: true, triggerCount: count, reason: "ok" };
    }
  }
  const countDev = await readTriggerCount(auth, target, true);
  if (countDev > 0) {
    return { installed: true, triggerCount: countDev, reason: "ok" };
  }

  return result;
}

/** Read how many syncInboxFlowData time triggers exist (no install). */
export async function readAppsScriptTriggerCount(
  auth: OAuth2Client,
  scriptId: string
): Promise<{ count: number; error?: string }> {
  const deployment = await ensureExecutionApiDeployment(auth, scriptId);
  const target: AppsScriptRunTarget = {
    scriptId,
    deploymentId: deployment.deploymentId,
  };

  for (const devMode of [false, true] as const) {
    if (devMode === false && !target.deploymentId) continue;
    const res = await runAppsScriptFunction(auth, target, COUNT_FN, { devMode });
    if (res.ok) {
      const n = Number(res.response);
      return {
        count: Number.isFinite(n) && n >= 0 ? n : 0,
      };
    }
    if (isAppsScriptGcpMismatch(res.errorMessage ?? "")) {
      return { count: 0, error: "gcp_link_required" };
    }
  }

  return { count: 0, error: "trigger_check_failed" };
}

/** Optional: authorize UrlFetch + spreadsheet scopes (not required to create the timer). */
export async function primeAppsScriptAuthorization(
  auth: OAuth2Client,
  target: AppsScriptRunTarget,
  devMode = true
): Promise<void> {
  await runAppsScriptFunctionWithRetry(auth, target, PRIME_FN, {
    devMode,
    maxAttempts: 2,
    initialDelayMs: 0,
  });
}
