import { redirect } from "next/navigation";
import type { Organization, OrganizationMember, User } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireServerSession } from "@/lib/firebase/server-auth";
import { syncUserToDatabase } from "@/lib/firebase/session";
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

    let user = await prisma.user.findUnique({
      where: { firebaseUid: session.uid },
    });

    if (!user && session.email) {
      user = await prisma.user.findFirst({
        where: { email: session.email },
      });
    }

    // Session cookie can exist even if DB sync failed during sign-in — repair it.
    if (!user) {
      user = await syncUserToDatabase(session);
    }

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
