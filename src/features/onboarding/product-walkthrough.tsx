"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GmailIcon } from "@/components/icons/gmail-icon";
import { TwilioIcon } from "@/components/icons/twilio-icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { cn } from "@/lib/utils";
import {
  hasCompletedProductWalkthrough,
  markProductWalkthroughComplete,
} from "@/lib/onboarding/product-walkthrough";

type StepId =
  | "welcome"
  | "ask"
  | "connect"
  | "sheet"
  | "workflows"
  | "go";

type Step = {
  id: StepId;
  eyebrow: string;
  title: string;
  body: string;
  cta?: string;
};

const STEPS: Step[] = [
  {
    id: "welcome",
    eyebrow: "Welcome",
    title: "Turn inbox intent into a ready product",
    body: "Ask for any flow we support — Gmail, WhatsApp, Twilio SMS, AI extract, Google Sheets. We detect what’s missing, ask for credentials, then build the workflow.",
  },
  {
    id: "ask",
    eyebrow: "Ask AI",
    title: "Describe what you want. We build it.",
    body: "Examples: “Star a Gmail → Lead Tracker sheet”, or “When WhatsApp arrives, save a summary to Sheets”. Build drafts the graph from your prompt.",
  },
  {
    id: "connect",
    eyebrow: "Credentials first",
    title: "We ask only for what the flow needs",
    body: "If Gmail, WhatsApp, or Twilio isn’t connected yet, Ask AI opens a permission step. Connect once — then we create the sheet and activate the workflow.",
  },
  {
    id: "sheet",
    eyebrow: "Your product",
    title: "The sheet link is the deliverable",
    body: "When the build finishes you get a live Google Sheet URL. Mention auto-update in your prompt only if you want to pick a refresh schedule.",
  },
  {
    id: "workflows",
    eyebrow: "Workflows & Settings",
    title: "Edit flows anytime. Stay in control.",
    body: "Workflows lets you inspect and tweak automations. Settings covers appearance and removing Google / messaging access when you need a clean slate.",
  },
  {
    id: "go",
    eyebrow: "You’re set",
    title: "Ready when you are",
    body: "Start on Ask AI — one prompt is enough to ship your first ready product.",
    cta: "Start with Ask AI",
  },
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

function AiIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.2 5.2L18.5 9.5 13.2 10.8 12 16l-1.2-5.2L5.5 9.5l5.3-1.3L12 3z"
        fill="#6ee7b7"
      />
      <path
        d="M18 14l.6 2.4L21 17l-2.4.6L18 20l-.6-2.4L15 17l2.4-.6L18 14z"
        fill="#34d399"
      />
    </svg>
  );
}

function FlowIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="7" height="5" rx="1.5" stroke="#a1a1aa" strokeWidth="1.5" />
      <rect x="14" y="9.5" width="7" height="5" rx="1.5" stroke="#34d399" strokeWidth="1.5" />
      <rect x="3" y="15" width="7" height="5" rx="1.5" stroke="#a1a1aa" strokeWidth="1.5" />
      <path
        d="M10 6.5h2.5a2 2 0 0 1 2 2V12M10 17.5h2.5a2 2 0 0 0 2-2V14.5"
        stroke="#71717a"
        strokeWidth="1.4"
      />
    </svg>
  );
}

type Props = {
  /** Force open (e.g. Replay tour from Settings). */
  forceOpen?: boolean;
  onClose?: () => void;
};

export function ProductWalkthrough({ forceOpen = false, onClose }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setIndex(0);
      setExiting(false);
      setOpen(true);
      return;
    }
    if (hasCompletedProductWalkthrough()) return;
    const t = window.setTimeout(() => setOpen(true), 450);
    return () => window.clearTimeout(t);
  }, [forceOpen]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const finish = useCallback(
    (goCreate?: boolean) => {
      markProductWalkthroughComplete();
      setExiting(true);
      window.setTimeout(() => {
        setOpen(false);
        setExiting(false);
        onClose?.();
        if (goCreate) router.push("/create");
      }, 420);
    },
    [onClose, router]
  );

  if (!open) return null;

  const step = STEPS[index]!;
  const isLast = index === STEPS.length - 1;

  return (
    <div
      className={cn(
        "walkthrough fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6",
        entered && !exiting && "walkthrough--in",
        exiting && "walkthrough--out"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkthrough-title"
    >
      <div className="walkthrough__backdrop" aria-hidden />

      <div className="walkthrough__panel relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e12] shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <div className="walkthrough__glow" aria-hidden />

        <div className="relative flex items-center justify-between px-6 pt-5 sm:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
            InboxFlow tour
          </p>
          <button
            type="button"
            onClick={() => finish(false)}
            className="rounded-lg px-2 py-1 text-xs text-white/45 transition-colors hover:bg-white/5 hover:text-white/80"
          >
            Skip
          </button>
        </div>

        <div className="relative px-6 pb-7 pt-4 sm:px-8 sm:pb-8">
          <div key={step.id} className="walkthrough__stage">
            <StageVisual id={step.id} />
          </div>

          <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/70">
            {step.eyebrow}
          </p>
          <h2
            id="walkthrough-title"
            key={`t-${step.id}`}
            className="walkthrough__title mt-2 text-center text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]"
          >
            {step.title}
          </h2>
          <p
            key={`b-${step.id}`}
            className="walkthrough__body mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-white/55"
          >
            {step.body}
          </p>

          <div className="mt-7 flex items-center justify-center gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-400",
                  i === index
                    ? "w-7 bg-emerald-400"
                    : i < index
                      ? "w-1.5 bg-emerald-400/50"
                      : "w-1.5 bg-white/20"
                )}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/5 disabled:opacity-30"
            >
              Back
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={() => finish(true)}
                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90"
              >
                {step.cta ?? "Get started"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageVisual({ id }: { id: StepId }) {
  if (id === "welcome") {
    return (
      <div className="walkthrough__hero flex h-[160px] flex-col items-center justify-center">
        <div className="walkthrough__brand-mark">InboxFlow</div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.35em] text-white/35">
          AI inbox → ready sheet
        </p>
      </div>
    );
  }

  if (id === "ask") {
    return (
      <div className="flex h-[160px] items-center justify-center">
        <div className="walkthrough__prompt-card w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="h-2 w-16 rounded-full bg-white/15" />
          <div className="mt-3 space-y-2">
            <div className="walkthrough__line h-2 w-full rounded-full bg-white/10" />
            <div className="walkthrough__line walkthrough__line--2 h-2 w-[88%] rounded-full bg-white/10" />
            <div className="walkthrough__line walkthrough__line--3 h-2 w-[64%] rounded-full bg-white/10" />
          </div>
          <div className="walkthrough__cta-bar mt-4 h-8 w-full rounded-lg bg-emerald-500/80" />
        </div>
      </div>
    );
  }

  if (id === "connect") {
    return (
      <div className="relative mx-auto flex h-[160px] w-full max-w-[360px] flex-col items-center justify-center">
        <div className="flex items-end justify-center gap-2">
          <IconOrb label="Gmail">
            <GmailIcon size={22} />
          </IconOrb>
          <IconOrb label="WhatsApp">
            <WhatsAppIcon size={22} />
          </IconOrb>
          <IconOrb label="Twilio">
            <TwilioIcon size={22} />
          </IconOrb>
        </div>
        <div className="my-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-emerald-300/70">
          <span className="h-px w-8 bg-emerald-400/40" />
          ask credentials if missing
          <span className="h-px w-8 bg-emerald-400/40" />
        </div>
        <div className="flex items-center gap-3">
          <IconOrb label="AI" hero>
            <AiIcon size={24} />
          </IconOrb>
          <span className="text-white/25">→</span>
          <IconOrb label="Sheets">
            <SheetsIcon size={22} />
          </IconOrb>
          <span className="text-white/25">→</span>
          <IconOrb label="Workflow">
            <FlowIcon size={22} />
          </IconOrb>
        </div>
      </div>
    );
  }

  if (id === "sheet") {
    return (
      <div className="flex h-[160px] items-center justify-center">
        <div className="walkthrough__sheet relative w-full max-w-xs overflow-hidden rounded-2xl border border-emerald-500/25 bg-[#0f1612] p-4">
          <div className="flex items-center gap-2">
            <SheetsIcon size={20} />
            <span className="text-xs font-medium text-emerald-200">Lead Tracker</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-[9px] text-white/40">
            {["From", "Subject", "Summary"].map((h) => (
              <div key={h} className="rounded bg-white/5 px-1.5 py-1">
                {h}
              </div>
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="walkthrough__cell h-5 rounded bg-white/[0.03]"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
          <div className="walkthrough__link-pill mt-3 truncate rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-200/80">
            docs.google.com/spreadsheets/…
          </div>
        </div>
      </div>
    );
  }

  if (id === "workflows") {
    return (
      <div className="flex h-[160px] items-center justify-center gap-3">
        <MiniCard icon={<FlowIcon />} title="Workflows" sub="Edit & monitor" />
        <MiniCard icon={<AiIcon size={22} />} title="Ask AI" sub="Build again" />
        <MiniCard icon={<GearIcon />} title="Settings" sub="Access & theme" />
      </div>
    );
  }

  return (
    <div className="flex h-[160px] flex-col items-center justify-center">
      <div className="walkthrough__ready-ring flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10">
        <span className="text-2xl text-emerald-300">✓</span>
      </div>
      <p className="mt-3 text-xs text-white/40">Your workspace is ready</p>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="#a1a1aa" strokeWidth="1.5" />
      <path
        d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"
        stroke="#a1a1aa"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconOrb({
  children,
  label,
  className,
  hero,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  hero?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-white/15 bg-[#12161b] shadow-lg",
          hero ? "h-14 w-14 walkthrough__orb-pulse" : "h-12 w-12"
        )}
      >
        {children}
      </div>
      <span className="text-[9px] font-medium uppercase tracking-wider text-white/45">
        {label}
      </span>
    </div>
  );
}

function MiniCard({
  icon,
  title,
  sub,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="walkthrough__mini flex w-[96px] flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#12161b]">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-[11px] font-medium text-white/85">{title}</p>
        <p className="text-[9px] text-white/35">{sub}</p>
      </div>
    </div>
  );
}

/** Host: auto-show on first dashboard visit. */
export function ProductWalkthroughHost() {
  return <ProductWalkthrough />;
}
