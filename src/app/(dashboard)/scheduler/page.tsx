import { SchedulerPanel } from "@/features/scheduler/components/scheduler-panel";

export const metadata = { title: "Scheduler" };

export default function SchedulerPage() {
  return (
    <div className="w-full pb-10">
      <SchedulerPanel />
    </div>
  );
}
