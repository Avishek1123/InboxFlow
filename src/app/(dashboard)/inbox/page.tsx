import { UnifiedInbox } from "@/features/inbox/components/unified-inbox";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Messages matching your Gmail trigger filters (starred, important, inbox,
          etc.)
        </p>
      </div>
      <UnifiedInbox />
    </div>
  );
}
