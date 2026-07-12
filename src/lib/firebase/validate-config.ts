/** Client-side checks so Firebase Web config matches Admin / .env. */
export function validateFirebaseClientConfig(): string[] {
  const issues: string[] = [];
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();

  if (!apiKey) {
    issues.push("NEXT_PUBLIC_FIREBASE_API_KEY is missing.");
  }
  if (!projectId) {
    issues.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing.");
  }
  if (projectId && authDomain && !authDomain.startsWith(`${projectId}.`)) {
    issues.push(
      `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN (${authDomain}) should match project ${projectId} (e.g. ${projectId}.firebaseapp.com).`
    );
  }
  if (
    projectId &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.includes(projectId)
  ) {
    issues.push(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID."
    );
  }

  return issues;
}

export const FIREBASE_PROJECT_STORAGE_KEY = "inboxflow_firebase_project_id";
