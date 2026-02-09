import { FileText, Eye, FileEdit, Send, Clock, Calendar, Wrench, CheckCircle, Receipt, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LifecycleBarProps {
  activeStage: string;
  onStageClick: (stageId: string) => void;
  counts: Record<string, number>;
  statusMessage?: string;
}

interface Stage {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

interface StageGroup {
  id: string;
  label: string;
  stages: Stage[];
  comingSoon?: boolean;
}

const STAGE_GROUPS: StageGroup[] = [
  {
    id: "requests",
    label: "REQUESTS",
    stages: [
      { id: "new", label: "New", icon: FileText },
    ],
  },
  {
    id: "quotes",
    label: "QUOTES",
    stages: [
      { id: "draft", label: "Draft", icon: FileEdit },
      { id: "sent", label: "Sent", icon: Send },
    ],
  },
  {
    id: "jobs",
    label: "JOBS",
    stages: [
      { id: "awaiting", label: "Awaiting", icon: Clock },
      { id: "scheduled", label: "Scheduled", icon: Calendar },
      { id: "in_progress", label: "In Progress", icon: Wrench },
      { id: "completed", label: "Completed", icon: CheckCircle },
    ],
  },
  {
    id: "invoices",
    label: "INVOICES",
    comingSoon: true,
    stages: [
      { id: "invoices_soon", label: "Soon", icon: Receipt, disabled: true },
    ],
  },
];

const ALL_STAGE_IDS = STAGE_GROUPS.flatMap(g => g.stages.map(s => s.id));

function getActiveGroupId(activeStage: string): string | null {
  for (const group of STAGE_GROUPS) {
    if (group.stages.some(s => s.id === activeStage)) {
      return group.id;
    }
  }
  return null;
}

export function LifecycleBar({ activeStage, onStageClick, counts, statusMessage }: LifecycleBarProps) {
  const activeGroupId = getActiveGroupId(activeStage);

  return (
    <div className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/40 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1 mb-1.5">
        <CheckCircle2 className="h-3 w-3 text-violet-500" />
        <span className="text-[9px] font-semibold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
          Lifecycle
        </span>
        {statusMessage && (
          <span className="text-[10px] text-muted-foreground ml-auto">{statusMessage}</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {STAGE_GROUPS.map((group, groupIndex) => {
            const isActiveGroup = activeGroupId === group.id;

            return (
              <div key={group.id} className="flex items-center">
                {groupIndex > 0 && (
                  <div className="flex items-center px-2">
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                  </div>
                )}

                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "text-[9px] font-semibold tracking-wider mb-1",
                      group.comingSoon && "italic",
                      isActiveGroup
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-slate-400 dark:text-slate-500"
                    )}
                  >
                    {group.label}
                  </span>

                  <div className="flex items-center gap-0">
                    {group.stages.map((stage, stageIndex) => {
                      const isActive = activeStage === stage.id;
                      const count = counts[stage.id] || 0;
                      const Icon = stage.icon;
                      const isDisabled = stage.disabled;

                      return (
                        <div key={stage.id} className="flex items-center">
                          {stageIndex > 0 && (
                            <div
                              className={cn(
                                "w-4 h-px",
                                isActive || activeStage === group.stages[stageIndex - 1]?.id
                                  ? "bg-violet-300 dark:bg-violet-600"
                                  : "bg-slate-200 dark:bg-slate-700"
                              )}
                            />
                          )}

                          <button
                            onClick={() => !isDisabled && onStageClick(stage.id)}
                            disabled={isDisabled}
                            className={cn(
                              "flex flex-col items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-all group",
                              isDisabled
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50"
                            )}
                          >
                            <div className="relative">
                              <div
                                className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                                  isActive
                                    ? "bg-violet-500 shadow-sm shadow-violet-200 dark:shadow-violet-900/50"
                                    : isDisabled
                                      ? "bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600"
                                      : "bg-slate-100 dark:bg-slate-800"
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "h-3 w-3",
                                    isActive
                                      ? "text-white"
                                      : "text-slate-400 dark:text-slate-500"
                                  )}
                                />
                              </div>
                              {count > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] flex items-center justify-center rounded-full bg-violet-500 text-white text-[9px] font-bold leading-none px-0.5">
                                  {count > 99 ? "99+" : count}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-[9px] font-medium leading-tight whitespace-nowrap",
                                group.comingSoon && "italic",
                                isActive
                                  ? "text-violet-600 dark:text-violet-400"
                                  : "text-slate-400 dark:text-slate-500"
                              )}
                            >
                              {stage.label}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
