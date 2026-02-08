import { CheckCircle, Clock, Wrench, CircleDot } from "lucide-react";

interface JobProgressTrackerProps {
  status: string;
  scheduledDate?: string | null;
  contractorName?: string;
}

const STEPS = [
  { id: "accepted", label: "Quote Accepted", icon: CheckCircle },
  { id: "scheduled", label: "Scheduled", icon: Clock },
  { id: "in_progress", label: "In Progress", icon: Wrench },
  { id: "completed", label: "Completed", icon: CircleDot },
];

function getActiveStep(status: string): number {
  switch (status) {
    case "In Review":
      return 0;
    case "Scheduled":
    case "Confirmed":
      return 1;
    case "In Progress":
      return 2;
    case "Resolved":
    case "Completed":
    case "Closed":
      return 3;
    default:
      return -1;
  }
}

export function JobProgressTracker({ status, scheduledDate, contractorName }: JobProgressTrackerProps) {
  const activeStep = getActiveStep(status);

  if (activeStep < 0) return null;

  const statusMessages: Record<number, string> = {
    0: contractorName
      ? `${contractorName} is reviewing and will schedule soon`
      : "Awaiting scheduling from your contractor",
    1: scheduledDate
      ? `Work scheduled for ${(() => {
          const iso = typeof scheduledDate === 'string' ? scheduledDate : new Date(scheduledDate).toISOString();
          const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
          return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        })()}`
      : "Work has been scheduled",
    2: "Work is underway",
    3: "Work complete",
  };

  return (
    <div
      className="rounded-2xl p-4 border border-violet-200/40"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.04), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,248,255,0.92))",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        boxShadow:
          "inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 16px rgba(139, 92, 246, 0.06)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
          <CheckCircle className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
          Work Progress
        </span>
      </div>

      <div className="relative flex items-center justify-between px-1">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isComplete = idx < activeStep;
          const isCurrent = idx === activeStep;
          const isFuture = idx > activeStep;

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isComplete
                    ? "bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-200"
                    : isCurrent
                    ? "bg-gradient-to-br from-violet-400 to-violet-500 shadow-lg shadow-violet-200 ring-4 ring-violet-100"
                    : "bg-slate-100 border-2 border-slate-200"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isComplete || isCurrent ? "text-white" : "text-slate-300"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${
                  isComplete
                    ? "text-violet-600"
                    : isCurrent
                    ? "text-violet-700 font-semibold"
                    : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}

        <div className="absolute top-4 left-0 right-0 h-[3px] z-0 mx-8">
          <div className="relative w-full h-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-400 to-violet-500 rounded-full transition-all duration-700 ease-out"
              style={{
                width:
                  activeStep === 0
                    ? "0%"
                    : activeStep === 1
                    ? "33%"
                    : activeStep === 2
                    ? "66%"
                    : "100%",
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="text-xs text-slate-500">{statusMessages[activeStep]}</p>
      </div>
    </div>
  );
}
