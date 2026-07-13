"use client";

import { cn } from "@/lib/utils";

export type AnimatedTask = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "blocked" | "failed";
  detail?: string;
};

type Props = {
  tasks: AnimatedTask[];
  progressPercent?: number;
  className?: string;
};

export function StudioTaskProgress({
  tasks,
  progressPercent,
  className,
}: Props) {
  const done = tasks.filter((t) => t.status === "done").length;
  const total = Math.max(1, tasks.length);
  const percent =
    progressPercent ?? Math.round((done / total) * 100);
  const running = tasks.find((t) => t.status === "running");
  const blocked = tasks.find((t) => t.status === "blocked");

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-muted-foreground">
            {blocked
              ? "Waiting for permission"
              : running
                ? running.label
                : done === total
                  ? "All tasks complete"
                  : "Building product"}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {done}/{total} · {percent}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              blocked
                ? "bg-amber-500"
                : "bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400"
            )}
            style={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
          />
        </div>
      </div>

      <ol className="space-y-2">
        {tasks.map((t, i) => {
          const isDone = t.status === "done";
          const isRunning = t.status === "running";
          const isBlocked = t.status === "blocked";
          const isFailed = t.status === "failed";
          return (
            <li
              key={t.id}
              style={{
                animationDelay: `${Math.min(i, 8) * 55}ms`,
              }}
              className={cn(
                "studio-task-row flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-500",
                isDone && "border-emerald-500/40 bg-emerald-500/5",
                isRunning && "border-blue-500/45 bg-blue-500/5 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]",
                isBlocked && "border-amber-500/45 bg-amber-500/5",
                isFailed && "border-red-500/40 bg-red-500/5",
                t.status === "pending" && "border-border/80 opacity-70"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  isDone && "bg-emerald-500 text-white",
                  isRunning && "bg-blue-500 text-white",
                  isBlocked && "bg-amber-500 text-white",
                  isFailed && "bg-red-500 text-white",
                  t.status === "pending" &&
                    "bg-muted text-muted-foreground"
                )}
                aria-hidden
              >
                {isDone ? (
                  <CheckIcon />
                ) : isRunning ? (
                  <SpinnerIcon />
                ) : isBlocked ? (
                  "!"
                ) : isFailed ? (
                  "×"
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-medium leading-snug",
                    isDone && "text-emerald-800 dark:text-emerald-200",
                    isRunning && "text-blue-800 dark:text-blue-200",
                    isBlocked && "text-amber-900 dark:text-amber-200"
                  )}
                >
                  {t.label}
                </p>
                {t.detail && (
                  <p
                    className={cn(
                      "mt-0.5 text-xs break-all transition-opacity duration-300",
                      isRunning || isBlocked
                        ? "text-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {t.detail}
                  </p>
                )}
                {isRunning && !t.detail && (
                  <p className="mt-0.5 text-xs text-blue-600/80 dark:text-blue-300/80">
                    Working…
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2L4.8 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="animate-spin"
    >
      <circle
        cx="6"
        cy="6"
        r="4.25"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.6"
      />
      <path
        d="M10.25 6A4.25 4.25 0 0 0 6 1.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
