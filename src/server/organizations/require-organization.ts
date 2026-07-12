import { redirect } from "next/navigation";
import type { Organization, OrganizationMember, User } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireServerSession } from "@/lib/firebase/server-auth";
import { ensureOrganizationForUser } from "./ensure-organization";

function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export type OrganizationContext = {
  user: User;
  organization: Organization;
  membership: OrganizationMember;
};

export async function requireOrganization(): Promise<OrganizationContext> {
  const session = await requireServerSession();

  try {
    // One query covers the common path (user already has a workspace).
    const existing = await prisma.organizationMember.findFirst({
      where: { user: { firebaseUid: session.uid } },
      include: { user: true, organization: true },
      orderBy: { createdAt: "asc" },
    });

    if (existing) {
      return {
        user: existing.user,
        organization: existing.organization,
        membership: existing,
      };
    }

    // Fallback: email match or first-time workspace create.
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
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error("[requireOrganization]", err);
    redirect("/sign-in?error=workspace");
  }
}
