import { TwilioIntegrationPanel } from "@/features/twilio/components/twilio-integration-panel";

export const metadata = { title: "Twilio" };

export default function TwilioIntegrationPage() {
  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight">Twilio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        SMS and WhatsApp via Twilio — alternative to Meta WhatsApp.
      </p>
      <div className="mt-6">
        <TwilioIntegrationPanel />
      </div>
    </div>
  );
}
