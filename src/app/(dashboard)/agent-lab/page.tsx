import { AgentLabPanel } from "@/features/agent-lab";

export const metadata = { title: "Agent Lab" };

export default function AgentLabPage() {
  return (
    <div className="w-full pb-10">
      <AgentLabPanel />
    </div>
  );
}
