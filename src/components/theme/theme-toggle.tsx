"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path d="M21 14.5A8.5 8.5 0 1110.5 3 7 7 0 0021 14.5z" />
    </svg>
  );
}

type ThemeToggleProps = {
  className?: string;
};

/** Quick light / dark switch for headers. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === "dark";
  const reduced = useReducedMotion() ?? false;

  return (
    <button
      type="button"
      onClick={(e) => {
        setTheme(isDark ? "light" : "dark", {
          x: e.clientX,
          y: e.clientY,
        });
      }}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "sun" : "moon"}
          className="absolute inset-0 flex items-center justify-center"
          initial={
            reduced
              ? false
              : { opacity: 0, rotate: -90, scale: 0.4, filter: "blur(4px)" }
          }
          animate={{ opacity: 1, rotate: 0, scale: 1, filter: "blur(0px)" }}
          exit={
            reduced
              ? undefined
              : { opacity: 0, rotate: 90, scale: 0.4, filter: "blur(4px)" }
          }
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {isDark ? (
            <SunIcon className="h-4 w-4" />
          ) : (
            <MoonIcon className="h-4 w-4" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
