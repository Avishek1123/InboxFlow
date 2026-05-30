import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export function AdminSetupNotice() {
  if (isFirebaseAdminConfigured()) return null;

  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
      <p className="font-medium text-red-900 dark:text-red-100">
        Server session not configured — dashboard won&apos;t work after login
      </p>
      <p className="mt-2 text-red-800 dark:text-red-200">
        Add Firebase Admin keys to <code className="rounded bg-red-100 px-1 dark:bg-red-900">.env</code>:
        Firebase Console → <strong>Project settings</strong> →{" "}
        <strong>Service accounts</strong> → <strong>Generate new private key</strong>
      </p>
      <pre className="mt-2 overflow-x-auto rounded border border-red-200 bg-white p-2 text-xs dark:border-red-800 dark:bg-black">
{`FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@inboxflow-32f26.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`}
      </pre>
      <p className="mt-2 text-red-800 dark:text-red-200">
        Restart <code className="rounded bg-red-100 px-1 dark:bg-red-900">npm run dev</code> after saving.
      </p>
    </div>
  );
}
