import { registerTool } from "../tool-registry";
import { handleCallOpenai } from "@/server/automation/handlers/call-openai";
import { handleCreateContact } from "@/server/automation/handlers/create-contact";
import { handleSendEmail } from "@/server/automation/handlers/send-email";
import { handleSendMessage } from "@/server/automation/handlers/send-message";
import { handleSendWhatsapp } from "@/server/automation/handlers/send-whatsapp";
import {
  handleSendSms,
  handleSendTwilioWhatsapp,
} from "@/server/automation/handlers/send-twilio";
import { handleStoreData } from "@/server/automation/handlers/store-data";
import { handleWebhookRequest } from "@/server/automation/handlers/webhook";
import { handleQueryInbox } from "@/server/automation/handlers/query-inbox";
import { handleQueryTable } from "@/server/automation/handlers/query-table";
import { handleSheetsUpsert } from "@/server/automation/handlers/sheets-upsert";
import { handleExtractToTable } from "@/server/automation/handlers/extract-to-table";
import { handleMemorySet } from "@/server/automation/handlers/memory-set";

let registered = false;

export function ensureToolsRegistered() {
  if (registered) return;
  registered = true;

  registerTool({
    name: "gmail.sendEmail",
    actionKind: "SEND_EMAIL",
    description: "Send an email via connected Gmail",
    sideEffect: "send",
    requiresApproval: true,
    inputSchema: { to: "string", subject: "string", body: "string" },
    execute: handleSendEmail,
  });

  registerTool({
    name: "whatsapp.sendMessage",
    actionKind: "SEND_WHATSAPP",
    description: "Send a WhatsApp text via Meta Cloud API",
    sideEffect: "send",
    requiresApproval: true,
    inputSchema: { to: "string", body: "string" },
    execute: handleSendWhatsapp,
  });

  registerTool({
    name: "messages.send",
    actionKind: "SEND_MESSAGE",
    description: "Send WhatsApp or SMS (pick messagingOption)",
    sideEffect: "send",
    requiresApproval: true,
    inputSchema: {
      messagingOption: "meta_whatsapp|twilio_sms|twilio_whatsapp",
      to: "string",
      body: "string",
    },
    execute: handleSendMessage,
  });

  registerTool({
    name: "twilio.sendSMS",
    actionKind: "SEND_SMS",
    description: "Send SMS via Twilio",
    sideEffect: "send",
    requiresApproval: true,
    inputSchema: { to: "string", body: "string" },
    execute: handleSendSms,
  });

  registerTool({
    name: "twilio.sendWhatsApp",
    actionKind: "SEND_TWILIO_WHATSAPP",
    description: "Send WhatsApp via Twilio",
    sideEffect: "send",
    requiresApproval: true,
    inputSchema: { to: "string", body: "string" },
    execute: handleSendTwilioWhatsapp,
  });

  registerTool({
    name: "contacts.upsert",
    actionKind: "CREATE_CONTACT",
    description: "Create or update a CRM contact",
    sideEffect: "write",
    inputSchema: {
      name: "string?",
      email: "string?",
      phone: "string?",
      company: "string?",
    },
    execute: handleCreateContact,
  });

  registerTool({
    name: "ai.analyze",
    actionKind: "CALL_OPENAI",
    description: "Run an AI analysis task on the trigger message",
    sideEffect: "read",
    inputSchema: { task: "string", replyTone: "string?" },
    execute: handleCallOpenai,
  });

  registerTool({
    name: "memory.set",
    actionKind: "STORE_DATA",
    description: "Store a key/value in workflow memory",
    sideEffect: "write",
    inputSchema: { key: "string", valueTemplate: "string" },
    execute: handleStoreData,
  });

  registerTool({
    name: "webhook.call",
    actionKind: "WEBHOOK_REQUEST",
    description: "Call an external HTTP webhook",
    sideEffect: "write",
    inputSchema: { url: "string", method: "string?", bodyTemplate: "string?" },
    execute: handleWebhookRequest,
  });

  registerTool({
    name: "inbox.searchMessages",
    actionKind: "QUERY_INBOX",
    description: "Search recent inbox messages in this workspace",
    sideEffect: "read",
    inputSchema: { query: "string?", channel: "GMAIL|WHATSAPP|SMS?", limit: "number?" },
    execute: handleQueryInbox,
  });

  registerTool({
    name: "tables.query",
    actionKind: "QUERY_TABLE",
    description: "Query rows from an extraction data table",
    sideEffect: "read",
    inputSchema: { tableId: "string?", tableName: "string?", limit: "number?" },
    execute: handleQueryTable,
  });

  registerTool({
    name: "sheets.upsertRow",
    actionKind: "SHEETS_UPSERT",
    description: "Append/upsert extracted values toward a linked Google Sheet export",
    sideEffect: "write",
    inputSchema: { exportId: "string?", tableId: "string?", values: "object" },
    execute: handleSheetsUpsert,
  });

  registerTool({
    name: "ai.extractToTable",
    actionKind: "EXTRACT_TO_TABLE",
    description: "AI-extract the current message into a custom table",
    sideEffect: "write",
    inputSchema: { tableId: "string?", tableName: "string?", messageId: "string?" },
    execute: handleExtractToTable,
  });

  registerTool({
    name: "memory.setCustomerFact",
    actionKind: "MEMORY_SET",
    description: "Save a durable customer memory fact",
    sideEffect: "write",
    inputSchema: { key: "string", value: "string", contactId: "string?" },
    execute: handleMemorySet,
  });
}

ensureToolsRegistered();
