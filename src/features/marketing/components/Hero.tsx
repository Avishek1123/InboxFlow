"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { GmailIcon } from "@/components/icons/gmail-icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { cn } from "@/lib/utils";

type ChaosItem = {
  id: string;
  channel: "gmail" | "whatsapp" | "lead" | "support";
  title: string;
  preview: string;
  y: number;
  rotate: number;
  delay: number;
};

type OutputCard = {
  id: string;
  kind: "lead" | "crm" | "task" | "deal" | "analytics";
  title: string;
  meta: string;
  accent: string;
  glyph: string;
  bar: string;
};

const CHAOS: ChaosItem[] = [
  {
    id: "c1",
    channel: "gmail",
    title: "Re: Q3 pricing",
    preview: "Can we schedule a call this week?",
    y: 6,
    rotate: -7,
    delay: 0,
  },
  {
    id: "c2",
    channel: "whatsapp",
    title: "WhatsApp · Maya",
    preview: "Interested in the Pro plan…",
    y: 28,
    rotate: 5,
    delay: 0.15,
  },
  {
    id: "c3",
    channel: "lead",
    title: "New inquiry",
    preview: "Demo request from Northwind",
    y: 52,
    rotate: -3,
    delay: 0.3,
  },
  {
    id: "c4",
    channel: "support",
    title: "Support ticket",
    preview: "Invoice #4821 — need help",
    y: 74,
    rotate: 8,
    delay: 0.45,
  },
  {
    id: "c5",
    channel: "gmail",
    title: "Intro · Series A",
    preview: "Connecting you with Jordan…",
    y: 38,
    rotate: -10,
    delay: 0.55,
  },
];

const OUTPUTS: OutputCard[] = [
  {
    id: "o1",
    kind: "lead",
    title: "Lead · Maya Chen",
    meta: "Northwind · Hot",
    accent:
      "border-violet-300/70 from-violet-500/40 via-fuchsia-400/15 to-white dark:border-white/10 dark:from-violet-500/30 dark:via-fuchsia-500/10 dark:to-transparent",
    glyph:
      "bg-violet-500/20 text-violet-700 ring-1 ring-violet-400/30 dark:bg-white/5 dark:text-white/70 dark:ring-0",
    bar: "bg-violet-500 dark:bg-white/50",
  },
  {
    id: "o2",
    kind: "crm",
    title: "CRM · Acme Corp",
    meta: "Stage: Qualified",
    accent:
      "border-sky-300/70 from-sky-500/40 via-cyan-400/15 to-white dark:border-white/10 dark:from-sky-500/30 dark:via-cyan-500/10 dark:to-transparent",
    glyph:
      "bg-sky-500/20 text-sky-700 ring-1 ring-sky-400/30 dark:bg-white/5 dark:text-white/70 dark:ring-0",
    bar: "bg-sky-500 dark:bg-white/50",
  },
  {
    id: "o3",
    kind: "task",
    title: "Task · Follow up",
    meta: "Due today · Sales",
    accent:
      "border-amber-300/70 from-amber-500/35 via-orange-400/15 to-white dark:border-white/10 dark:from-amber-500/25 dark:via-orange-500/10 dark:to-transparent",
    glyph:
      "bg-amber-500/20 text-amber-800 ring-1 ring-amber-400/30 dark:bg-white/5 dark:text-white/70 dark:ring-0",
    bar: "bg-amber-500 dark:bg-white/50",
  },
  {
    id: "o4",
    kind: "deal",
    title: "Deal · $48k",
    meta: "Pipeline · Negotiation",
    accent:
      "border-emerald-300/70 from-emerald-500/35 via-teal-400/15 to-white dark:border-white/10 dark:from-emerald-500/25 dark:via-teal-500/10 dark:to-transparent",
    glyph:
      "bg-emerald-500/20 text-emerald-700 ring-1 ring-emerald-400/30 dark:bg-white/5 dark:text-white/70 dark:ring-0",
    bar: "bg-emerald-500 dark:bg-white/50",
  },
  {
    id: "o5",
    kind: "analytics",
    title: "Inbox → Work",
    meta: "12 converted · 94% auto",
    accent:
      "border-indigo-300/70 from-indigo-500/40 via-blue-400/15 to-white dark:border-white/10 dark:from-indigo-500/30 dark:via-blue-500/10 dark:to-transparent",
    glyph:
      "bg-indigo-500/20 text-indigo-700 ring-1 ring-indigo-400/30 dark:bg-white/5 dark:text-white/70 dark:ring-0",
    bar: "bg-indigo-500 dark:bg-white/50",
  },
];

const outputVariants: Variants = {
  initial: { opacity: 0, x: 28, filter: "blur(8px)" },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: {
      delay: 0.8 + i * 0.12,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

function ChannelBadge({ channel }: { channel: ChaosItem["channel"] }) {
  if (channel === "gmail") return <GmailIcon size={14} />;
  if (channel === "whatsapp") return <WhatsAppIcon size={14} />;
  if (channel === "lead") {
    return (
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-500/80 text-[8px] font-bold text-white">
        L
      </span>
    );
  }
  return (
    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500/80 text-[8px] font-bold text-white">
      S
    </span>
  );
}

function OutputGlyph({
  kind,
  className,
}: {
  kind: OutputCard["kind"];
  className?: string;
}) {
  const map: Record<OutputCard["kind"], string> = {
    lead: "◎",
    crm: "▣",
    task: "✓",
    deal: "$",
    analytics: "▦",
  };
  return (
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold",
        className
      )}
    >
      {map[kind]}
    </span>
  );
}

function ParticleField({ reduced }: { reduced: boolean }) {
  const dots = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        top: `${(i * 53) % 100}%`,
        size: 1 + (i % 3),
        delay: (i % 10) * 0.35,
        duration: 6 + (i % 5),
      })),
    []
  );

  if (reduced) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className="absolute rounded-full bg-zinc-400/45 dark:bg-white/25"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
          }}
          animate={{ opacity: [0.1, 0.55, 0.1], y: [0, -18, 0] }}
          transition={{
            duration: d.duration,
            repeat: Infinity,
            delay: d.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function AiCore({ reduced }: { reduced: boolean }) {
  return (
    <div className="relative flex h-[180px] w-[180px] items-center justify-center sm:h-[220px] sm:w-[220px] lg:h-[260px] lg:w-[260px]">
      {/* Soft aura — restrained on light, rich on dark */}
      <div className="absolute inset-[-22%] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.18),rgba(59,130,246,0.08)_45%,transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(124,58,237,0.35),rgba(37,99,235,0.12)_45%,transparent_70%)]" />
      <div className="absolute inset-[-6%] rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.25),transparent_65%)] blur-xl dark:hidden" />

      {!reduced && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border border-zinc-300/80 dark:border-violet-400/25"
            animate={{ rotate: 360 }}
            transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-[10%] rounded-full border border-dashed border-sky-400/45 dark:border-sky-400/30"
            animate={{ rotate: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-[22%] rounded-full border border-indigo-300/40 dark:border-violet-300/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        </>
      )}

      <svg
        className="absolute inset-[18%] h-[64%] w-[64%] opacity-85 dark:opacity-70"
        viewBox="0 0 100 100"
        aria-hidden
      >
        {[
          [20, 28],
          [50, 18],
          [78, 30],
          [24, 58],
          [50, 50],
          [76, 60],
          [34, 82],
          [66, 80],
        ].map(([x, y], i, arr) => (
          <g key={`${x}-${y}`}>
            {i > 0 && (
              <line
                x1={arr[Math.floor(i / 2)]![0]}
                y1={arr[Math.floor(i / 2)]![1]}
                x2={x}
                y2={y}
                className="stroke-indigo-400/45 dark:stroke-violet-300/35"
                strokeWidth="0.7"
              />
            )}
            <motion.circle
              cx={x}
              cy={y}
              r="2.2"
              className="fill-indigo-500 dark:fill-violet-200"
              animate={
                reduced
                  ? undefined
                  : { opacity: [0.45, 1, 0.45], r: [1.8, 2.6, 1.8] }
              }
              transition={{
                duration: 2.4,
                repeat: Infinity,
                delay: i * 0.18,
              }}
            />
          </g>
        ))}
      </svg>

      <motion.div
        className="relative z-30 flex h-[42%] w-[42%] items-center justify-center rounded-full border border-zinc-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-[0_0_40px_rgba(99,102,241,0.18),0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/20 dark:from-white/15 dark:via-violet-500/20 dark:to-blue-600/30 dark:shadow-[0_0_60px_rgba(124,58,237,0.45)]"
        animate={
          reduced
            ? undefined
            : {
                scale: [1, 1.04, 1],
              }
        }
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="font-[family-name:var(--font-marketing-display)] text-sm font-semibold tracking-[0.2em] text-zinc-900 dark:text-white/90">
          AI
        </span>
      </motion.div>

      {!reduced &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.7)] dark:bg-sky-300 dark:shadow-[0_0_10px_rgba(125,211,252,0.9)]"
            style={{ left: "50%", top: "50%" }}
            animate={{
              x: [Math.cos((i / 6) * Math.PI * 2) * 120, 0],
              y: [Math.sin((i / 6) * Math.PI * 2) * 120, 0],
              opacity: [0, 1, 0],
              scale: [0.6, 1, 0.2],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              delay: i * 0.35,
              ease: "easeIn",
            }}
          />
        ))}
    </div>
  );
}

function StreamLines({ reduced }: { reduced: boolean }) {
  if (reduced) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[15] hidden h-px w-[36rem] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-violet-400/40 to-transparent lg:block" />
    );
  }

  // Short spans: chaos edge → hub → workspace edge
  const hubX = 400;
  const hubY = 200;
  const wires = [
    {
      d: `M40 60 C160 80, 300 190, ${hubX} ${hubY} C500 210, 640 70, 760 50`,
      stroke: "stroke-violet-600/60 dark:stroke-violet-400/50",
      fill: "fill-violet-600 dark:fill-violet-200",
    },
    {
      d: `M30 140 C170 150, 310 195, ${hubX} ${hubY} C490 205, 650 150, 770 140`,
      stroke: "stroke-violet-500/55 dark:stroke-sky-400/45",
      fill: "fill-sky-500 dark:fill-sky-300",
    },
    {
      d: `M30 260 C170 250, 310 205, ${hubX} ${hubY} C490 195, 650 250, 770 260`,
      stroke: "stroke-sky-600/60 dark:stroke-sky-400/50",
      fill: "fill-sky-600 dark:fill-sky-300",
    },
    {
      d: `M40 340 C160 320, 300 210, ${hubX} ${hubY} C500 190, 640 330, 760 350`,
      stroke: "stroke-sky-600/55 dark:stroke-violet-400/45",
      fill: "fill-violet-600 dark:fill-violet-200",
    },
  ];

  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-1/2 z-[15] hidden h-[26rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 lg:block xl:w-[48rem]"
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden
    >
      {wires.map((wire, i) => (
        <g key={wire.d}>
          <path
            d={wire.d}
            className={wire.stroke}
            strokeWidth="1.6"
            strokeDasharray="4 8"
            strokeLinecap="round"
          />
          <motion.circle r="3" className={wire.fill}>
            <animateMotion
              dur={`${2.8 + i * 0.2}s`}
              repeatCount="indefinite"
              path={wire.d}
            />
          </motion.circle>
        </g>
      ))}
    </svg>
  );
}

/**
 * Full-screen product story hero:
 * Chaos (inbox) → AI Core → Structured work
 */
export function Hero() {
  const reduced = useReducedMotion() ?? false;
  const [hoveredOut, setHoveredOut] = useState<string | null>(null);

  return (
    <section className="relative isolate min-h-dvh overflow-x-hidden bg-background text-foreground lg:h-full lg:max-h-dvh lg:overflow-hidden">
      {/* Light canvas only */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 50% 38%, rgba(99,102,241,0.08), transparent 58%), radial-gradient(ellipse 45% 38% at 80% 72%, rgba(59,130,246,0.06), transparent 55%), linear-gradient(180deg, #f7f8fa 0%, #f4f5f7 50%, #f1f2f4 100%)",
        }}
        aria-hidden
      />
      {/* Dark canvas — original look */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 35%, rgba(76,29,149,0.28), transparent 55%), radial-gradient(ellipse 50% 40% at 80% 70%, rgba(30,64,175,0.18), transparent 50%)",
          backgroundColor: "#05060a",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.35] dark:hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(24,24,27,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 55% at 50% 40%, black, transparent)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 hidden opacity-[0.35] dark:block"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 55% at 50% 40%, black, transparent)",
        }}
        aria-hidden
      />
      <ParticleField reduced={reduced} />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col px-4 pb-8 pt-16 sm:px-6 sm:pb-6 lg:h-full lg:min-h-0 lg:px-8 lg:pb-4">
        <div className="relative z-20 mx-auto w-full max-w-3xl shrink-0 pt-2 text-center lg:pt-4">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-[family-name:var(--font-marketing-display)] text-xs font-semibold tracking-[0.28em] text-zinc-500 sm:text-sm dark:text-violet-300/80"
          >
            INBOXFLOW AI
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-3 font-[family-name:var(--font-marketing-display)] text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Turn Conversations Into Structured Work
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 sm:max-w-2xl sm:text-base dark:text-muted-foreground"
          >
            Connect Gmail and WhatsApp. InboxFlow AI automatically extracts data,
            creates records, assigns tasks, and powers your workflows.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.24 }}
            className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
          >
            <a
              href="/sign-up"
              className="rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 sm:px-7 sm:py-3"
            >
              Start Free
            </a>
            <a
              href="/create"
              className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 sm:px-7 sm:py-3 dark:border-border dark:bg-background/60 dark:text-foreground dark:shadow-none dark:hover:bg-muted"
            >
              Watch Demo
            </a>
          </motion.div>
        </div>

        <div className="relative mt-6 flex min-h-0 flex-1 flex-col items-stretch lg:mt-2 lg:items-center">
          <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
            {/* Chaos — desktop story column */}
            <div className="relative z-20 mx-auto hidden h-[360px] w-full max-w-md lg:mx-0 lg:block">
              <p className="mb-2 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-muted-foreground">
                Chaos
              </p>
              <div className="relative h-[330px]">
                {CHAOS.map((item) => (
                  <article
                    key={item.id}
                    className="chaos-float absolute left-[8%] w-[78%] max-w-[240px]"
                    style={
                      {
                        top: `${item.y}%`,
                        "--chaos-rot": `${item.rotate}deg`,
                        "--chaos-dur": `${5.5 + item.delay * 1.5}s`,
                        "--chaos-delay": `${item.delay}s`,
                      } as CSSProperties
                    }
                  >
                    <div
                      className={cn(
                        "rounded-2xl border border-zinc-200/90 bg-white/90 p-3 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/5 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)] dark:ring-0"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ChannelBadge channel={item.channel} />
                        <p className="truncate text-xs font-semibold text-zinc-900 dark:text-foreground/90">
                          {item.title}
                        </p>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-zinc-600 dark:text-muted-foreground">
                        {item.preview}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* AI Core — always visible, compact on mobile */}
            <div className="relative order-first flex flex-col items-center lg:order-none">
              <p className="relative z-30 mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-600 dark:text-violet-300/70">
                AI Core
              </p>
              <div className="relative flex items-center justify-center">
                <StreamLines reduced={reduced} />
                <AiCore reduced={reduced} />
              </div>
              <p className="relative z-30 mt-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500 sm:mt-3 dark:text-muted-foreground">
                Extract · Structure · Route
              </p>

              {/* Mobile-only compact chaos strip */}
              <div className="mt-5 flex w-full max-w-sm flex-wrap justify-center gap-2 lg:hidden">
                {CHAOS.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex max-w-[46%] items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white/90 px-2.5 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.06]"
                  >
                    <ChannelBadge channel={item.channel} />
                    <p className="truncate text-[11px] font-semibold text-zinc-900 dark:text-foreground/90">
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-20 mx-auto w-full max-w-md lg:mx-0">
              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-600 dark:text-muted-foreground lg:mb-3 lg:text-right">
                Organized workspace
              </p>
              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {OUTPUTS.map((card, i) => (
                    <motion.article
                      key={card.id}
                      custom={i}
                      variants={outputVariants}
                      initial="initial"
                      animate="animate"
                      onHoverStart={() => setHoveredOut(card.id)}
                      onHoverEnd={() => setHoveredOut(null)}
                      className={cn(
                        "rounded-2xl border bg-gradient-to-r p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.07)] backdrop-blur-md transition-transform sm:p-3 dark:shadow-[0_16px_40px_rgba(0,0,0,0.3)]",
                        card.accent,
                        hoveredOut === card.id && "scale-[1.02]",
                        i >= 3 && "hidden sm:block"
                      )}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <OutputGlyph kind={card.kind} className={card.glyph} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-foreground">
                            {card.title}
                          </p>
                          <p className="truncate text-[11px] font-medium text-zinc-600 dark:text-muted-foreground">
                            {card.meta}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-zinc-300/90 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-700 shadow-sm dark:border-transparent dark:bg-white/10 dark:font-semibold dark:text-white/50 dark:shadow-none">
                          Auto
                        </span>
                      </div>
                      {!reduced && (
                        <motion.div
                          className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-200/90 dark:bg-white/10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1 + i * 0.1 }}
                        >
                          <motion.div
                            className={cn("h-full rounded-full", card.bar)}
                            animate={{ width: ["12%", "100%", "70%"] }}
                            transition={{
                              duration: 4.5,
                              repeat: Infinity,
                              delay: i * 0.3,
                              ease: "easeInOut",
                            }}
                          />
                        </motion.div>
                      )}
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 shrink-0 text-center text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500 lg:mt-2 dark:text-muted-foreground/70">
          Conversations in · Structured work out
        </p>
      </div>
    </section>
  );
}

export default Hero;
