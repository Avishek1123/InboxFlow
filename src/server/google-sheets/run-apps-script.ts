import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

export type AppsScriptRunTarget = {
  /** Apps Script project id (Project settings → Script ID). */
  scriptId: string;
  /** API executable deployment id — required when devMode is false. */
  deploymentId?: string | null;
};

export type ScriptRunResult = {
  ok: boolean;
  response?: unknown;
  errorMessage?: string;
  needsAuthorization?: boolean;
  /** Google returns 404 until a new script project propagates (retry helps). */
  isNotFound?: boolean;
};

type ScriptExecutionErrorBody = {
  message?: string;
  code?: number;
  details?: Record<string, unknown>[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detailMessages(details: Record<string, unknown>[] | undefined): string {
  if (!details?.length) return "";
  return details
    .map((d) => (typeof d.errorMessage === "string" ? d.errorMessage : ""))
    .filter(Boolean)
    .join(" ");
}

function isAppsScriptNotFoundMessage(message: string, code?: number): boolean {
  return (
    code === 404 ||
    message.toLowerCase().includes("not found") ||
    message.includes("NOT_FOUND") ||
    message.includes("Requested entity was not found")
  );
}

/** OAuth client GCP ≠ script GCP (common with API-created bound projects). */
export function isAppsScriptGcpMismatch(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("cloud platform project") ||
    lower.includes("cloud project") ||
    lower.includes("does not have permission") ||
    lower.includes("permission_denied") ||
    (lower.includes("caller") && lower.includes("permission"))
  );
}

/** Script scopes not yet granted for API execution (not the same as GCP mismatch). */
export function isAppsScriptAuthRequired(message: string): boolean {
  if (isAppsScriptGcpMismatch(message)) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("authorization is required") ||
    lower.includes("access not granted") ||
    lower.includes("oauthscope")
  );
}

function parseScriptExecutionResponse(data: {
  error?: ScriptExecutionErrorBody;
  response?: { result?: unknown };
}): ScriptRunResult {
  const err = data.error;
  if (!err) {
    return { ok: true, response: data.response?.result };
  }

  const message = [err.message, detailMessages(err.details)]
    .filter(Boolean)
    .join(" — ");
  const needsAuthorization = isAppsScriptAuthRequired(message);
  const isNotFound = isAppsScriptNotFoundMessage(message, err.code);

  return { ok: false, errorMessage: message, needsAuthorization, isNotFound };
}

function parseScriptRunException(err: unknown): ScriptRunResult {
  const o = err as {
    message?: string;
    code?: number;
    cause?: { message?: string; code?: number };
  };
  const msg = [o.message, o.cause?.message].filter(Boolean).join(" — ");
  const code = o.code ?? o.cause?.code;
  const isNotFound = isAppsScriptNotFoundMessage(msg, code);

  return {
    ok: false,
    errorMessage: msg || "Apps Script execution failed",
    needsAuthorization: isAppsScriptAuthRequired(msg),
    isNotFound,
  };
}

/** Path id for scripts.run: deployment id when devMode is false, else project script id. */
export function resolveScriptsRunId(
  target: AppsScriptRunTarget,
  devMode: boolean
): string {
  if (devMode) return target.scriptId;
  return target.deploymentId ?? target.scriptId;
}

/** Executes a function in the user's bound Apps Script project. */
export async function runAppsScriptFunction(
  auth: OAuth2Client,
  target: AppsScriptRunTarget,
  functionName: string,
  options?: { devMode?: boolean }
): Promise<ScriptRunResult> {
  const devMode = options?.devMode ?? true;
  const runId = resolveScriptsRunId(target, devMode);
  const script = google.script({ version: "v1", auth });
  try {
    const res = await script.scripts.run({
      scriptId: runId,
      requestBody: {
        function: functionName,
        devMode,
      },
    });

    return parseScriptExecutionResponse(
      res.data as { error?: ScriptExecutionErrorBody; response?: { result?: unknown } }
    );
  } catch (err) {
    return parseScriptRunException(err);
  }
}

/** Pause after updateContent — scripts.run often 404s until Google propagates the project. */
export const APPS_SCRIPT_PROPAGATION_DELAY_MS = 2000;

export async function runAppsScriptFunctionWithRetry(
  auth: OAuth2Client,
  target: AppsScriptRunTarget,
  functionName: string,
  options?: {
    devMode?: boolean;
    maxAttempts?: number;
    initialDelayMs?: number;
  }
): Promise<ScriptRunResult> {
  const maxAttempts = options?.maxAttempts ?? 6;
  let last: ScriptRunResult = { ok: false, errorMessage: "Apps Script run failed" };

  if (options?.initialDelayMs && options.initialDelayMs > 0) {
    await sleep(options.initialDelayMs);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await runAppsScriptFunction(auth, target, functionName, {
      devMode: options?.devMode,
    });
    if (last.ok) return last;
    if (last.needsAuthorization) return last;
    if (!last.isNotFound) return last;
    await sleep(1500 * (attempt + 1));
  }

  return last;
}
