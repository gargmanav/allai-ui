import { CheckCircle, FileText, Send, Clock, Calendar, Wrench, CircleCheck, Receipt, Eye } from "lucide-react";

interface UnifiedLifecycleTrackerProps {
  caseStatus: string;
  quoteStatus?: string | null;
  scheduledDate?: string | null;
  contractorName?: string | null;
}

const SECTIONS = [
  {
    id: "requests",
    label: "Requests",
    steps: [
      { id: "new", label: "New", icon: FileText },
      { id: "reviewing", label: "Reviewing", icon: Eye },
    ],
  },
  {
    id: "quotes",
    label: "Quotes",
    steps: [
      { id: "draft", label: "Draft", icon: FileText },
      { id: "sent", label: "Sent", icon: Send },
    ],
  },
  {
    id: "jobs",
    label: "Jobs",
    steps: [
      { id: "awaiting", label: "Awaiting", icon: Clock },
      { id: "scheduled", label: "Scheduled", icon: Calendar },
      { id: "in_progress", label: "In Progress", icon: Wrench },
      { id: "completed", label: "Completed", icon: CircleCheck },
    ],
  },
  {
    id: "invoices",
    label: "Invoices",
    steps: [
      { id: "invoice", label: "Soon", icon: Receipt },
    ],
  },
];

const ALL_STEPS = SECTIONS.flatMap((s, sIdx) =>
  s.steps.map((step, stepIdx) => ({ ...step, sectionId: s.id, sectionIdx: sIdx }))
);

function getActiveStepIndex(caseStatus: string, quoteStatus?: string | null): number {
  const cs = caseStatus;
  const qs = (quoteStatus || "").toLowerCase();

  if (["Resolved", "Completed", "Closed"].includes(cs)) return 7;
  if (cs === "In Progress") return 6;
  if (cs === "Scheduled" || cs === "Confirmed" || cs === "Needs Confirmation") return 5;
  if ((cs === "In Review" || cs === "Pending") && qs === "approved") return 4;
  if (qs === "sent" || qs === "awaiting_response") return 3;
  if (qs === "draft") return 2;
  if (cs === "In Review" || cs === "Pending") return 1;
  return 0;
}

function getStatusMessage(stepIndex: number, contractorName?: string | null, scheduledDate?: string | null): string {
  switch (stepIndex) {
    case 0: return "Request submitted — waiting for contractor";
    case 1: return contractorName ? `${contractorName} is reviewing your request` : "A contractor is reviewing your request";
    case 2: return contractorName ? `${contractorName} is preparing a quote` : "Quote is being drafted";
    case 3: return "Quote sent — awaiting your review";
    case 4: return contractorName ? `${contractorName} will schedule your job soon` : "Awaiting scheduling from contractor";
    case 5: {
      if (scheduledDate) {
        try {
          const iso = typeof scheduledDate === 'string' ? scheduledDate : new Date(scheduledDate).toISOString();
          const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
          const formatted = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          return `Work scheduled for ${formatted}`;
        } catch { return "Work has been scheduled"; }
      }
      return "Work has been scheduled";
    }
    case 6: return "Work is underway";
    case 7: return "Work complete";
    case 8: return "Invoice coming soon";
    default: return "";
  }
}

interface MiniLifecycleTrackerProps {
  caseStatus: string;
  quoteStatus?: string | null;
}

const MINI_STEPS = [
  { sectionId: "requests", label: "R" },
  { sectionId: "quotes", label: "Q" },
  { sectionId: "jobs", label: "J" },
  { sectionId: "invoices", label: "I" },
];

function getSectionIndex(stepIndex: number): number {
  if (stepIndex <= 1) return 0;
  if (stepIndex <= 3) return 1;
  if (stepIndex <= 7) return 2;
  return 3;
}

function getSectionProgress(stepIndex: number, sectionIdx: number): "complete" | "active" | "future" | "invoice" {
  if (sectionIdx === 3) return "invoice";
  const currentSection = getSectionIndex(stepIndex);
  if (sectionIdx < currentSection) return "complete";
  if (sectionIdx === currentSection) return "active";
  return "future";
}

export function MiniLifecycleTracker({ caseStatus, quoteStatus }: MiniLifecycleTrackerProps) {
  const activeStepIndex = getActiveStepIndex(caseStatus, quoteStatus);
  const currentSection = getSectionIndex(activeStepIndex);

  return (
    <div className="flex items-center gap-[2px] w-full max-w-[72px] mx-auto mt-1">
      {MINI_STEPS.map((step, idx) => {
        const progress = getSectionProgress(activeStepIndex, idx);
        const isInvoice = step.sectionId === "invoices";

        return (
          <div key={step.sectionId} className="flex items-center" style={{ flex: idx === 2 ? 2 : 1 }}>
            {idx > 0 && (
              <div
                className="h-[1.5px] flex-shrink-0"
                style={{
                  width: "3px",
                  background: progress === "complete" || (progress === "active" && idx <= currentSection)
                    ? "rgba(139, 92, 246, 0.4)"
                    : "rgba(148, 163, 184, 0.3)",
                }}
              />
            )}
            <div
              className="flex-1 h-[3px] rounded-full"
              style={{
                background: isInvoice
                  ? "rgba(148, 163, 184, 0.15)"
                  : progress === "complete"
                  ? "linear-gradient(90deg, rgba(139, 92, 246, 0.7), rgba(139, 92, 246, 0.5))"
                  : progress === "active"
                  ? "linear-gradient(90deg, rgba(139, 92, 246, 0.6), rgba(139, 92, 246, 0.25))"
                  : "rgba(148, 163, 184, 0.2)",
                boxShadow: progress === "active" ? "0 0 4px rgba(139, 92, 246, 0.3)" : "none",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function UnifiedLifecycleTracker({ caseStatus, quoteStatus, scheduledDate, contractorName }: UnifiedLifecycleTrackerProps) {
  const activeStepIndex = getActiveStepIndex(caseStatus, quoteStatus);
  const totalSteps = ALL_STEPS.length;

  return (
    <div
      className="rounded-2xl p-3 pb-2.5 border border-violet-200/40"
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.04), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,248,255,0.92))",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        boxShadow:
          "inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 16px rgba(139, 92, 246, 0.06)",
      }}
    >
      {/* Title */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
          <CheckCircle className="h-2.5 w-2.5 text-white" />
        </div>
        <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">
          Lifecycle
        </span>
      </div>

      {/* Sections with steps */}
      <div className="flex items-stretch gap-0">
        {SECTIONS.map((section, sIdx) => {
          const sectionStartGlobal = ALL_STEPS.findIndex(s => s.sectionId === section.id);
          const isInvoice = section.id === "invoices";
          const isSectionActive = activeStepIndex >= sectionStartGlobal && activeStepIndex < sectionStartGlobal + section.steps.length;
          const isSectionPast = activeStepIndex >= sectionStartGlobal + section.steps.length;

          return (
            <div key={section.id} className="flex items-stretch" style={{ flex: section.steps.length }}>
              {/* Vertical dashed divider between sections */}
              {sIdx > 0 && (
                <div className="flex items-center px-0.5">
                  <div
                    className="w-px h-full border-l border-dashed"
                    style={{
                      borderColor: isSectionPast ? "rgba(139, 92, 246, 0.3)" : "rgba(148, 163, 184, 0.4)",
                      minHeight: "44px",
                    }}
                  />
                </div>
              )}

              {/* Section content */}
              <div className="flex-1 flex flex-col items-center">
                {/* Section header */}
                <div className="mb-1.5">
                  <span
                    className={`text-[8px] font-bold uppercase tracking-[0.08em] ${
                      isInvoice
                        ? "text-slate-300"
                        : isSectionPast
                        ? "text-violet-500"
                        : isSectionActive
                        ? "text-violet-600"
                        : "text-slate-400"
                    }`}
                  >
                    {section.label}
                  </span>
                </div>

                {/* Steps within this section */}
                <div className="relative flex items-start w-full">
                  {section.steps.map((step, stepIdx) => {
                    const globalIdx = sectionStartGlobal + stepIdx;
                    const Icon = step.icon;
                    const isComplete = globalIdx < activeStepIndex;
                    const isCurrent = globalIdx === activeStepIndex;

                    return (
                      <div key={step.id} className="flex-1 flex flex-col items-center relative z-10">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ${
                            isInvoice
                              ? "bg-slate-50 border border-dashed border-slate-300"
                              : isComplete
                              ? "bg-gradient-to-br from-violet-500 to-violet-600 shadow-sm shadow-violet-200/60"
                              : isCurrent
                              ? "bg-gradient-to-br from-violet-400 to-violet-500 shadow-md shadow-violet-200 ring-[3px] ring-violet-100"
                              : "bg-slate-100 border border-slate-200"
                          }`}
                        >
                          {isComplete && !isInvoice ? (
                            <CheckCircle className="h-2.5 w-2.5 text-white" />
                          ) : (
                            <Icon
                              className={`h-2.5 w-2.5 ${
                                isInvoice
                                  ? "text-slate-300"
                                  : isCurrent
                                  ? "text-white"
                                  : "text-slate-300"
                              }`}
                            />
                          )}
                        </div>
                        <span
                          className={`text-[7px] mt-0.5 font-medium text-center leading-tight ${
                            isInvoice
                              ? "text-slate-300"
                              : isComplete
                              ? "text-violet-500"
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

                  {/* Progress line within section */}
                  {section.steps.length > 1 && (
                    <div className="absolute top-2.5 left-0 right-0 h-[2px] z-0" style={{ marginLeft: "10%", marginRight: "10%" }}>
                      <div className="relative w-full h-full bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-400 to-violet-500 rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: (() => {
                              const stepsInSection = section.steps.length;
                              const localActive = activeStepIndex - sectionStartGlobal;
                              if (localActive < 0) return "0%";
                              if (localActive >= stepsInSection) return "100%";
                              if (localActive === 0) return "0%";
                              return `${(localActive / (stepsInSection - 1)) * 100}%`;
                            })(),
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      <div className="mt-1.5 text-center">
        <p className="text-[10px] text-slate-500">
          {getStatusMessage(activeStepIndex, contractorName, scheduledDate)}
        </p>
      </div>
    </div>
  );
}
