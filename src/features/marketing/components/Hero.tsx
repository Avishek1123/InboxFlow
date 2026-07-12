"use client";

import { useMemo, useState } from "react";
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
  x: number;
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
};

const CHAOS: ChaosItem[] = [
  {
    id: "c1",
    channel: "gmail",
    title: "Re: Q3 pricing",
    preview: "Can we schedule a call this week?",
    x: -8,
    y: 6,
    rotate: -7,
    delay: 0,
  },
  {
    id: "c2",
    channel: "whatsapp",
    title: "WhatsApp · Maya",
    preview: "Interested in the Pro plan…",
    x: 4,
    y: 28,
    rotate: 5,
    delay: 0.15,
  },
  {
    id: "c3",
    channel: "lead",
    title: "New inquiry",
    preview: "Demo request from Northwind",
    x: -4,
    y: 52,
    rotate: -3,
    delay: 0.3,
  },
  {
    id: "c4",
    channel: "support",
    title: "Support ticket",
    preview: "Invoice #4821 — need help",
    x: 6,
    y: 74,
    rotate: 8,
    delay: 0.45,
  },
  {
    id: "c5",
    channel: "gmail",
    title: "Intro · Series A",
    preview: "Connecting you with Jordan…",
    x: -10,
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
    accent: "from-violet-500/30 to-fuchsia-500/10",
  },
  {
    id: "o2",
    kind: "crm",
    title: "CRM · Acme Corp",
    meta: "Stage: Qualified",
    accent: "from-sky-500/30 to-cyan-500/10",
  },
  {
    id: "o3",
    kind: "task",
    title: "Task · Follow up",
    meta: "Due today · Sales",
    accent: "from-amber-500/25 to-orange-500/10",
  },
  {
    id: "o4",
    kind: "deal",
    title: "Deal · $48k",
    meta: "Pipeline · Negotiation",
    accent: "from-emerald-500/25 to-teal-500/10",
  },
  {
    id: "o5",
    kind: "analytics",
    title: "Inbox → Work",
    meta: "12 converted · 94% auto",
    accent: "from-indigo-500/30 to-blue-500/10",
  },
];

const floatVariants: Variants = {
  initial: { opacity: 0, y: 24, scale: 0.94 },
  animate: (c: ChaosItem) => ({
    opacity: [0.35, 0.9, 0.55, 0.9],
    y: [0, -10, 4, -6],
    x: [0, 6, -4, 0],
    rotate: [c.rotate, c.rotate + 2, c.rotate - 2, c.rotate],
    transition: {
      duration: 7 + c.delay * 2,
      repeat: Infinity,
      ease: "easeInOut",
      delay: c.delay,
    },
  }),
};

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

function OutputGlyph({ kind }: { kind: OutputCard["kind"] }) {
  const map: Record<OutputCard["kind"], string> = {
    lead: "◎",
    crm: "▣",
    task: "✓",
    deal: "$",
    analytics: "▦",
  };
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm text-white/70">
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
          className="absolute rounded-full bg-white/25"
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
    <div className="relative flex h-[220px] w-[220px] items-center justify-center sm:h-[260px] sm:w-[260px] lg:h-[300px] lg:w-[300px]">
      {/* Ambient bloom */}
      <div className="absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.35),rgba(37,99,235,0.12)_45%,transparent_70%)] blur-2xl" />

      {!reduced && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border border-violet-400/25"
            animate={{ rotate: 360 }}
            transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-[10%] rounded-full border border-dashed border-sky-400/30"
            animate={{ rotate: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-[22%] rounded-full border border-violet-300/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        </>
      )}

      {/* Neural nodes */}
      <svg
        className="absolute inset-[18%] h-[64%] w-[64%] opacity-70"
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
                stroke="rgba(167,139,250,0.35)"
                strokeWidth="0.6"
              />
            )}
            <motion.circle
              cx={x}
              cy={y}
              r="2.2"
              fill="rgba(196,181,253,0.9)"
              animate={
                reduced
                  ? undefined
                  : { opacity: [0.35, 1, 0.35], r: [1.8, 2.6, 1.8] }
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

      {/* Glass orb */}
      <motion.div
        className="relative z-10 flex h-[42%] w-[42%] items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-white/15 via-violet-500/20 to-blue-600/30 shadow-[0_0_60px_rgba(124,58,237,0.45)] backdrop-blur-xl"
        animate={
          reduced
            ? undefined
            : { scale: [1, 1.04, 1], boxShadow: [
                "0 0 50px rgba(124,58,237,0.35)",
                "0 0 80px rgba(59,130,246,0.45)",
                "0 0 50px rgba(124,58,237,0.35)",
              ] }
        }
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="font-[family-name:var(--font-marketing-display)] text-sm font-semibold tracking-[0.2em] text-white/90">
          AI
        </span>
      </motion.div>

      {/* Orbiting particles into core */}
      {!reduced &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.9)]"
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
      <div className="pointer-events-none absolute inset-x-[18%] top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-violet-400/30 to-transparent lg:block" />
    );
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      viewBox="0 0 1200 700"
      fill="none"
      aria-hidden
    >
      {/* Left chaos → core */}
      {[
        "M140 160 C320 180, 420 300, 600 350",
        "M120 280 C300 300, 430 340, 600 350",
        "M130 420 C310 400, 440 360, 600 350",
        "M150 540 C330 500, 450 380, 600 350",
      ].map((d, i) => (
        <g key={d}>
          <path
            d={d}
            stroke="rgba(139,92,246,0.22)"
            strokeWidth="1.2"
            strokeDasharray="4 8"
          />
          <motion.circle r="3" fill="rgba(196,181,253,0.95)">
            <animateMotion dur={`${2.6 + i * 0.25}s`} repeatCount="indefinite" path={d} />
          </motion.circle>
        </g>
      ))}
      {/* Core → organized */}
      {[
        "M600 350 C760 320, 880 220, 1040 180",
        "M600 350 C760 340, 880 300, 1040 290",
        "M600 350 C760 360, 880 400, 1040 400",
        "M600 350 C760 390, 880 500, 1040 540",
      ].map((d, i) => (
        <g key={d}>
          <path
            d={d}
            stroke="rgba(56,189,248,0.22)"
            strokeWidth="1.2"
            strokeDasharray="4 8"
          />
          <motion.circle r="3" fill="rgba(125,211,252,0.95)">
            <animateMotion
              dur={`${2.4 + i * 0.2}s`}
              begin="0.4s"
              repeatCount="indefinite"
              path={d}
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
    <section className="relative isolate min-h-dvh overflow-hidden bg-[#05060a] text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_35%,rgba(76,29,149,0.28),transparent_55%),radial-gradient(ellipse_50%_40%_at_80%_70%,rgba(30,64,175,0.18),transparent_50%),#05060a]" />
      <div
        className="absolute inset-0 opacity-[0.35]"
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

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col px-4 pb-10 pt-20 sm:px-6 lg:px-8">
        {/* Copy — brand-forward, one composition */}
        <div className="relative z-20 mx-auto max-w-3xl pt-4 text-center lg:pt-8">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-[family-name:var(--font-marketing-display)] text-sm font-semibold tracking-[0.28em] text-violet-300/80"
          >
            INBOXFLOW AI
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-4 font-[family-name:var(--font-marketing-display)] text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Turn Conversations Into Structured Work
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg"
          >
            Connect Gmail and WhatsApp. InboxFlow AI automatically extracts data,
            creates records, assigns tasks, and powers your workflows.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <a
              href="/sign-up"
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
            >
              Start Free
            </a>
            <a
              href="/create"
              className="rounded-full border border-white/15 bg-white/5 px-7 py-3 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/10"
            >
              Watch Demo
            </a>
          </motion.div>
        </div>

        {/* Visual story: Chaos → AI → Organized */}
        <div className="relative mt-8 flex flex-1 items-center lg:mt-4">
          <StreamLines reduced={reduced} />

          <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
            {/* LEFT — chaos */}
            <div className="relative mx-auto h-[280px] w-full max-w-md lg:mx-0 lg:h-[420px]">
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35 lg:text-left">
                Chaos
              </p>
              <div className="relative h-[240px] lg:h-[380px]">
                {CHAOS.map((item) => (
                  <motion.article
                    key={item.id}
                    custom={item}
                    variants={floatVariants}
                    initial="initial"
                    animate="animate"
                    className={cn(
                      "absolute w-[78%] max-w-[240px] rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-md",
                      "left-[8%]"
                    )}
                    style={{ top: `${item.y}%` }}
                  >
                    <div className="flex items-center gap-2">
                      <ChannelBadge channel={item.channel} />
                      <p className="truncate text-xs font-medium text-white/85">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-white/45">
                      {item.preview}
                    </p>
                  </motion.article>
                ))}
              </div>
            </div>

            {/* CENTER — AI core */}
            <div className="relative z-10 flex flex-col items-center">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300/70">
                AI Core
              </p>
              <AiCore reduced={reduced} />
              <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/30">
                Extract · Structure · Route
              </p>
            </div>

            {/* RIGHT — organized */}
            <div className="relative mx-auto w-full max-w-md lg:mx-0">
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35 lg:text-right">
                Organized workspace
              </p>
              <div className="flex flex-col gap-2.5">
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
                        "rounded-2xl border border-white/10 bg-gradient-to-r p-3 shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-md transition-transform",
                        card.accent,
                        hoveredOut === card.id && "scale-[1.02]"
                      )}
                      style={{
                        animationDelay: `${i * 80}ms`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <OutputGlyph kind={card.kind} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {card.title}
                          </p>
                          <p className="truncate text-[11px] text-white/45">
                            {card.meta}
                          </p>
                        </div>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-white/50">
                          Auto
                        </span>
                      </div>
                      {!reduced && (
                        <motion.div
                          className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1 + i * 0.1 }}
                        >
                          <motion.div
                            className="h-full rounded-full bg-white/50"
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

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-white/25">
          Conversations in · Structured work out
        </p>
      </div>
    </section>
  );
}

export default Hero;
