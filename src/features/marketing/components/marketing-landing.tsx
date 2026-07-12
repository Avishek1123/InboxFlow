"use client";

import { useEffect, useMemo, useState } from "react";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const PROMPT_SNIPPETS = [
  "Star a Gmail → Lead Tracker sheet",
  "WhatsApp inbound → CRM rows",
  "Extract invoice fields every hour",
];

const CHAOS_LINES = [
  "Re: Q3 pricing — can we talk?",
  "Invoice #4821 attached",
  "Follow up from Acme Corp",
  "New lead: Maya @ Northwind",
  "Intro — Series A intro",
  "URGENT: contract review",
  "demo request · tomorrow",
  "fwd: partnership interest",
];

const SHEET_ROWS = [
  ["Maya Chen", "Northwind", "Series A intro"],
  ["Acme Corp", "Pricing", "Q3 follow-up"],
  ["Jordan Lee", "Invoice", "#4821 paid"],
  ["River Labs", "Demo", "Tomorrow 2pm"],
];

export function MarketingLanding() {
  const [alive, setAlive] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAlive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={cn("marketing", alive && "marketing--alive")}>
      <section className="marketing-hero relative isolate min-h-[min(100dvh,920px)] overflow-hidden">
        <div className="marketing-hero__sky" aria-hidden />
        <div className="marketing-hero__grid" aria-hidden />
        <div className="marketing-hero__orb marketing-hero__orb--a" aria-hidden />
        <div className="marketing-hero__orb marketing-hero__orb--b" aria-hidden />

        <div className="relative z-10 mx-auto flex min-h-[min(100dvh,920px)] max-w-6xl flex-col px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          <div className="flex flex-1 flex-col justify-center pt-6 lg:max-w-[50%]">
            <p className="marketing-hero__brand font-[family-name:var(--font-marketing-display)] text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              {APP_NAME.replace(" AI", "")}
              <span className="text-emerald-400"> AI</span>
            </p>

            <h1 className="marketing-hero__headline mt-6 max-w-xl font-[family-name:var(--font-marketing-display)] text-2xl font-medium leading-snug tracking-tight text-white/90 sm:text-3xl lg:text-[2.15rem]">
              Prompt your inbox into a live automation.
            </h1>

            <p className="marketing-hero__sub mt-4 max-w-md text-base leading-relaxed text-white/55 sm:text-lg">
              Describe the flow once. We connect Gmail, extract with AI, and deliver
              a ready Google Sheet — your product, not a dashboard.
            </p>

            <div className="marketing-hero__cta mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/sign-up"
                className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90"
              >
                Start free trial
              </a>
              <a
                href="/create"
                className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/10"
              >
                Open Ask AI
              </a>
            </div>
          </div>

          <div className="marketing-hero__stage pointer-events-none absolute inset-x-0 bottom-0 top-[40%] lg:inset-y-[8%] lg:left-[46%] lg:right-0 lg:top-[12%]">
            <FoundryStage />
          </div>
        </div>

        <div className="marketing-hero__fade absolute inset-x-0 bottom-0 h-24" aria-hidden />
      </section>

      <section
        id="how"
        className="relative border-t border-white/5 bg-[#07090c] px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/80">
            How it works
          </p>
          <h2 className="mt-3 max-w-xl font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            From a sentence to a running workflow.
          </h2>
          <p className="mt-3 max-w-lg text-sm text-white/50 sm:text-base">
            One path. No Apps Script homework.
          </p>

          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Ask",
                body: "Write what you want — star a mail, name the sheet, optional auto-update.",
              },
              {
                n: "02",
                title: "Connect",
                body: "Approve Gmail + Sheets once. We wire the live path for you.",
              },
              {
                n: "03",
                title: "Ship",
                body: "Get the sheet link. New matching mail lands as structured rows.",
              },
            ].map((step) => (
              <li key={step.n} className="marketing-step">
                <span className="font-mono text-xs text-emerald-400/70">{step.n}</span>
                <h3 className="mt-2 font-[family-name:var(--font-marketing-display)] text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="features"
        className="relative border-t border-white/5 bg-[#05070a] px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
            Built for operators
          </p>
          <h2 className="mt-3 max-w-xl font-[family-name:var(--font-marketing-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Automations that end in a spreadsheet you can trust.
          </h2>

          <ul className="mt-12 divide-y divide-white/8 border-y border-white/8">
            {[
              {
                title: "Ask AI studio",
                body: "Natural language → ready product with sheet link.",
              },
              {
                title: "Gmail & WhatsApp triggers",
                body: "Starred mail or inbound messages start the flow.",
              },
              {
                title: "AI extraction",
                body: "Unstructured messages become clean columns.",
              },
              {
                title: "Workflows you can edit",
                body: "Inspect, tweak, and monitor after the first build.",
              },
            ].map((row) => (
              <li
                key={row.title}
                className="marketing-feature flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
              >
                <h3 className="shrink-0 text-base font-medium text-white">
                  {row.title}
                </h3>
                <p className="max-w-md text-sm text-white/45 sm:text-right">
                  {row.body}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-14 flex flex-wrap items-center gap-3">
            <a
              href="/sign-up"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-950 hover:opacity-90"
            >
              Start free trial
            </a>
            <a
              href="/create"
              className="text-sm font-medium text-white/55 underline-offset-4 hover:text-white hover:underline"
            >
              Or jump into Ask AI →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Unique hero visual: messy inbox stream → refining prism → assembling sheet.
 * Intentionally different from the product loader’s icon-wire graph.
 */
function FoundryStage() {
  const [promptIndex, setPromptIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [filledRows, setFilledRows] = useState(0);

  const prompt = PROMPT_SNIPPETS[promptIndex]!;

  useEffect(() => {
    setTyped("");
    let i = 0;
    const typeId = window.setInterval(() => {
      i += 1;
      setTyped(prompt.slice(0, i));
      if (i >= prompt.length) window.clearInterval(typeId);
    }, 38);
    return () => window.clearInterval(typeId);
  }, [prompt]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPromptIndex((p) => (p + 1) % PROMPT_SNIPPETS.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timers = new Set<number>();

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    const runCycle = () => {
      if (cancelled) return;
      setFilledRows(0);
      SHEET_ROWS.forEach((_, i) => {
        schedule(() => {
          if (!cancelled) setFilledRows(i + 1);
        }, 500 + i * 380);
      });
      schedule(runCycle, 500 + SHEET_ROWS.length * 380 + 1800);
    };

    runCycle();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [promptIndex]);

  const chaos = useMemo(
    () =>
      CHAOS_LINES.map((line, i) => ({
        line,
        delay: `${(i * 0.55) % 4}s`,
        x: `${8 + ((i * 17) % 55)}%`,
        dur: `${7 + (i % 4)}s`,
        opacity: 0.25 + (i % 5) * 0.08,
      })),
    []
  );

  return (
    <div className="foundry relative mx-auto flex h-full w-full max-w-lg flex-col justify-center px-3 lg:max-w-none lg:px-8">
      {/* Prompt ribbon */}
      <div className="foundry__prompt mb-5 overflow-hidden rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
          Prompt
        </p>
        <p className="foundry__type mt-1.5 min-h-[1.4em] font-mono text-[13px] text-emerald-200/90">
          {typed}
          <span className="foundry__caret" aria-hidden>
            |
          </span>
        </p>
      </div>

      <div className="foundry__body relative grid min-h-[280px] grid-cols-[1fr_auto_1.15fr] items-stretch gap-2 sm:gap-3">
        {/* Chaos inbox stream */}
        <div className="foundry__chaos relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
          <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-[#07090c] to-transparent px-3 py-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
              Inbox noise
            </span>
          </div>
          <div className="foundry__rain absolute inset-0 pt-8">
            {chaos.map((item) => (
              <span
                key={item.line}
                className="foundry__chip"
                style={{
                  left: item.x,
                  animationDelay: item.delay,
                  animationDuration: item.dur,
                  opacity: item.opacity,
                }}
              >
                {item.line}
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#07090c] to-transparent" />
        </div>

        {/* Refining prism / scanner */}
        <div className="foundry__prism relative flex w-10 flex-col items-center justify-center sm:w-12">
          <div className="foundry__beam" aria-hidden />
          <div className="foundry__scan" aria-hidden />
          <span className="foundry__prism-core" aria-hidden />
        </div>

        {/* Assembling sheet lattice */}
        <div className="foundry__lattice relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#0b1511]/80 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
              Structured output
            </span>
            <span className="font-mono text-[9px] text-emerald-400/50">
              {filledRows}/{SHEET_ROWS.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[8px] uppercase tracking-wide text-white/30">
            {["From", "Topic", "Signal"].map((h) => (
              <div
                key={h}
                className="rounded-md border border-white/8 bg-white/[0.04] px-1.5 py-1"
              >
                {h}
              </div>
            ))}
          </div>
          <div className="mt-1.5 space-y-1">
            {SHEET_ROWS.map((row, ri) => (
              <div
                key={row.join("-")}
                className={cn(
                  "foundry__row grid grid-cols-3 gap-1",
                  ri < filledRows && "foundry__row--in"
                )}
              >
                {row.map((cell) => (
                  <div
                    key={cell}
                    className="truncate rounded-md border border-transparent bg-white/[0.03] px-1.5 py-1.5 text-[10px] text-white/70"
                  >
                    {ri < filledRows ? cell : ""}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="foundry__lattice-glow" aria-hidden />
        </div>
      </div>

      <p className="mt-4 text-center text-[10px] uppercase tracking-[0.28em] text-white/30">
        Noise in · structure out
      </p>
    </div>
  );
}
