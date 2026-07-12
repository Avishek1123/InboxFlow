"use client";

import type { ReactNode } from "react";
import { MESSAGING_OPTIONS } from "@/lib/messaging/channels";
import { GmailTriggerConfig } from "./gmail-trigger-config";
import { SheetTableNodeConfig } from "./sheet-table-node-config";
import type { WorkflowNodeData } from "@/types/automation";

type Props = {
  node: WorkflowNodeData;
  nodeType: "trigger" | "action";
  onChange: (config: WorkflowNodeData["config"]) => void;
  onFieldChange: (key: string, value: unknown) => void;
};

export function NodeConfigPanel({
  node,
  nodeType,
  onChange,
  onFieldChange,
}: Props) {
  const { kind, config } = node;

  if (kind === "NEW_GMAIL_EMAIL") {
    return (
      <GmailTriggerConfig config={config} onChange={onChange} />
    );
  }

  if (kind === "MESSAGE_RECEIVED" || kind === "SEND_MESSAGE") {
    return (
      <div className="space-y-3">
        <Field label="Provider">
          <select
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={String(config.messagingOption ?? "meta_whatsapp")}
            onChange={(e) => onFieldChange("messagingOption", e.target.value)}
          >
            {MESSAGING_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {kind === "SEND_MESSAGE" && (
          <>
            <Field label="To">
              <input
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
                value={String(config.to ?? "")}
                onChange={(e) => onFieldChange("to", e.target.value)}
                placeholder="{{trigger.from}}"
              />
            </Field>
            <Field label="Message">
              <textarea
                className="min-h-[72px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={String(config.body ?? "")}
                onChange={(e) => onFieldChange("body", e.target.value)}
              />
            </Field>
          </>
        )}
        <p className="text-[10px] text-muted-foreground">
          Connect the matching integration under Channels before running.
        </p>
      </div>
    );
  }

  if (kind === "SEND_EMAIL") {
    return (
      <div className="space-y-3">
        <TextField label="To" configKey="to" config={config} onChange={onFieldChange} />
        <TextField label="Subject" configKey="subject" config={config} onChange={onFieldChange} />
        <TextAreaField label="Body" configKey="body" config={config} onChange={onFieldChange} />
      </div>
    );
  }

  if (kind === "SCHEDULED_TIME") {
    return (
      <div className="space-y-3">
        <TextField
          label="Cron expression"
          configKey="cronExpression"
          config={config}
          onChange={onFieldChange}
          placeholder="0 9 * * *"
        />
        <TextField
          label="Timezone"
          configKey="timezone"
          config={config}
          onChange={onFieldChange}
          placeholder="UTC"
        />
      </div>
    );
  }

  if (kind === "WEBHOOK_REQUEST") {
    return (
      <div className="space-y-3">
        <TextField label="URL" configKey="url" config={config} onChange={onFieldChange} />
        <Field label="Method">
          <select
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={String(config.method ?? "POST")}
            onChange={(e) => onFieldChange("method", e.target.value)}
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
          </select>
        </Field>
        <TextAreaField
          label="Body template"
          configKey="bodyTemplate"
          config={config}
          onChange={onFieldChange}
        />
      </div>
    );
  }

  if (kind === "SHEETS_UPSERT") {
    return (
      <SheetTableNodeConfig
        mode="sheets"
        exportId={String(config.exportId ?? "")}
        tableId={String(config.tableId ?? "")}
        messageId={String(config.messageId ?? "{{trigger.messageId}}")}
        onFieldChange={onFieldChange}
      />
    );
  }

  if (kind === "EXTRACT_TO_TABLE") {
    return (
      <SheetTableNodeConfig
        mode="extract"
        tableId={String(config.tableId ?? "")}
        messageId={String(config.messageId ?? "{{trigger.messageId}}")}
        onFieldChange={onFieldChange}
      />
    );
  }

  if (kind === "QUERY_TABLE") {
    return (
      <SheetTableNodeConfig
        mode="table"
        tableId={String(config.tableId ?? "")}
        onFieldChange={onFieldChange}
      />
    );
  }

  if (kind === "RUN_AGENT") {
    return (
      <div className="space-y-3">
        <TextAreaField label="Goal" configKey="goal" config={config} onChange={onFieldChange} placeholder="Describe what the agent should do…" />
        <TextField label="Max steps" configKey="maxSteps" config={config} onChange={onFieldChange} placeholder="6" />
        <Field label="Allow send tools">
          <select
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={config.allowSendTools === true ? "true" : "false"}
            onChange={(e) =>
              onFieldChange("allowSendTools", e.target.value === "true")
            }
          >
            <option value="false">No (safer — draft/read/write only)</option>
            <option value="true">Yes (can send email/WhatsApp/SMS)</option>
          </select>
        </Field>
        <p className="text-[10px] text-muted-foreground">
          The agent picks tools automatically (inbox, tables, sheets, AI, memory).
        </p>
      </div>
    );
  }

  if (kind === "REQUEST_APPROVAL") {
    return (
      <div className="space-y-3">
        <TextAreaField
          label="Approval summary"
          configKey="summary"
          config={config}
          onChange={onFieldChange}
        />
        <p className="text-[10px] text-muted-foreground">
          Workflow pauses until someone approves it under Agent Lab → Approvals.
        </p>
      </div>
    );
  }

  if (kind === "CONDITION") {
    return (
      <div className="space-y-3">
        <TextField label="Left value" configKey="left" config={config} onChange={onFieldChange} />
        <Field label="Operator">
          <select
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={String(config.operator ?? "equals")}
            onChange={(e) => onFieldChange("operator", e.target.value)}
          >
            <option value="equals">equals</option>
            <option value="not_equals">not equals</option>
            <option value="contains">contains</option>
            <option value="gt">greater than</option>
            <option value="gte">greater or equal</option>
            <option value="lt">less than</option>
            <option value="lte">less or equal</option>
            <option value="truthy">truthy</option>
          </select>
        </Field>
        <TextField label="Right value" configKey="right" config={config} onChange={onFieldChange} />
        <p className="text-[10px] text-muted-foreground">
          When false, remaining steps are skipped (unless skipWhenFalse is false).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(config).map(([key, val]) => (
        <label key={key} className="block text-xs">
          <span className="text-muted-foreground">{key}</span>
          <input
            className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            value={
              typeof val === "object" ? JSON.stringify(val) : String(val ?? "")
            }
            onChange={(e) => onFieldChange(key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function TextField({
  label,
  configKey,
  config,
  onChange,
  placeholder,
}: {
  label: string;
  configKey: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
        value={String(config[configKey] ?? "")}
        placeholder={placeholder}
        onChange={(e) => onChange(configKey, e.target.value)}
      />
    </Field>
  );
}

function TextAreaField({
  label,
  configKey,
  config,
  onChange,
  placeholder,
}: {
  label: string;
  configKey: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <textarea
        className="min-h-[72px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        value={String(config[configKey] ?? "")}
        placeholder={placeholder}
        onChange={(e) => onChange(configKey, e.target.value)}
      />
    </Field>
  );
}
