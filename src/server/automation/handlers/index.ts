import type { WorkflowNodeData } from "@/types/automation";
import type { ExecutionContext } from "@/types/automation";
import { handleCallOpenai } from "./call-openai";
import { handleCreateContact } from "./create-contact";
import { handleSendEmail } from "./send-email";
import { handleSendWhatsapp } from "./send-whatsapp";
import { handleStoreData } from "./store-data";
import { handleWebhookRequest } from "./webhook";

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

export async function executeAction(
  params: HandlerParams
): Promise<HandlerResult> {
  switch (params.node.kind) {
    case "SEND_EMAIL":
      return handleSendEmail(params);
    case "SEND_WHATSAPP":
      return handleSendWhatsapp(params);
    case "CREATE_CONTACT":
      return handleCreateContact(params);
    case "CALL_OPENAI":
      return handleCallOpenai(params);
    case "STORE_DATA":
      return handleStoreData(params);
    case "WEBHOOK_REQUEST":
      return handleWebhookRequest(params);
    default:
      throw new Error(`Unknown action: ${params.node.kind}`);
  }
}
