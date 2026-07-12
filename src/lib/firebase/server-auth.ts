import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/constants";

const CLEAR_SESSION_PATH = "/api/auth/clear-session";

export async function getServerSession(): Promise<DecodedIdToken | null> {
  if (!isFirebaseAdminConfigured()) return null;

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;

  try {
    return await getAdminAuth().verifySessionCookie(session, true);
  } catch {
    return null;
  }
}

export async function requireServerSession(): Promise<DecodedIdToken> {
  const session = await getServerSession();
  if (session) return session;

  const cookieStore = await cookies();
  if (cookieStore.get(SESSION_COOKIE_NAME)?.value) {
    redirect(CLEAR_SESSION_PATH);
  }

  redirect("/sign-in");
}
