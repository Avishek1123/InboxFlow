export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 animate-pulse pt-2">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded-full bg-muted" />
        <div className="h-9 w-3/4 max-w-md rounded-lg bg-muted" />
        <div className="h-4 w-full max-w-lg rounded-full bg-muted/70" />
      </div>
      <div className="rounded-2xl border border-border p-6">
        <div className="h-4 w-28 rounded-full bg-muted" />
        <div className="mt-4 h-28 rounded-xl bg-muted/60" />
        <div className="mt-4 h-11 rounded-xl bg-muted" />
      </div>
      <p className="text-center text-xs text-muted-foreground">Loading workspace…</p>
    </div>
  );
}
