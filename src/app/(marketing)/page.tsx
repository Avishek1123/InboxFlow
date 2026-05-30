import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

const features = [
  {
    title: "Unified Inbox",
    description: "Gmail and WhatsApp Business messages in one thread view.",
  },
  {
    title: "AI Extraction",
    description: "Turn unstructured messages into structured CRM-ready data.",
  },
  {
    title: "Automations",
    description: "Trigger workflows when messages match your rules.",
  },
  {
    title: "Scheduler",
    description: "Queue and send outbound messages on your timeline.",
  },
];

export default function MarketingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {APP_NAME}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{APP_DESCRIPTION}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/sign-up"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Start free trial
          </a>
          <a
            href="/dashboard"
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted"
          >
            View dashboard
          </a>
        </div>
      </section>

      <section id="features" className="mt-24 grid gap-6 sm:grid-cols-2">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-lg border border-border p-6"
          >
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {feature.description}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
