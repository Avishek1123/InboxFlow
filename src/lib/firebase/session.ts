import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/firebase/constants";
import { prisma } from "@/server/db";
import { ensureOrganizationForUser } from "@/server/organizations/ensure-organization";

export async function createSessionCookie(idToken: string) {
  const auth = getAdminAuth();
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  const decoded = await auth.verifySessionCookie(sessionCookie, true);
  try {
    await syncUserToDatabase(decoded);
  } catch (err) {
    console.error("[auth] DB sync failed:", err);
    return NextResponse.json(
      {
        error: {
          code: "DB_SYNC_FAILED",
          message:
            "Signed in, but could not create your workspace. Check DATABASE_URL / migrations.",
        },
      },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionCookie,
    maxAge: SESSION_MAX_AGE_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}

export async function clearSessionCookie() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}

export async function syncUserToDatabase(decoded: DecodedIdToken) {
  const email = decoded.email ?? `${decoded.uid}@firebase.local`;
  const phone = decoded.phone_number ?? undefined;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { firebaseUid: decoded.uid },
        ...(decoded.email ? [{ email: decoded.email }] : []),
      ],
    },
  });

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        firebaseUid: decoded.uid,
        email,
        phone: phone ?? existing.phone,
        firstName: decoded.name?.split(" ")[0] ?? existing.firstName,
        lastName:
          decoded.name?.split(" ").slice(1).join(" ") || existing.lastName,
        imageUrl: decoded.picture ?? existing.imageUrl,
      },
    });
    await ensureOrganizationForUser(user);
    return user;
  }

  const user = await prisma.user.create({
    data: {
      firebaseUid: decoded.uid,
      email,
      phone,
      firstName: decoded.name?.split(" ")[0],
      lastName: decoded.name?.split(" ").slice(1).join(" ") || undefined,
      imageUrl: decoded.picture,
    },
  });
  await ensureOrganizationForUser(user);
  return user;
}
