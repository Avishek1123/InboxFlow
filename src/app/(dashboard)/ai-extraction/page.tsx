import { AiPlayground } from "@/features/ai-extraction/components/ai-playground";
import { requireOrganization } from "@/server/organizations/require-organization";

export default async function AiExtractionPage() {
  const { organization } = await requireOrganization();

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Extraction</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Multi-provider AI (Groq → Gemini → OpenRouter) with summarization,
          structured extraction, sentiment, intent, and auto-replies.
        </p>
      </div>

      <section className="rounded-lg border border-border p-6">
        <h2 className="text-sm font-medium">Playground</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure API keys in <code className="rounded bg-muted px-1">.env</code>{" "}
          — never commit secrets to git.
        </p>
        <div className="mt-4">
          <AiPlayground organizationId={organization.id} />
        </div>
      </section>
    </div>
  );
}
