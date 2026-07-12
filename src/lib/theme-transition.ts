/** Coordinates for circular theme reveal (usually click position). */
export type ThemeTransitionOrigin = {
  x: number;
  y: number;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function maxRadiusFromPoint(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

/**
 * Apply a theme update with a circular wipe from the given origin.
 * Falls back to an instant switch when View Transitions / motion are unavailable.
 */
export function runThemeTransition(
  update: () => void,
  origin?: ThemeTransitionOrigin
): void {
  const doc = document as ViewTransitionDocument;

  if (!doc.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;

  const transition = doc.startViewTransition(() => {
    update();
  });

  transition.ready
    .then(() => {
      const radius = maxRadiusFromPoint(x, y);

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 820,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    })
    .catch(() => {
      /* transition aborted */
    });
}
