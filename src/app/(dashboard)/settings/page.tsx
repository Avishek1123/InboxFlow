import { AppearanceSettings } from "@/components/theme/appearance-settings";
import { ReplayTourSettings } from "@/features/settings/components/replay-tour-settings";
import { RevokeAccessSettings } from "@/features/settings/components/revoke-access-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Organization and account preferences.
        </p>
      </div>
      <AppearanceSettings />
      <ReplayTourSettings />
      <RevokeAccessSettings />
    </div>
  );
}
