import type { User } from "@prisma/client";
import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/server/db";

function slugFromUser(user: User): string {
  const base = user.email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 24);
  const suffix = (user.firebaseUid ?? user.id).slice(0, 8);
  return `${base || "workspace"}-${suffix}`;
}

function orgNameFromUser(user: User): string {
  if (user.firstName) return `${user.firstName}'s Workspace`;
  const local = user.email.split("@")[0];
  return `${local}'s Workspace`;
}

export async function ensureOrganizationForUser(user: User) {
  const existing = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing.organization;

  const slug = slugFromUser(user);
  const name = orgNameFromUser(user);

  return prisma.$transaction(async (tx) => {
    const org =
      (await tx.organization.findUnique({ where: { slug } })) ??
      (await tx.organization.create({
        data: { name, slug },
      }));

    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        role: OrganizationRole.OWNER,
      },
      update: {},
    });

    return org;
  });
}
