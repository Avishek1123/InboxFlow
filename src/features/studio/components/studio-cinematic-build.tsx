"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GmailIcon } from "@/components/icons/gmail-icon";

type StageKey = "prompt" | "permissions" | "sheet" | "autosync" | "ready";

const STAGE_COPY: Record<StageKey, { headline: string; sub: string }> = {
  prompt: {
    headline: "Understanding your prompt",
    sub: "InboxFlow is drafting the workflow graph",
  },
  permissions: {
    headline: "Connecting accounts",
    sub: "Linking Gmail and Google Sheets securely",
  },
  sheet: {
    headline: "Creating your sheet",
    sub: "Building columns and writing the first rows",
  },
  autosync: {
    headline: "Connecting the live path",
    sub: "Wiring mail → AI extract → spreadsheet",
  },
  ready: {
    headline: "Product ready",
    sub: "Your automation is live",
  },
};

const STAGE_ORDER: StageKey[] = [
  "prompt",
  "permissions",
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
      <path fill="#fff" d="M7.5 11h9v1.4h-9V11zm0 3h9v1.4h-9V14zm0 3h6v1.4h-6V17z" />
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
      <rect x="3" y="4" width="18" height="14" rx="3" stroke="#a1a1aa" strokeWidth="1.6" />
      <path
        d="M7 9h10M7 12h7"
        stroke="#a1a1aa"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17.5" cy="17.5" r="3.2" fill="#18181b" stroke="#34d399" strokeWidth="1.4" />
      <path
        d="M16.3 17.5h2.4M17.5 16.3v2.4"
        stroke="#34d399"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  open: boolean;
  stage: StageKey;
  promptSnippet?: string;
  finishing?: boolean;
  onComplete?: () => void;
};

export function StudioCinematicBuild({
  open,
  stage,
  promptSnippet,
  finishing = false,
  onComplete,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [exit, setExit] = useState(false);
  const [packet, setPacket] = useState(0);

  const copy = STAGE_COPY[stage] ?? STAGE_COPY.prompt;
  const stageIndex = Math.max(0, STAGE_ORDER.indexOf(stage));
  const progress = finishing
    ? 100
    : Math.min(92, ((stageIndex + 0.55) / (STAGE_ORDER.length - 1)) * 100);

  /** Which connection segment is live: 0 prompt→ai, 1 gmail→ai, 2 ai→sheets */
  const liveLink = finishing
    ? 3
    : stage === "prompt"
      ? 0
      : stage === "permissions"
        ? 1
        : stage === "sheet"
          ? 2
          : 2;

  const nodesLit = {
    prompt: finishing || stageIndex >= 0,
    gmail: finishing || stageIndex >= 1,
    ai: finishing || stageIndex >= 0,
    sheets: finishing || stageIndex >= 2,
  };

  const snippet = useMemo(() => {
    const raw = (promptSnippet ?? "").trim().replace(/\s+/g, " ");
    if (!raw) return null;
    return raw.length > 64 ? `${raw.slice(0, 64)}…` : raw;
  }, [promptSnippet]);

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
    if (!open || finishing) return;
    const id = window.setInterval(() => setPacket((p) => p + 1), 900);
    return () => window.clearInterval(id);
  }, [open, finishing]);

  useEffect(() => {
    if (!open || !finishing) return;
    setExit(false);
    const t1 = window.setTimeout(() => setExit(true), 1100);
    const t2 = window.setTimeout(() => onComplete?.(), 1700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, finishing, onComplete]);

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

      <div className="studio-modal__panel relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0c0f12] shadow-[0_40px_100px_rgba(0,0,0,0.55)]">
        <div className="studio-modal__shine" aria-hidden />

        <div className="relative px-6 pb-6 pt-7 sm:px-8 sm:pt-8">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">
            InboxFlow · Building
          </p>

          <h2
            id="studio-build-title"
            key={finishing ? "ready" : stage}
            className="studio-modal__title mt-3 text-center text-2xl font-semibold tracking-tight text-white sm:text-[1.7rem]"
          >
            {finishing ? "Connected. Product ready." : copy.headline}
          </h2>
          <p
            key={`sub-${finishing ? "ready" : stage}`}
            className="studio-modal__sub mt-2 text-center text-sm text-white/55"
          >
            {finishing
              ? "Opening your sheet and workflow…"
              : copy.sub}
          </p>

          {/* Connection graph */}
          <div className="studio-modal__graph relative mx-auto mt-8 h-[168px] w-full max-w-[380px]">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 380 168"
              fill="none"
              aria-hidden
            >
              {/* prompt → AI */}
              <path
                d="M70 42 C110 42, 140 84, 190 84"
                className={cn(
                  "studio-modal__wire",
                  (liveLink >= 0 || finishing) && "studio-modal__wire--on"
                )}
              />
              {/* Gmail → AI */}
              <path
                d="M70 126 C110 126, 140 84, 190 84"
                className={cn(
                  "studio-modal__wire",
                  (liveLink >= 1 || finishing) && "studio-modal__wire--on"
                )}
              />
              {/* AI → Sheets */}
              <path
                d="M190 84 C240 84, 270 84, 310 84"
                className={cn(
                  "studio-modal__wire",
                  (liveLink >= 2 || finishing) && "studio-modal__wire--on"
                )}
              />

              {/* traveling packets */}
              {!finishing && liveLink === 0 && (
                <circle r="4" className="studio-modal__packet fill-emerald-300">
                  <animateMotion
                    dur="1.4s"
                    repeatCount="indefinite"
                    path="M70 42 C110 42, 140 84, 190 84"
                  />
                </circle>
              )}
              {!finishing && liveLink === 1 && (
                <circle r="4" className="studio-modal__packet fill-emerald-300">
                  <animateMotion
                    dur="1.4s"
                    repeatCount="indefinite"
                    path="M70 126 C110 126, 140 84, 190 84"
                  />
                </circle>
              )}
              {!finishing && liveLink >= 2 && (
                <circle r="4" className="studio-modal__packet fill-emerald-300">
                  <animateMotion
                    dur="1.2s"
                    repeatCount="indefinite"
                    path="M190 84 C240 84, 270 84, 310 84"
                  />
                </circle>
              )}
              {finishing && (
                <>
                  <circle r="4.5" className="fill-emerald-300">
                    <animateMotion
                      dur="0.9s"
                      repeatCount="2"
                      path="M70 42 C110 42, 140 84, 190 84"
                    />
                  </circle>
                  <circle r="4.5" className="fill-emerald-300">
                    <animateMotion
                      dur="0.9s"
                      begin="0.15s"
                      repeatCount="2"
                      path="M70 126 C110 126, 140 84, 190 84"
                    />
                  </circle>
                  <circle r="4.5" className="fill-emerald-300">
                    <animateMotion
                      dur="0.9s"
                      begin="0.3s"
                      repeatCount="2"
                      path="M190 84 C240 84, 270 84, 310 84"
                    />
                  </circle>
                </>
              )}
            </svg>

            <NodeBadge
              className="absolute left-2 top-2"
              lit={nodesLit.prompt}
              active={!finishing && stage === "prompt"}
              label="Prompt"
            >
              <PromptIcon size={26} />
            </NodeBadge>

            <NodeBadge
              className="absolute bottom-1 left-2"
              lit={nodesLit.gmail}
              active={!finishing && stage === "permissions"}
              label="Gmail"
            >
              <GmailIcon size={26} />
            </NodeBadge>

            <NodeBadge
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              lit={nodesLit.ai}
              active={!finishing && (stage === "autosync" || stage === "prompt")}
              label="AI"
              hero
            >
              <AiSparkIcon size={30} />
            </NodeBadge>

            <NodeBadge
              className="absolute right-1 top-1/2 -translate-y-1/2"
              lit={nodesLit.sheets}
              active={!finishing && stage === "sheet"}
              label="Sheets"
              success={finishing}
            >
              <SheetsIcon size={28} />
            </NodeBadge>
          </div>

          {snippet && !finishing && (
            <p className="mx-auto mt-2 max-w-sm truncate rounded-full border border-white/8 bg-white/[0.04] px-4 py-1.5 text-center text-[11px] text-white/45">
              “{snippet}”
            </p>
          )}

          <div className="mt-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="studio-modal__bar h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STAGE_ORDER.filter((k) => k !== "ready").map((key, i) => {
                const done = finishing || i < stageIndex;
                const active = !finishing && i === stageIndex;
                return (
                  <li
                    key={key}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wide transition-all duration-500",
                      done &&
                        "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
                      active &&
                        "border-white/25 bg-white/10 text-white",
                      !done &&
                        !active &&
                        "border-white/8 text-white/30"
                    )}
                  >
                    {key === "prompt"
                      ? "Prompt"
                      : key === "permissions"
                        ? "Connect"
                        : key === "sheet"
                          ? "Sheet"
                          : "Link"}
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-5 text-center text-[11px] text-white/35">
            {finishing
              ? "Almost there…"
              : packet % 2 === 0
                ? "Do not close this window"
                : "Assembling your ready product"}
          </p>
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
    <div className={cn("studio-modal__node flex flex-col items-center gap-1.5", className)}>
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
