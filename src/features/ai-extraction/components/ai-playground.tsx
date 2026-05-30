"use client";

import { useState } from "react";
import { aiClient } from "@/services/ai-client";
import type { AiAnalyzeResponse } from "@/types/ai";

const SAMPLE_EMAIL = `Hi,

I'd like to order 50 units of SKU-4421 at $12 each. Please send invoice to billing@acme.co.
Need delivery by June 15 to 123 Industrial Park, Austin TX.

Thanks,
Sarah Chen
Acme Corp`;

type Props = {
  organizationId: string;
};

export function AiPlayground({ organizationId }: Props) {
  const [channel, setChannel] = useState<"GMAIL" | "WHATSAPP">("GMAIL");
  const [body, setBody] = useState(SAMPLE_EMAIL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AiAnalyzeResponse[] | null>(null);

  async function runAnalysis(task: "full" | "summarize" | "extract" | "reply") {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      if (task === "full") {
        const { results: r } = await aiClient.analyze({
          organizationId,
          tasks: "FULL_ANALYSIS",
          message: { channel, body, subject: channel === "GMAIL" ? "Order inquiry" : undefined },
          replyTone: "professional",
        });
        setResults(r);
      } else if (task === "summarize") {
        const { result } = await aiClient.summarize({
          organizationId,
          message: { channel, body },
        });
        setResults([result]);
      } else if (task === "extract") {
        const data = (await aiClient.extract({
          organizationId,
          type: "all",
          message: { channel, body },
        })) as { results: AiAnalyzeResponse };
        setResults([data.results]);
      } else {
        const { result } = await aiClient.autoReply({
          organizationId,
          message: { channel, body },
          replyTone: "friendly",
        });
        setResults([result]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChannel("GMAIL")}
          className={`rounded-md border px-3 py-1.5 text-sm ${channel === "GMAIL" ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setChannel("WHATSAPP")}
          className={`rounded-md border px-3 py-1.5 text-sm ${channel === "WHATSAPP" ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
        >
          WhatsApp
        </button>
      </div>

      <textarea
        className="min-h-[160px] w-full rounded-lg border border-border bg-background p-3 text-sm font-mono"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Paste message content..."
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["full", "Full analysis"],
            ["summarize", "Summarize"],
            ["extract", "Extract all"],
            ["reply", "Auto-reply"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            disabled={loading}
            onClick={() => runAnalysis(key)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Running…" : label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {results && (
        <pre className="max-h-[480px] overflow-auto rounded-lg border border-border bg-muted p-4 text-xs">
          {JSON.stringify(results, null, 2)}
        </pre>
      )}
    </div>
  );
}
