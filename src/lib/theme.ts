export const THEME_STORAGE_KEY = "inboxflow-theme";

export type Theme = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export const THEMES: Theme[] = ["light", "dark", "system"];

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return getSystemTheme();
  return theme;
}

/** Apply theme on the document root for Tailwind and CSS variables. */
export function applyThemeToDocument(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  const isDark = resolved === "dark";
  root.classList.toggle("dark", isDark);
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  return resolved;
}

/** Inline script — runs before paint to avoid theme flash. */
export const themeInitScript = `(function(){try{var k="inboxflow-theme";var t=localStorage.getItem(k);var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
