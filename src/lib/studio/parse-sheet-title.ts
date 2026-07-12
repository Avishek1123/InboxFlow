/**
 * Infer Google Spreadsheet / tab title from a natural-language prompt.
 */
export function parseSheetTitleFromPrompt(prompt: string): string | null {
  const patterns = [
    /(?:google\s+)?sheet(?:s)?\s+(?:named|called|titled)\s+["'“”]?([^"'“”\n,.]+)["'“”]?/i,
    /(?:named|called|titled)\s+(?:the\s+)?(?:google\s+)?sheet(?:s)?\s+["'“”]?([^"'“”\n,.]+)["'“”]?/i,
    /(?:name|title|call)\s+(?:the\s+)?(?:google\s+)?sheet(?:s)?\s+["'“”]?([^"'“”\n,.]+)["'“”]?/i,
    /(?:create|make|build)\s+(?:a\s+)?(?:google\s+)?sheet(?:s)?\s+(?:named|called|titled)\s+["'“”]?([^"'“”\n,.]+)["'“”]?/i,
    /(?:spreadsheet|workbook)\s+(?:named|called|titled)\s+["'“”]?([^"'“”\n,.]+)["'“”]?/i,
    /sheet\s+name\s*(?:is|:|=)\s*["'“”]?([^"'“”\n,.]+)["'“”]?/i,
    /["'“”]([^"'“”]{2,80})["'“”]\s+(?:google\s+)?sheet/i,
  ];

  for (const re of patterns) {
    const m = prompt.match(re);
    const raw = m?.[1]?.trim();
    if (raw) {
      const cleaned = sanitizeSheetTitle(raw);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

/** Google sheet titles max ~100 chars; strip trailing junk. */
export function sanitizeSheetTitle(raw: string): string {
  let title = raw
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Cut trailing instructions that often follow the name in one sentence.
  title = title.replace(
    /\s+(?:and|then|with|that|which|to|for|every|using|via|so|please)\b.*$/i,
    ""
  );

  return title.replace(/[.!?;:]+$/g, "").slice(0, 100).trim();
}
