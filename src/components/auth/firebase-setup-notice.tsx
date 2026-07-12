export function FirebaseSetupNotice() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm dark:border-amber-900 dark:bg-amber-950">
      <p className="font-medium text-amber-900 dark:text-amber-100">
        Firebase is not configured
      </p>
      <p className="mt-2 text-amber-800 dark:text-amber-200">
        Add Firebase keys to <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.env</code>{" "}
        from the Firebase Console → Project settings → Your apps.
      </p>
      <pre className="mt-3 overflow-x-auto rounded border border-amber-200 bg-white p-3 text-xs dark:border-amber-800 dark:bg-black">
{`NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."`}
      </pre>
      <p className="mt-3 text-amber-800 dark:text-amber-200">
        Enable <strong>Email/Password</strong>, <strong>Google</strong>, and{" "}
        <strong>Phone</strong> in Firebase → Authentication → Sign-in method.
        Phone auth works with Indian +91 numbers.
      </p>
      <p className="mt-3 text-amber-800 dark:text-amber-200">
        If the browser shows <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">accounts:lookup 400</code>,
        clear stale auth: sign out, or DevTools → Application → clear site data for localhost,
        then restart <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">npm run dev</code>.
        Ensure <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">FIREBASE_PROJECT_ID</code> matches{" "}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">NEXT_PUBLIC_FIREBASE_PROJECT_ID</code> (both{" "}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">inboxflow-32f26</code>).
      </p>
    </div>
  );
}
