/**
 * Detect when the user asked for starred-only Gmail processing.
 */
export function promptRequestsStarredOnly(prompt: string): boolean {
  const p = prompt.toLowerCase();
  if (!p.includes("star")) return false;
  // "only for stared/starred", "starred email", "is:starred", etc.
  return (
    /\bonly\b[\s\S]{0,40}\bstarr?ed\b/.test(p) ||
    /\bstarr?ed\b[\s\S]{0,40}\bonly\b/.test(p) ||
    /\bstarr?ed\s+emails?\b/.test(p) ||
    /\bis:starr?ed\b/.test(p) ||
    /\bmonitor\b[\s\S]{0,40}\bstarr?ed\b/.test(p) ||
    /\bstarr?ed\b[\s\S]{0,40}\bincoming\b/.test(p)
  );
}
