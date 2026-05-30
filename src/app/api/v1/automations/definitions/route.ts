import { apiSuccess } from "@/lib/api-response";
import {
  ACTION_DEFINITIONS,
  TRIGGER_DEFINITIONS,
} from "@/server/automation/definitions";

export async function GET() {
  return apiSuccess({
    triggers: TRIGGER_DEFINITIONS,
    actions: ACTION_DEFINITIONS,
  });
}
