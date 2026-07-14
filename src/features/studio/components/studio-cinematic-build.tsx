"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GmailIcon } from "@/components/icons/gmail-icon";

export type CinematicStage =
  | "prompt"
  | "permissions"
  | "data"
  | "sheet"
  | "autosync"
  | "ready";

export type CinematicTask = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "blocked" | "failed";
  detail?: string;
};

const STAGE_COPY: Record<CinematicStage, { headline: string; sub: string }> = {
  prompt: {
    headline: "Reading your brief",
    sub: "Designing the product from your prompt",
  },
  permissions: {
    headline: "Securing Google access",
    sub: "Gmail + Sheets — approved once on this website",
  },
  data: {
    headline: "Collecting starred mail",
    sub: "Pulling messages and extracting fields with AI",
  },
  sheet: {
    headline: "Creating your Google Sheet",
    sub: "Writing columns, rows, and the Apps Script project",
  },
  autosync: {
    headline: "Arming the 1‑minute sync",
    sub: "Installing the Google timer — no sheet menu required",
  },
  ready: {
    headline: "Product is live",
    sub: "Your sheet updates itself every minute",
  },
};

const STAGE_ORDER: CinematicStage[] = [
  "prompt",
  "permissions",
  "data",
  "sheet",
  "autosync",
  "ready",
];

function SheetsIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#0F9D58"
        d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
      />
      <path fill="#87CEAC" d="M14 2.25V8h5.75L14 2.25z" />
      <path
        fill="#fff"
        d="M7.5 11h9v1.4h-9V11zm0 3h9v1.4h-9V14zm0 3h6v1.4h-6V17z"
      />
    </svg>
  );
}

function AiSparkIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.2 5.2L18.5 9.5 13.2 10.8 12 16l-1.2-5.2L5.5 9.5l5.3-1.3L12 3z"
        fill="url(#studioAiGrad)"
      />
      <path
        d="M18 14l.6 2.4L21 17l-2.4.6L18 20l-.6-2.4L15 17l2.4-.6L18 14z"
        fill="#34d399"
        opacity="0.9"
      />
      <defs>
        <linearGradient id="studioAiGrad" x1="5" y1="3" x2="19" y2="16">
          <stop stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PromptIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="14"
        rx="3"
        stroke="#a1a1aa"
        strokeWidth="1.6"
      />
      <path
        d="M7 9h10M7 12h7"
        stroke="#a1a1aa"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle
        cx="17.5"
        cy="17.5"
        r="3.2"
        fill="#18181b"
        stroke="#34d399"
        strokeWidth="1.4"
      />
      <path
        d="M16.3 17.5h2.4M17.5 16.3v2.4"
        stroke="#34d399"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function resolveCinematicStage(
  tasks: CinematicTask[] | undefined,
  status?: string
): CinematicStage {
  if (status === "ready") return "ready";
  if (status === "awaiting_autosync") return "autosync";

  const focus =
    tasks?.find((t) => t.status === "running" || t.status === "blocked") ??
    [...(tasks ?? [])].reverse().find((t) => t.status === "done");

  switch (focus?.id) {
    case "plan":
      return "prompt";
    case "permissions":
      return "permissions";
    case "create_table":
    case "collect_data":
      return "data";
    case "create_sheet":
      return "sheet";
    case "enable_autosync":
      return "autosync";
    case "activate":
      return "ready";
    default:
      return "prompt";
  }
}

type Gate = {
  title: string;
  subtitle: string;
  actionLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onAction: () => void;
};

type Props = {
  open: boolean;
  stage: CinematicStage;
  promptSnippet?: string;
  tasks?: CinematicTask[];
  progressPercent?: number;
  syncMinutes?: number;
  finishing?: boolean;
  gate?: Gate | null;
  onComplete?: () => void;
};

export function StudioCinematicBuild({
  open,
  stage,
  promptSnippet,
  tasks,
  progressPercent,
  syncMinutes = 1,
  finishing = false,
  gate = null,
  onComplete,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [exit, setExit] = useState(false);
  const [pulse, setPulse] = useState(0);

  const copy = STAGE_COPY[stage] ?? STAGE_COPY.prompt;
  const stageIndex = Math.max(0, STAGE_ORDER.indexOf(stage));
  const progress = finishing
    ? 100
    : typeof progressPercent === "number"
      ? Math.min(96, Math.max(6, progressPercent))
      : Math.min(92, ((stageIndex + 0.55) / (STAGE_ORDER.length - 1)) * 100);

  const liveLink = finishing
    ? 3
    : stage === "prompt"
      ? 0
      : stage === "permissions" || stage === "data"
        ? 1
        : 2;

  const nodesLit = {
    prompt: finishing || stageIndex >= 0,
    gmail: finishing || stageIndex >= 1,
    ai: finishing || stageIndex >= 0,
    sheets: finishing || stageIndex >= 3,
  };

  const snippet = useMemo(() => {
    const raw = (promptSnippet ?? "").trim().replace(/\s+/g, " ");
    if (!raw) return null;
    return raw.length > 72 ? `${raw.slice(0, 72)}…` : raw;
  }, [promptSnippet]);

  const visibleTasks = (tasks ?? []).filter((t) => t.id !== "activate");

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setExit(false);
      return;
    }
    setExit(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || finishing || gate) return;
    const id = window.setInterval(() => setPulse((p) => p + 1), 1100);
    return () => window.clearInterval(id);
  }, [open, finishing, gate]);

  useEffect(() => {
    if (!open || !finishing || gate) return;
    setExit(false);
    const t1 = window.setTimeout(() => setExit(true), 1200);
    const t2 = window.setTimeout(() => onComplete?.(), 1850);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, finishing, gate, onComplete]);

  if (!open && !visible) return null;

  return (
    <div
      className={cn(
        "studio-modal fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6",
        visible && !exit && "studio-modal--in",
        exit && "studio-modal--out"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-build-title"
    >
      <div className="studio-modal__backdrop" aria-hidden />

      <div className="studio-modal__panel relative w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0e11] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
        <div className="studio-modal__shine" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.12), transparent 40%), radial-gradient(circle at 80% 0%, rgba(45,212,191,0.1), transparent 35%)",
          }}
          aria-hidden
        />

        <div className="relative px-6 pb-7 pt-7 sm:px-8 sm:pt-8">
          <div className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.34em] text-white/45">
              InboxFlow · Live build
            </p>
          </div>

          <h2
            id="studio-build-title"
            key={finishing ? "ready" : gate ? "gate" : stage}
            className="studio-modal__title mt-3 text-center text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]"
          >
            {gate
              ? gate.title
              : finishing
                ? "Connected. Product ready."
                : copy.headline}
          </h2>
          <p
            key={`sub-${finishing ? "ready" : gate ? "gate" : stage}`}
            className="studio-modal__sub mt-2 text-center text-sm text-white/55"
          >
            {gate
              ? gate.subtitle
              : finishing
                ? `Sheet will auto-fetch every ${syncMinutes} minute${syncMinutes === 1 ? "" : "s"} in Google.`
                : copy.sub}
          </p>

          <div className="studio-modal__graph relative mx-auto mt-8 h-[168px] w-full max-w-[380px]">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 380 168"
              fill="none"
              aria-hidden
            >
              <path
                d="M70 42 C110 42, 140 84, 190 84"
                className={cn(
                  "studio-modal__wire",
                  (liveLink >= 0 || finishing) && "studio-modal__wire--on"
                )}
              />
              <path
                d="M70 126 C110 126, 140 84, 190 84"
                className={cn(
                  "studio-modal__wire",
                  (liveLink >= 1 || finishing) && "studio-modal__wire--on"
                )}
              />
              <path
                d="M190 84 C240 84, 270 84, 310 84"
                className={cn(
                  "studio-modal__wire",
                  (liveLink >= 2 || finishing) && "studio-modal__wire--on"
                )}
              />

              {!finishing && !gate && liveLink === 0 && (
                <circle r="4" className="studio-modal__packet fill-emerald-300">
                  <animateMotion
                    dur="1.4s"
                    repeatCount="indefinite"
                    path="M70 42 C110 42, 140 84, 190 84"
                  />
                </circle>
              )}
              {!finishing && !gate && liveLink === 1 && (
                <circle r="4" className="studio-modal__packet fill-emerald-300">
                  <animateMotion
                    dur="1.4s"
                    repeatCount="indefinite"
                    path="M70 126 C110 126, 140 84, 190 84"
                  />
                </circle>
              )}
              {!finishing && !gate && liveLink >= 2 && (
                <circle r="4" className="studio-modal__packet fill-emerald-300">
                  <animateMotion
                    dur="1.2s"
                    repeatCount="indefinite"
                    path="M190 84 C240 84, 270 84, 310 84"
                  />
                </circle>
              )}
              {(finishing || gate) && (
                <>
                  <circle r="4.5" className="fill-emerald-300">
                    <animateMotion
                      dur="1.1s"
                      repeatCount="indefinite"
                      path="M70 42 C110 42, 140 84, 190 84"
                    />
                  </circle>
                  <circle r="4.5" className="fill-emerald-300">
                    <animateMotion
                      dur="1.1s"
                      begin="0.2s"
                      repeatCount="indefinite"
                      path="M70 126 C110 126, 140 84, 190 84"
                    />
                  </circle>
                  <circle r="4.5" className="fill-emerald-300">
                    <animateMotion
                      dur="1.1s"
                      begin="0.35s"
                      repeatCount="indefinite"
                      path="M190 84 C240 84, 270 84, 310 84"
                    />
                  </circle>
                </>
              )}
            </svg>

            <NodeBadge
              className="absolute left-2 top-2"
              lit={nodesLit.prompt}
              active={!finishing && !gate && stage === "prompt"}
              label="Prompt"
            >
              <PromptIcon size={26} />
            </NodeBadge>

            <NodeBadge
              className="absolute bottom-1 left-2"
              lit={nodesLit.gmail}
              active={
                !finishing &&
                !gate &&
                (stage === "permissions" || stage === "data")
              }
              label="Gmail"
            >
              <GmailIcon size={26} />
            </NodeBadge>

            <NodeBadge
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              lit={nodesLit.ai}
              active={!finishing && !gate && (stage === "autosync" || stage === "prompt")}
              label="AI"
              hero
            >
              <AiSparkIcon size={30} />
            </NodeBadge>

            <NodeBadge
              className="absolute right-1 top-1/2 -translate-y-1/2"
              lit={nodesLit.sheets}
              active={!finishing && !gate && (stage === "sheet" || stage === "autosync")}
              label="Sheets"
              success={finishing || Boolean(gate)}
            >
              <SheetsIcon size={28} />
            </NodeBadge>
          </div>

          {snippet && !finishing && (
            <p className="mx-auto mt-2 max-w-md truncate rounded-full border border-white/8 bg-white/[0.04] px-4 py-1.5 text-center text-[11px] text-white/45">
              “{snippet}”
            </p>
          )}

          {visibleTasks.length > 0 && !finishing && (
            <ul className="mx-auto mt-5 max-h-[132px] w-full max-w-md space-y-1.5 overflow-hidden">
              {visibleTasks.map((t) => {
                const done = t.status === "done";
                const active =
                  t.status === "running" || t.status === "blocked";
                return (
                  <li
                    key={t.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] transition-all duration-500",
                      done && "text-emerald-200/90",
                      active && "bg-white/[0.06] text-white",
                      !done && !active && "text-white/30"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                        done && "bg-emerald-500 text-white",
                        active && "bg-white/20 text-white",
                        !done && !active && "bg-white/10 text-white/40"
                      )}
                    >
                      {done ? "✓" : active ? "●" : ""}
                    </span>
                    <span className="truncate font-medium">{t.label}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="studio-modal__bar h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/35">
              <span>{Math.round(progress)}%</span>
              <span>Every {syncMinutes} min sync</span>
            </div>
          </div>

          {gate ? (
            <button
              type="button"
              disabled={gate.busy}
              onClick={gate.onAction}
              className="mt-6 w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-semibold text-[#04120c] shadow-[0_12px_40px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {gate.busy ? gate.busyLabel || "Working…" : gate.actionLabel}
            </button>
          ) : (
            <p className="mt-5 text-center text-[11px] text-white/35">
              {finishing
                ? "Opening your finished product…"
                : pulse % 2 === 0
                  ? "Keep this window open"
                  : "Building a complete live product"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function NodeBadge({
  children,
  label,
  className,
  lit,
  active,
  hero,
  success,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  lit?: boolean;
  active?: boolean;
  hero?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={cn(
        "studio-modal__node flex flex-col items-center gap-1.5",
        className
      )}
    >
      <div
        className={cn(
          "studio-modal__node-face flex items-center justify-center rounded-2xl border bg-[#12161b] shadow-lg transition-all duration-500",
          hero ? "h-16 w-16" : "h-14 w-14",
          lit ? "border-white/20 opacity-100" : "border-white/8 opacity-45",
          active && "studio-modal__node-face--pulse border-emerald-400/50",
          success && "border-emerald-400/60 bg-emerald-500/10"
        )}
      >
        {children}
      </div>
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-wider",
          lit ? "text-white/70" : "text-white/30",
          active && "text-emerald-300"
        )}
      >
        {label}
      </span>
    </div>
  );
}
