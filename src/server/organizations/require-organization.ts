import { redirect } from "next/navigation";
import type { Organization, OrganizationMember, User } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireServerSession } from "@/lib/firebase/server-auth";
import { ensureOrganizationForUser } from "./ensure-organization";

export type OrganizationContext = {
  user: User;
  organization: Organization;
  membership: OrganizationMember;
};

export async function requireOrganization(): Promise<OrganizationContext> {
  const session = await requireServerSession();

  let user = await prisma.user.findUnique({
    where: { firebaseUid: session.uid },
  });

  if (!user && session.email) {
    user = await prisma.user.findFirst({
      where: { email: session.email },
    });
  }

  if (!user) redirect("/sign-in");

  const organization = await ensureOrganizationForUser(user);

  const membership = await prisma.organizationMember.findUniqueOrThrow({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
  });

  return { user, organization, membership };
}
