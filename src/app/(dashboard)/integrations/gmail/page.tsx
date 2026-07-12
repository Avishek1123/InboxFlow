import { Suspense } from "react";
import { GmailIcon } from "@/components/icons/gmail-icon";
import { GmailIntegrationPanel } from "@/features/gmail/components/gmail-integration-panel";

export const metadata = { title: "Gmail" };

export default function GmailIntegrationPage() {
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
          <GmailIcon size={26} />
        </span>
        <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gmail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Gmail to sync messages and trigger automations on every new email.
        </p>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <GmailIntegrationPanel />
      </Suspense>
    </div>
  );
}
