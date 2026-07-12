import type { WorkflowNodeData } from "@/types/automation";
import type { ExecutionContext } from "@/types/automation";
import { ensureToolsRegistered } from "@/server/agent/tools/register-all";
import { getTool } from "@/server/agent/tool-registry";
import { handleCallOpenai } from "./call-openai";
import { handleCreateContact } from "./create-contact";
import { handleSendEmail } from "./send-email";
import { handleSendMessage } from "./send-message";
import { handleSendWhatsapp } from "./send-whatsapp";
import { handleSendSms, handleSendTwilioWhatsapp } from "./send-twilio";
import { handleStoreData } from "./store-data";
import { handleWebhookRequest } from "./webhook";
import { handleQueryInbox } from "./query-inbox";
import { handleQueryTable } from "./query-table";
import { handleSheetsUpsert } from "./sheets-upsert";
import { handleExtractToTable } from "./extract-to-table";
import { handleMemorySet } from "./memory-set";
import {
  handleCondition,
  handleRequestApproval,
  handleWait,
} from "./control-flow";
import { handleRunAgent } from "./run-agent";

export type HandlerParams = {
  organizationId: string;
  automationId: string;
  executionId: string;
  node: WorkflowNodeData;
  context: ExecutionContext;
};

export type HandlerResult = {
  output: unknown;
  variables?: Record<string, unknown>;
};

const KIND_HANDLERS: Record<
  string,
  (params: HandlerParams) => Promise<HandlerResult>
> = {
  SEND_EMAIL: handleSendEmail,
  SEND_MESSAGE: handleSendMessage,
  SEND_WHATSAPP: handleSendWhatsapp,
  SEND_SMS: handleSendSms,
  SEND_TWILIO_WHATSAPP: handleSendTwilioWhatsapp,
  CREATE_CONTACT: handleCreateContact,
  CALL_OPENAI: handleCallOpenai,
  STORE_DATA: handleStoreData,
  WEBHOOK_REQUEST: handleWebhookRequest,
  QUERY_INBOX: handleQueryInbox,
  QUERY_TABLE: handleQueryTable,
  SHEETS_UPSERT: handleSheetsUpsert,
  EXTRACT_TO_TABLE: handleExtractToTable,
  MEMORY_SET: handleMemorySet,
  REQUEST_APPROVAL: handleRequestApproval,
  CONDITION: handleCondition,
  WAIT: handleWait,
  RUN_AGENT: handleRunAgent,
};

export async function executeAction(
  params: HandlerParams
): Promise<HandlerResult> {
  ensureToolsRegistered();

  const byKind = KIND_HANDLERS[params.node.kind];
  if (byKind) return byKind(params);

  const tool = getTool(params.node.kind);
  if (tool) return tool.execute(params);

  throw new Error(`Unknown action: ${params.node.kind}`);
}

export { ApprovalRequiredError } from "./control-flow";
