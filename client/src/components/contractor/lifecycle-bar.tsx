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
      { id: "reviewing", label: "Reviewing", icon: Eye },
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
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-slate-700/40 rounded-2xl shadow-lg p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <CheckCircle2 className="h-4 w-4 text-violet-500" />
        <span className="text-xs font-semibold tracking-widest text-slate-500 dark:text-slate-400 uppercase">
          Lifecycle
        </span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-start gap-0 min-w-max">
          {STAGE_GROUPS.map((group, groupIndex) => {
            const isActiveGroup = activeGroupId === group.id;

            return (
              <div key={group.id} className="flex items-start">
                {groupIndex > 0 && (
                  <div className="flex items-center self-stretch px-3">
                    <div className="w-px h-12 bg-slate-200 dark:bg-slate-700" />
                  </div>
                )}

                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "text-[10px] font-semibold tracking-wider mb-2",
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
                                "w-5 h-px",
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
                              "flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all group",
                              isDisabled
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            )}
                          >
                            <div className="relative">
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                                  isActive
                                    ? "bg-violet-500 shadow-md shadow-violet-200 dark:shadow-violet-900/50"
                                    : isDisabled
                                      ? "bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600"
                                      : "bg-slate-100 dark:bg-slate-800"
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "h-3.5 w-3.5",
                                    isActive
                                      ? "text-white"
                                      : "text-slate-400 dark:text-slate-500"
                                  )}
                                />
                              </div>
                              {count > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-violet-500 text-white text-[10px] font-bold leading-none px-1">
                                  {count > 99 ? "99+" : count}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-[10px] font-medium leading-tight whitespace-nowrap",
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

      {statusMessage && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm text-muted-foreground text-center">{statusMessage}</p>
        </div>
      )}
    </div>
  );
}
