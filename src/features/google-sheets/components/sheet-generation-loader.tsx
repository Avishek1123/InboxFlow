"use client";

import { useEffect, useState } from "react";
import { INBOXFLOW_GCP_PROJECT_NUMBER } from "@/lib/gmail/inboxflow-gcp";

const STEPS = [
  "Verifying InboxFlow Google Cloud OAuth",
  "Creating your Google Spreadsheet",
  "Writing table data to the sheet",
  "Generating Apps Script (API URL, sync timer, InboxFlow GCP)",
  "Installing auto-sync timer on the spreadsheet",
] as const;

type Props = {
  open: boolean;
  title?: string;
  /** When true, show all steps complete */
  done?: boolean;
  error?: string | null;
  onClose?: () => void;
};

export function SheetGenerationLoader({
  open,
  title = "Generating your Google Sheet",
  done = false,
  error,
  onClose,
}: Props) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!open || done || error) return;
    setActiveStep(0);
    const id = window.setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 4500);
    return () => window.clearInterval(id);
  }, [open, done, error]);

  useEffect(() => {
    if (done && open) setActiveStep(STEPS.length);
  }, [done, open]);

  if (!open) return null;

  const progress = done
    ? 100
    : error
      ? Math.max(8, (activeStep / STEPS.length) * 100)
      : Math.min(95, ((activeStep + 0.6) / STEPS.length) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-gen-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
        <h2 id="sheet-gen-title" className="text-lg font-semibold">
          {error ? "Sheet setup failed" : done ? "Sheet ready" : title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Uses Google Cloud project{" "}
          <strong className="text-foreground">inboxflow-497809</strong> (
          {INBOXFLOW_GCP_PROJECT_NUMBER}) only.
        </p>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              error ? "bg-red-500" : done ? "bg-emerald-500" : "bg-[#0F9D58]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="mt-5 space-y-2.5">
          {STEPS.map((label, i) => {
            const complete = done || i < activeStep;
            const current = !done && !error && i === activeStep;
            return (
              <li
                key={label}
                className={`flex items-start gap-2.5 text-sm ${
                  complete
                    ? "text-emerald-700 dark:text-emerald-300"
                    : current
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    complete
                      ? "bg-emerald-600 text-white"
                      : current
                        ? "border-2 border-[#0F9D58] border-t-transparent animate-spin"
                        : "border border-border bg-muted"
                  }`}
                  aria-hidden
                >
                  {complete ? "✓" : current ? "" : i + 1}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>

        {!done && !error && (
          <p className="mt-4 text-xs text-muted-foreground">
            This usually takes 20–45 seconds. Do not close this tab.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
            {error}
          </p>
        )}

        {(done || error) && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {done ? "Continue" : "Close"}
          </button>
        )}
      </div>
    </div>
  );
}
