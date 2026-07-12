"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { THEMES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const DESCRIPTIONS: Record<Theme, string> = {
  light: "Always use a bright interface.",
  dark: "Always use a dark interface.",
  system: "Match your device setting.",
};

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="max-w-lg rounded-2xl border border-border bg-background p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose how InboxFlow looks on this device.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {THEMES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={(e) =>
              setTheme(option, { x: e.clientX, y: e.clientY })
            }
            className={cn(
              "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
              theme === option
                ? "border-foreground bg-muted font-medium text-foreground"
                : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/50"
            )}
          >
            <span className="block font-medium text-foreground">
              {LABELS[option]}
            </span>
            <span className="mt-0.5 block text-xs leading-snug">
              {DESCRIPTIONS[option]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
