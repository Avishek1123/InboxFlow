import { WhatsAppIntegrationPanel } from "@/features/whatsapp";

export const metadata = { title: "WhatsApp" };

export default function WhatsAppIntegrationPage() {
  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect your business WhatsApp in a few steps.
      </p>
      <div className="mt-6">
        <WhatsAppIntegrationPanel />
      </div>
    </div>
  );
}
