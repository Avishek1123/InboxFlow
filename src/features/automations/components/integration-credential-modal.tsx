"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GmailIcon } from "@/components/icons/gmail-icon";
import { TwilioIcon } from "@/components/icons/twilio-icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import type { IntegrationRequirement } from "@/lib/automation/definitions";
import type { NodeDefinition } from "@/lib/automation/definitions";
import { gmailClient } from "@/services/gmail-client";
import { twilioClient } from "@/services/twilio-client";
import { whatsappClient } from "@/services/whatsapp-client";

const GMAIL_OAUTH_CHANNEL = "inboxflow-gmail-oauth";
const DEFAULT_GMAIL_RECONNECT =
  "/api/v1/integrations/gmail/connect?reconnect=1";

type Props = {
  open: boolean;
  integration: IntegrationRequirement;
  node: NodeDefinition | null;
  gmailReconnectUrl: string;
  whatsappEncryptionReady: boolean;
  twilioEncryptionReady: boolean;
  onConnected: () => void;
  onCancel: () => void;
};

type OAuthPayload = { type?: string; ok?: boolean; message?: string };

export function IntegrationCredentialModal({
  open,
  integration,
  node,
  gmailReconnectUrl,
  whatsappEncryptionReady,
  twilioEncryptionReady,
  onConnected,
  onCancel,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const finishedRef = useRef(false);
  const [waForm, setWaForm] = useState({
    accessToken: "",
    phoneNumberId: "",
    whatsappBusinessAccountId: "",
  });
  const [twilioForm, setTwilioForm] = useState({
    accountSid: "",
    authToken: "",
    smsPhoneNumber: "",
    whatsappPhoneNumber: "",
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setHint(null);
    finishedRef.current = false;
    popupRef.current = null;
  }, [open, integration, node?.kind]);

  const finishSuccess = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setBusy(false);
    setHint(null);
    setError(null);
    onConnected();
  }, [onConnected]);

  const checkGmailConnected = useCallback(async (): Promise<boolean> => {
    try {
      const status = await gmailClient.getStatus();
      // Account ACTIVE means OAuth callback saved tokens — enough to leave this modal.
      // Sheets scope gaps are shown in the setup bar as "reconnect".
      if (status.account?.status === "ACTIVE") {
        finishSuccess();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [finishSuccess]);

  const handleOAuthPayload = useCallback(
    (data: OAuthPayload) => {
      if (data?.type !== GMAIL_OAUTH_CHANNEL) return;
      if (data.ok) {
        void checkGmailConnected().then((ok) => {
          if (!ok) finishSuccess();
        });
      } else {
        setBusy(false);
        setHint(null);
        setError(data.message ?? "Gmail connection was not completed.");
      }
    },
    [checkGmailConnected, finishSuccess]
  );

  useEffect(() => {
    if (!open || integration !== "GMAIL") return;

    function onMessage(event: MessageEvent) {
      handleOAuthPayload(event.data as OAuthPayload);
    }

    window.addEventListener("message", onMessage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(GMAIL_OAUTH_CHANNEL);
      bc.onmessage = (event) => {
        handleOAuthPayload(event.data as OAuthPayload);
      };
    } catch {
      /* BroadcastChannel unavailable */
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== GMAIL_OAUTH_CHANNEL || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as {
          payload?: OAuthPayload | string;
        };
        const payload =
          typeof parsed.payload === "string"
            ? (JSON.parse(parsed.payload) as OAuthPayload)
            : parsed.payload;
        if (payload) handleOAuthPayload(payload);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      bc?.close();
    };
  }, [open, integration, handleOAuthPayload]);

  // While waiting, poll Gmail status — covers lost postMessage after Google redirect.
  useEffect(() => {
    if (!open || integration !== "GMAIL" || !busy) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled || finishedRef.current) return;
      const ok = await checkGmailConnected();
      if (ok || cancelled) return;
      const popup = popupRef.current;
      if (popup && popup.closed) {
        setHint(
          "Google window closed. If you approved access, click “I’ve connected”."
        );
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, integration, busy, checkGmailConnected]);

  if (!open) return null;

  const nodeTitle =
    node?.label ??
    (integration === "GMAIL"
      ? "Gmail automations"
      : integration === "TWILIO"
        ? "Twilio automations"
        : "WhatsApp automations");

  async function connectWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await whatsappClient.connect(waForm);
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect WhatsApp");
    } finally {
      setBusy(false);
    }
  }

  async function connectTwilio(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await twilioClient.connect({
        accountSid: twilioForm.accountSid.trim(),
        authToken: twilioForm.authToken.trim(),
        smsPhoneNumber: twilioForm.smsPhoneNumber.trim(),
        whatsappPhoneNumber: twilioForm.whatsappPhoneNumber.trim() || undefined,
      });
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Twilio");
    } finally {
      setBusy(false);
    }
  }

  function connectGmailPopup() {
    finishedRef.current = false;
    setBusy(true);
    setError(null);
    setHint(
      "Complete Google sign-in in the popup. This dialog will continue automatically."
    );
    const base =
      gmailReconnectUrl.trim() || DEFAULT_GMAIL_RECONNECT;
    const url = new URL(base, window.location.origin);
    url.searchParams.set("popup", "1");
    url.searchParams.set("openerOrigin", window.location.origin);
    const w = 520;
    const h = 720;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    popupRef.current = window.open(
      url.toString(),
      "inboxflow-gmail-oauth",
      `width=${w},height=${h},left=${left},top=${top}`
    );
    if (!popupRef.current) {
      setBusy(false);
      setHint(null);
      setError("Popup was blocked. Allow popups for this site and try again.");
    }
  }

  const integrationName =
    integration === "GMAIL"
      ? "Gmail"
      : integration === "TWILIO"
        ? "Twilio"
        : "WhatsApp";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          {integration === "GMAIL" ? (
            <GmailIcon size={28} />
          ) : integration === "TWILIO" ? (
            <TwilioIcon size={28} />
          ) : (
            <WhatsAppIcon size={28} />
          )}
          <div>
            <h2 className="text-lg font-semibold">Connect {integrationName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong>{nodeTitle}</strong> needs a connected {integrationName}{" "}
              account
              {node
                ? " before it can be added to your workflow"
                : " before this workflow can run"}
              .
            </p>
          </div>
        </div>

        {integration === "GMAIL" ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in with Google and approve InboxFlow permissions. A popup will
              open — allow popups if nothing appears.
            </p>
            <button
              type="button"
              onClick={connectGmailPopup}
              disabled={busy}
              className="w-full rounded-lg bg-[#ea4335] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Waiting for Google…" : "Connect Gmail"}
            </button>
            {busy && (
              <button
                type="button"
                onClick={() => void checkGmailConnected().then((ok) => {
                  if (!ok) {
                    setHint(
                      "Gmail is not connected yet. Finish the Google popup, or try Connect again."
                    );
                  }
                })}
                className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                I’ve connected — continue
              </button>
            )}
            {hint && (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {hint}
              </p>
            )}
          </div>
        ) : integration === "TWILIO" ? (
          <form onSubmit={connectTwilio} className="mt-5 space-y-3">
            {!twilioEncryptionReady && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                Set <code className="text-[11px]">TOKEN_ENCRYPTION_KEY</code> in
                your server environment before saving Twilio credentials.
              </p>
            )}
            <CredentialField
              label="Account SID"
              value={twilioForm.accountSid}
              onChange={(v) => setTwilioForm((f) => ({ ...f, accountSid: v }))}
              placeholder="ACxxxxxxxx"
            />
            <CredentialField
              label="Auth token"
              type="password"
              value={twilioForm.authToken}
              onChange={(v) => setTwilioForm((f) => ({ ...f, authToken: v }))}
              placeholder="From Twilio Console"
            />
            <CredentialField
              label="SMS phone number"
              value={twilioForm.smsPhoneNumber}
              onChange={(v) =>
                setTwilioForm((f) => ({ ...f, smsPhoneNumber: v }))
              }
              placeholder="+15551234567"
            />
            <p className="text-xs text-muted-foreground">
              Need help?{" "}
              <Link href="/integrations/twilio" className="underline">
                Open full Twilio setup guide
              </Link>
            </p>
            <button
              type="submit"
              disabled={busy || !twilioEncryptionReady}
              className="w-full rounded-lg bg-[#F22F46] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Connecting…" : "Save & connect Twilio"}
            </button>
          </form>
        ) : (
          <form onSubmit={connectWhatsApp} className="mt-5 space-y-3">
            {!whatsappEncryptionReady && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                Set <code className="text-[11px]">TOKEN_ENCRYPTION_KEY</code> in
                your server environment before saving WhatsApp credentials.
              </p>
            )}
            <CredentialField
              label="Access token"
              type="password"
              value={waForm.accessToken}
              onChange={(v) => setWaForm((f) => ({ ...f, accessToken: v }))}
              placeholder="Permanent access token from Meta"
            />
            <CredentialField
              label="Phone number ID"
              value={waForm.phoneNumberId}
              onChange={(v) => setWaForm((f) => ({ ...f, phoneNumberId: v }))}
              placeholder="From Meta → WhatsApp → API setup"
            />
            <CredentialField
              label="WhatsApp Business account ID"
              value={waForm.whatsappBusinessAccountId}
              onChange={(v) =>
                setWaForm((f) => ({ ...f, whatsappBusinessAccountId: v }))
              }
              placeholder="WABA ID from Meta"
            />
            <p className="text-xs text-muted-foreground">
              Need help?{" "}
              <Link href="/integrations/whatsapp" className="underline">
                Open full WhatsApp setup guide
              </Link>
            </p>
            <button
              type="submit"
              disabled={busy || !whatsappEncryptionReady}
              className="w-full rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Connecting…" : "Save & connect WhatsApp"}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CredentialField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        required
      />
    </label>
  );
}
