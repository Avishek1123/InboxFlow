"use client";

import { useCallback, useEffect, useState } from "react";
import { TwilioIcon } from "@/components/icons/twilio-icon";
import { twilioClient } from "@/services/twilio-client";
import type { TwilioAccountSummary } from "@/types/twilio";

type FormState = {
  accountSid: string;
  authToken: string;
  smsPhoneNumber: string;
  whatsappPhoneNumber: string;
};

const emptyForm: FormState = {
  accountSid: "",
  authToken: "",
  smsPhoneNumber: "",
  whatsappPhoneNumber: "",
};

const TWILIO_CONSOLE = "https://console.twilio.com/";

export function TwilioIntegrationPanel() {
  const [account, setAccount] = useState<TwilioAccountSummary | null>(null);
  const [canConnect, setCanConnect] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await twilioClient.getStatus();
      setAccount(res.account);
      setCanConnect(res.configured.encryption);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      const { account: connected } = await twilioClient.connect({
        accountSid: form.accountSid.trim(),
        authToken: form.authToken.trim(),
        smsPhoneNumber: form.smsPhoneNumber.trim(),
        whatsappPhoneNumber: form.whatsappPhoneNumber.trim() || undefined,
      });
      setAccount(connected);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Twilio from InboxFlow?")) return;
    try {
      await twilioClient.disconnect();
      setAccount(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const isConnected = account?.status === "ACTIVE";

  return (
    <div className="w-full space-y-4">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950">
            <TwilioIcon size={32} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Twilio</h2>
            {isConnected ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                SMS: {account.smsPhoneNumber}
                {account.whatsappPhoneNumber
                  ? ` · WhatsApp: ${account.whatsappPhoneNumber}`
                  : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Connect Twilio for SMS and optional WhatsApp messaging.
              </p>
            )}
          </div>
          {isConnected && (
            <span className="shrink-0 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
              Connected
            </span>
          )}
        </div>

        {isConnected ? (
          <div className="mt-6 max-w-lg space-y-4">
            <p className="text-sm text-muted-foreground">
              Use <strong>Send SMS (Twilio)</strong> or{" "}
              <strong>Send WhatsApp (Twilio)</strong> in automations. Point your
              Twilio phone webhook to:
            </p>
            <code className="block break-all rounded-lg bg-muted px-3 py-2 text-xs">
              {account.webhookUrl}
            </code>
            <button
              type="button"
              onClick={handleDisconnect}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="mt-6 max-w-lg space-y-4">
            <p className="text-sm text-muted-foreground">
              Get credentials from{" "}
              <a
                href={TWILIO_CONSOLE}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline"
              >
                Twilio Console
              </a>
              . Twilio&apos;s free trial works for testing SMS.
            </p>
            {!canConnect && (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Set <code>TOKEN_ENCRYPTION_KEY</code> in your server environment
                before connecting.
              </p>
            )}
            <Field
              label="Account SID"
              value={form.accountSid}
              onChange={(v) => setForm((f) => ({ ...f, accountSid: v }))}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <Field
              label="Auth token"
              type="password"
              value={form.authToken}
              onChange={(v) => setForm((f) => ({ ...f, authToken: v }))}
              placeholder="From Twilio Console dashboard"
            />
            <Field
              label="SMS phone number"
              value={form.smsPhoneNumber}
              onChange={(v) => setForm((f) => ({ ...f, smsPhoneNumber: v }))}
              placeholder="+15551234567"
            />
            <Field
              label="WhatsApp phone number (optional)"
              value={form.whatsappPhoneNumber}
              onChange={(v) =>
                setForm((f) => ({ ...f, whatsappPhoneNumber: v }))
              }
        placeholder="+14155238886 — Twilio sandbox or approved sender"
        required={false}
      />
            <button
              type="submit"
              disabled={connecting || !canConnect}
              className="w-full rounded-lg bg-[#F22F46] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect Twilio"}
            </button>
          </form>
        )}
      </div>

      {error && (
        <p className="max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
        autoComplete="off"
      />
    </label>
  );
}
