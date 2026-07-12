"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { whatsappClient } from "@/services/whatsapp-client";
import type { WhatsAppAccountSummary } from "@/types/whatsapp";

type FormState = {
  accessToken: string;
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
};

const emptyForm: FormState = {
  accessToken: "",
  phoneNumberId: "",
  whatsappBusinessAccountId: "",
};

const META_APPS_URL = "https://developers.facebook.com/apps/";

const FIELDS = [
  {
    key: "accessToken" as const,
    label: "Access token",
    placeholder: "Paste your permanent access token",
    type: "password" as const,
    guideTitle: "Access token",
    steps: [
      <>
        Go to{" "}
        <a
          href={META_APPS_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline"
        >
          Meta for Developers
        </a>{" "}
        and open your app.
      </>,
      <>
        In the left sidebar, choose <strong>WhatsApp</strong> →{" "}
        <strong>API setup</strong>.
      </>,
      <>
        Copy the value under <strong>Temporary access token</strong>, or create
        a <strong>permanent token</strong> (recommended) via your Business
        portfolio → <strong>System users</strong>.
      </>,
    ],
  },
  {
    key: "phoneNumberId" as const,
    label: "Phone number ID",
    placeholder: "e.g. 123456789012345",
    type: "text" as const,
    guideTitle: "Phone number ID",
    steps: [
      <>Stay on <strong>WhatsApp</strong> → <strong>API setup</strong>.</>,
      <>
        Find your business phone number in the <strong>From</strong> section.
      </>,
      <>
        Copy <strong>Phone number ID</strong> — the long number Meta shows
        there, not the phone number customers dial.
      </>,
    ],
  },
  {
    key: "whatsappBusinessAccountId" as const,
    label: "WhatsApp Business account ID",
    placeholder: "e.g. 123456789012345",
    type: "text" as const,
    guideTitle: "WhatsApp Business account ID",
    steps: [
      <>On the same <strong>API setup</strong> page, look near the top.</>,
      <>
        Copy <strong>WhatsApp Business Account ID</strong> (another long
        numeric ID).
      </>,
      <>
        Or open <strong>Meta Business Suite</strong> → WhatsApp account
        settings if you do not see it on API setup.
      </>,
    ],
  },
] as const;

const DEFAULT_GUIDE_KEY = FIELDS[0].key;

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GuidePanel({ title, steps }: { title: string; steps: readonly ReactNode[] }) {
  return (
    <aside
      className="flex h-full flex-col rounded-xl border border-border bg-muted/30 p-5"
      aria-live="polite"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        How to find this
      </p>
      <h3 className="mt-1 text-base font-semibold">{title}</h3>
      <ol className="mt-4 list-decimal space-y-3 pl-4 text-sm leading-relaxed text-muted-foreground marker:font-semibold marker:text-foreground">
        {steps.map((step, i) => (
          <li key={i} className="pl-1">
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-auto pt-6 text-xs text-muted-foreground">
        All three values come from the same Meta app →{" "}
        <strong className="text-foreground">WhatsApp → API setup</strong> page.
      </p>
    </aside>
  );
}

export function WhatsAppIntegrationPanel() {
  const [account, setAccount] = useState<WhatsAppAccountSummary | null>(null);
  const [canConnect, setCanConnect] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeGuide, setActiveGuide] = useState<keyof FormState>(DEFAULT_GUIDE_KEY);

  const activeField =
    FIELDS.find((f) => f.key === activeGuide) ?? FIELDS[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await whatsappClient.getStatus();
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
      const { account: connected } = await whatsappClient.connect({
        accessToken: form.accessToken.trim(),
        phoneNumberId: form.phoneNumberId.trim(),
        whatsappBusinessAccountId: form.whatsappBusinessAccountId.trim(),
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
    if (!confirm("Disconnect WhatsApp from InboxFlow?")) return;
    try {
      await whatsappClient.disconnect();
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
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950">
            <WhatsAppIcon size={32} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">WhatsApp</h2>
            {isConnected ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {account.businessPhone}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Paste three values from Meta, then connect.
              </p>
            )}
          </div>
          {isConnected && (
            <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
              Connected
            </span>
          )}
        </div>

        {isConnected ? (
          <div className="mt-6 max-w-lg space-y-4">
            <p className="text-sm text-muted-foreground">
              Your WhatsApp is linked. Each new message is stored in Inbox,
              can run automations, and — if you linked a Google Sheet on the
              dashboard — is AI-extracted into that table and synced to the
              sheet automatically (one row per message).
            </p>
            <button
              type="button"
              onClick={handleDisconnect}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="mt-6">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
              <div className="space-y-4">
                <ul className="space-y-4">
                  {FIELDS.map((field) => {
                    const isActive = activeGuide === field.key;
                    return (
                      <li key={field.key}>
                        <div className="flex items-center gap-1.5">
                          <label
                            htmlFor={field.key}
                            className={`text-sm font-medium ${isActive ? "text-foreground" : ""}`}
                          >
                            {field.label}
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveGuide(field.key)}
                            aria-label={`Guide: ${field.label}`}
                            aria-pressed={isActive}
                            className={`rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              isActive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <InfoIcon className="h-4 w-4" />
                          </button>
                        </div>
                        <input
                          id={field.key}
                          type={field.type}
                          value={form[field.key]}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              [field.key]: e.target.value,
                            }))
                          }
                          onFocus={() => setActiveGuide(field.key)}
                          placeholder={field.placeholder}
                          required
                          className={`mt-1.5 w-full rounded-lg border bg-background px-3 py-2.5 text-sm transition-colors ${
                            isActive
                              ? "border-emerald-500/60 ring-1 ring-emerald-500/20"
                              : "border-border"
                          }`}
                          autoComplete="off"
                        />
                      </li>
                    );
                  })}
                </ul>

                {!canConnect && (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Server setup required: ask your admin to configure encryption
                    before connecting.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={connecting || !canConnect}
                  className="w-full rounded-lg bg-[#25D366] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 lg:max-w-md"
                >
                  {connecting ? "Connecting…" : "Connect WhatsApp"}
                </button>
              </div>

              <GuidePanel
                title={activeField.guideTitle}
                steps={activeField.steps}
              />
            </div>
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
