import { prisma } from "@/server/db";
import { interpolateObject } from "../template";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleCreateContact(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );

  const email = String(config.email ?? "") || undefined;
  const phone = String(config.phone ?? "") || undefined;
  const name = String(config.name ?? "") || undefined;

  let contact = null;
  if (email || phone) {
    const orClause = [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ];
    contact = await prisma.contact.findFirst({
      where: {
        organizationId: params.organizationId,
        OR: orClause,
      },
    });
  }

  if (contact) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: {
        name: name ?? contact.name,
        company: String(config.company ?? "") || contact.company,
        source: String(config.source ?? "automation"),
      },
    });
  } else {
    contact = await prisma.contact.create({
      data: {
        organizationId: params.organizationId,
        name,
        email,
        phone,
        company: String(config.company ?? "") || undefined,
        source: String(config.source ?? "automation"),
        metadata: { executionId: params.executionId },
      },
    });
  }

  return {
    output: contact,
    variables: { contactId: contact.id },
  };
}
