/**
 * Infer Apps Script / sheet timer interval (minutes) from a natural-language prompt.
 * Google time triggers are minute-based (min 1).
 */
export function parseSheetSyncMinutesFromPrompt(prompt: string): number | null {
  const text = prompt.toLowerCase();

  const everyMinutes = text.match(
    /every\s+(\d+)\s*(?:min(?:ute)?s?|m)\b/
  );
  if (everyMinutes?.[1]) {
    return clampMinutes(Number(everyMinutes[1]));
  }

  const everySeconds = text.match(
    /every\s+(\d+)\s*(?:sec(?:ond)?s?|s)\b/
  );
  if (everySeconds?.[1]) {
    const secs = Number(everySeconds[1]);
    return clampMinutes(Math.max(1, Math.ceil(secs / 60)));
  }

  const everyHours = text.match(/every\s+(\d+)\s*(?:hour|hr|hrs|h)\b/);
  if (everyHours?.[1]) {
    return clampMinutes(Number(everyHours[1]) * 60);
  }

  if (/\bevery\s+minute\b/.test(text) || /\beach\s+minute\b/.test(text)) {
    return 1;
  }

  if (/\bhourly\b/.test(text) || /\bevery\s+hour\b/.test(text)) {
    return 60;
  }

  return null;
}

/**
 * True when the prompt asks for ongoing sheet auto-update / sync / timer behavior.
 * Used to show the frequency picker only when relevant.
 */
export function promptRequestsSheetAutoUpdate(prompt: string): boolean {
  const text = prompt.toLowerCase();
  if (parseSheetSyncMinutesFromPrompt(prompt) != null) return true;

  return (
    /\bauto[-\s]?sync\b/.test(text) ||
    /\bauto[-\s]?update\b/.test(text) ||
    /\bkeep\s+(?:it\s+)?(?:updated|in\s+sync|syncing)\b/.test(text) ||
    /\b(?:update|sync|refresh)\s+(?:the\s+)?(?:google\s+)?sheet\b/.test(text) ||
    /\b(?:google\s+)?sheet\s+(?:auto[-\s]?)?(?:update|sync|refresh)/.test(text) ||
    /\bsync\s+(?:every|automatically|auto)\b/.test(text) ||
    /\bperiodically\b/.test(text) ||
    /\bon\s+(?:a\s+)?(?:schedule|timer)\b/.test(text) ||
    /\breal[-\s]?time\b/.test(text) ||
    /\blive\s+update/.test(text) ||
    /\bevery\s+\d+\s*(?:min|minute|sec|second|hour|hr)/.test(text)
  );
}

function clampMinutes(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(60, Math.round(n));
}
