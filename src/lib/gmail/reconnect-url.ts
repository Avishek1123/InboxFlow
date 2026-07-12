/** Gmail OAuth URL for in-app permission (popup) or full redirect. */
export function buildGmailReconnectUrl(
  origin: string,
  options?: { popup?: boolean; sheetExportId?: string }
): string {
  const url = new URL("/api/v1/integrations/gmail/connect", origin);
  url.searchParams.set("reconnect", "1");
  if (options?.popup) url.searchParams.set("popup", "1");
  if (options?.sheetExportId) {
    url.searchParams.set("sheetExportId", options.sheetExportId);
  }
  return url.toString();
}
