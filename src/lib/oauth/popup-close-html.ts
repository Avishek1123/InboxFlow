function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HTML shown in the OAuth popup after Google redirects back.
 * Notifies the opener via postMessage + BroadcastChannel (opener can be
 * null or cross-origin after Google's redirect chain / tunnels).
 */
export function oauthPopupCloseHtml(params: {
  ok: boolean;
  message: string;
  eventType?: string;
  openerOrigin?: string;
}): string {
  const eventType = params.eventType ?? "inboxflow-gmail-oauth";
  const payload = JSON.stringify({
    type: eventType,
    ok: params.ok,
    message: params.message,
  });
  const openerOrigin = params.openerOrigin
    ? JSON.stringify(params.openerOrigin)
    : "null";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>InboxFlow</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">
<p>${params.ok ? "Permissions updated." : "Connection failed."}</p>
<p style="color:#666;font-size:14px">${escapeHtml(params.message)}</p>
<p style="color:#666;font-size:14px">You can close this window and return to InboxFlow.</p>
<script>
(function () {
  var payload = ${payload};
  var openerOrigin = ${openerOrigin};
  var channelName = "inboxflow-gmail-oauth";
  try {
    if (typeof BroadcastChannel !== "undefined") {
      var bc = new BroadcastChannel(channelName);
      bc.postMessage(payload);
      bc.close();
    }
  } catch (e) {}
  try {
    if (window.opener && !window.opener.closed) {
      if (openerOrigin) {
        try { window.opener.postMessage(payload, openerOrigin); } catch (e) {}
      }
      try { window.opener.postMessage(payload, window.location.origin); } catch (e) {}
      try { window.opener.postMessage(payload, "*"); } catch (e) {}
    }
  } catch (e) {}
  try {
    localStorage.setItem(channelName, JSON.stringify({
      at: Date.now(),
      payload: payload
    }));
  } catch (e) {}
  setTimeout(function () { window.close(); }, 800);
})();
</script>
</body>
</html>`;
}
