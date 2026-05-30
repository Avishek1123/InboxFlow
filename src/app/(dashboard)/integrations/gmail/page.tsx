import { Suspense } from "react";
import { GmailIntegrationPanel } from "@/features/gmail/components/gmail-integration-panel";

export const metadata = { title: "Gmail" };

export default function GmailIntegrationPage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gmail</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect Gmail to sync messages and trigger automations on every new email.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <GmailIntegrationPanel />
      </Suspense>
    </div>
  );
}
