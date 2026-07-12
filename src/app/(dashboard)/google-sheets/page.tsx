import { GoogleSheetsSection } from "@/features/google-sheets";

export const metadata = { title: "Google Sheets" };

export default function GoogleSheetsPage() {
  return (
    <div className="w-full space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Google Sheets</h1>
      <p className="text-sm text-muted-foreground">
        Turn a dashboard AI table into a live Google Sheet — one click, no scripts to copy.
      </p>
      <div className="mt-6">
        <GoogleSheetsSection />
      </div>
    </div>
  );
}
