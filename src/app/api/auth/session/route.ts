import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  clearSessionCookie,
  createSessionCookie,
} from "@/lib/firebase/session";

export const runtime = "nodejs";

const ADMIN_SETUP_MESSAGE =
  "Firebase Admin keys missing. Add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to .env (Firebase Console → Project settings → Service accounts → Generate new private key), then restart npm run dev.";

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { error: { code: "ADMIN_NOT_CONFIGURED", message: ADMIN_SETUP_MESSAGE } },
      { status: 503 }
    );
  }

  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "idToken required" } },
        { status: 400 }
      );
    }
    return createSessionCookie(idToken);
  } catch (err) {
    console.error("[auth/session POST]", err);
    return NextResponse.json(
      { error: { code: "SESSION_ERROR", message: "Failed to create session" } },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  return clearSessionCookie();
}
