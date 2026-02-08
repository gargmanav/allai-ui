import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, startOfWeek, parseISO, isSameDay, isToday, subDays } from "date-fns";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  GripVertical,
  AlertTriangle,
  MapPin,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Zap,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ScheduledJob {
  id: string;
  realId?: string;
  title: string;
  description?: string | null;
  teamId?: string;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  status?: string;
  urgency?: string;
  address?: string | null;
  customerName?: string;
  durationDays?: number;
  isAllDay?: boolean;
  source?: string;
}

interface UnscheduledItem {
  id: string;
  title: string;
  type: "case" | "job" | "quote";
  urgency?: string;
  estimatedValue?: number;
  status?: string;
}

interface Team {
  id: string;
  name: string;
  specialty: string;
  color: string;
}

function DraggableItem({ item }: { item: UnscheduledItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unscheduled-${item.id}`,
    data: { item },
  });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-start gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
        isDragging
          ? "border-violet-300 bg-violet-50 shadow-lg"
          : "border-gray-100 bg-white hover:border-violet-200 hover:bg-violet-50/30"
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-800 truncate">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {item.urgency && item.urgency !== "Low" && (
            <Badge
              variant="outline"
              className={`text-[9px] px-1 py-0 h-4 ${
                item.urgency === "Emergent"
                  ? "border-red-200 text-red-600 bg-red-50"
                  : "border-orange-200 text-orange-600 bg-orange-50"
              }`}
            >
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              {item.urgency}
            </Badge>
          )}
          {item.estimatedValue != null && item.estimatedValue > 0 && (
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
              <DollarSign className="h-2.5 w-2.5" />
              {item.estimatedValue.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DroppableCell({
  id,
  children,
  isOver,
}: {
  id: string;
  children: React.ReactNode;
  isOver?: boolean;
}) {
  const { setNodeRef, isOver: cellIsOver } = useDroppable({ id });
  const active = isOver || cellIsOver;

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[56px] p-0.5 transition-colors ${
        active
          ? "bg-violet-50 border border-dashed border-violet-300"
          : "border border-transparent"
      }`}
    >
      {children}
    </div>
  );
}

function JobCard({
  job,
  team,
  teams,
  spanDays,
}: {
  job: ScheduledJob;
  team?: Team;
  teams: Team[];
  spanDays?: number;
}) {
  const { toast } = useToast();
  const teamColor = team?.color || "#6366f1";

  const canUpdate = job.source === "scheduled_job";
  const updateId = job.realId || job.id;

  const updateTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      return apiRequest("PUT", `/api/scheduled-jobs/${updateId}`, { teamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/team-calendar"] });
      toast({ title: "Team updated" });
    },
    onError: () => {
      toast({ title: "Failed to update team", variant: "destructive" });
    },
  });

  const statusColor =
    job.status === "Completed"
      ? "bg-green-100 text-green-700"
      : job.status === "In Progress"
        ? "bg-blue-100 text-blue-700"
        : job.status === "Scheduled"
          ? "bg-violet-100 text-violet-700"
          : "bg-gray-100 text-gray-600";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-full text-left rounded-md p-1.5 transition-all hover:shadow-sm cursor-pointer group"
          style={{
            borderLeft: `3px solid ${teamColor}`,
            background: "rgba(255,255,255,0.85)",
            gridColumn: spanDays && spanDays > 1 ? `span ${spanDays}` : undefined,
          }}
        >
          <p className="text-[10px] font-medium text-gray-800 truncate leading-tight group-hover:text-violet-700">
            {job.title}
          </p>
          {job.customerName && (
            <p className="text-[9px] text-gray-400 truncate mt-0.5">{job.customerName}</p>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" side="right" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{job.title}</h4>
            {job.customerName && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                <Users className="h-3 w-3" />
                {job.customerName}
              </p>
            )}
          </div>
          {job.address && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.address}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] ${statusColor}`}>{job.status}</Badge>
            {job.scheduledStartAt && (
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(parseISO(job.scheduledStartAt), "MMM d, h:mm a")}
              </span>
            )}
          </div>
          {canUpdate && teams.length > 0 && (
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
                Team Assignment
              </label>
              <Select
                value={job.teamId || ""}
                onValueChange={(val) => updateTeamMutation.mutate(val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Assign team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function InHubSchedule() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hideWeekends, setHideWeekends] = useState(false);
  const [unscheduledOpen, setUnscheduledOpen] = useState(true);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ["/api/teams"] });

  const { data: rawCalendarJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/contractor/team-calendar"],
  });

  const { data: rawScheduledJobs = [] } = useQuery<ScheduledJob[]>({
    queryKey: ["/api/scheduled-jobs"],
  });

  const scheduledJobs: ScheduledJob[] = useMemo(() => {
    const calendarMapped = rawCalendarJobs.map((j: any) => {
      const isJobSource = j.source === "scheduled_job";
      const rawId = String(j.id);
      const realId = isJobSource && rawId.startsWith("job-") ? rawId.slice(4) : rawId;
      return {
        id: rawId,
        realId,
        title: j.title || j.caseName || "Untitled",
        description: j.description,
        teamId: j.teamId || j.team?.id,
        scheduledStartAt: j.scheduledStartAt || j.startTime,
        scheduledEndAt: j.scheduledEndAt || j.endTime,
        status: j.status,
        urgency: j.urgency || j.priority,
        address: j.address || j.location,
        customerName: j.customerName || j.homeownerName,
        durationDays: j.durationDays || 1,
        isAllDay: j.isAllDay,
        source: j.source || "appointment",
      };
    });
    const calendarIds = new Set(calendarMapped.map((j: any) => j.id));
    const fromScheduled = rawScheduledJobs
      .filter((j) => !calendarIds.has(j.id) && !calendarIds.has(`job-${j.id}`))
      .map((j) => ({
        ...j,
        realId: j.id,
        durationDays: j.durationDays || 1,
        source: "scheduled_job",
      }));
    return [...calendarMapped, ...fromScheduled];
  }, [rawCalendarJobs, rawScheduledJobs]);

  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ["/api/contractor/cases"],
  });

  const { data: quotes = [] } = useQuery<any[]>({
    queryKey: ["/api/contractor/quotes"],
  });

  const days = useMemo(() => {
    if (viewMode === "day") {
      return [currentDate];
    }
    const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    if (hideWeekends) {
      return allDays.filter((d) => {
        const day = d.getDay();
        return day !== 0 && day !== 6;
      });
    }
    return allDays;
  }, [viewMode, currentDate, weekStart, hideWeekends]);

  const unscheduledItems: UnscheduledItem[] = useMemo(() => {
    const items: UnscheduledItem[] = [];

    const needsConfirmation = (scheduledJobs || []).filter(
      (j: any) =>
        j.source === "scheduled_job" &&
        (j.status === "In Review" || j.status === "Needs Review" || j.status === "Unscheduled" || j.status === "Needs Confirmation" || j.status === "Pending Approval") &&
        !j.scheduledStartAt
    );
    needsConfirmation.forEach((j: any) => {
      items.push({
        id: j.realId || j.id,
        title: j.title || "Untitled Job",
        type: "job",
        urgency: j.urgency,
        estimatedValue: 0,
        status: j.status,
      });
    });

    const unscheduledCases = (cases || []).filter(
      (c: any) => c.status === "In Review" && !c.scheduledStartAt
    );
    unscheduledCases.forEach((c: any) => {
      items.push({
        id: c.id,
        title: c.title || "Untitled Case",
        type: "case",
        urgency: c.priority === "emergency" ? "Emergent" : c.priority === "high" ? "High" : "Low",
        estimatedValue: c.estimatedCost ? parseFloat(c.estimatedCost) : 0,
        status: c.status,
      });
    });

    const acceptedQuotes = (quotes || []).filter(
      (q: any) => q.status === "Accepted" && !q.scheduledStartAt
    );
    acceptedQuotes.forEach((q: any) => {
      items.push({
        id: q.id,
        title: q.title || "Accepted Quote",
        type: "quote",
        urgency: "Low",
        estimatedValue: q.total ? parseFloat(q.total) : 0,
        status: q.status,
      });
    });

    return items;
  }, [scheduledJobs, cases, quotes]);

  const getJobsForTeamAndDay = (teamId: string, day: Date) => {
    return (scheduledJobs || []).filter((job: ScheduledJob) => {
      if (!job.scheduledStartAt) return false;
      if (teamId === "__unassigned__") {
        if (job.teamId && teams.some((t) => t.id === job.teamId)) return false;
        const jobDate = parseISO(job.scheduledStartAt);
        return isSameDay(jobDate, day);
      }
      if (job.teamId !== teamId) return false;
      const jobDate = parseISO(job.scheduledStartAt);
      return isSameDay(jobDate, day);
    });
  };

  const displayRows: Team[] = useMemo(() => {
    const rows = [...teams];
    const hasUnassigned = (scheduledJobs || []).some(
      (j) => j.scheduledStartAt && (!j.teamId || !teams.some((t) => t.id === j.teamId))
    );
    if (hasUnassigned || teams.length === 0) {
      rows.push({
        id: "__unassigned__",
        name: "Unassigned",
        specialty: "General",
        color: "#94a3b8",
      });
    }
    return rows;
  }, [teams, scheduledJobs]);

  const scheduleMutation = useMutation({
    mutationFn: async ({
      item,
      date,
      teamId,
    }: {
      item: UnscheduledItem;
      date: Date;
      teamId?: string;
    }) => {
      const scheduledStartAt = new Date(date);
      scheduledStartAt.setHours(8, 0, 0, 0);
      const scheduledEndAt = new Date(date);
      scheduledEndAt.setHours(17, 0, 0, 0);

      const payload = {
        scheduledStartAt: scheduledStartAt.toISOString(),
        scheduledEndAt: scheduledEndAt.toISOString(),
        status: "Scheduled",
        ...(teamId ? { teamId } : {}),
      };

      if (item.type === "case" || item.type === "quote") {
        return apiRequest("POST", `/api/scheduled-jobs`, {
          title: item.title,
          ...(item.type === "case" ? { caseId: item.id } : { quoteId: item.id }),
          ...payload,
        });
      }
      return apiRequest("PUT", `/api/scheduled-jobs/${item.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/team-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/quotes"] });
      toast({ title: "Item scheduled", description: "Successfully scheduled to the selected day" });
    },
    onError: () => {
      toast({ title: "Scheduling failed", variant: "destructive" });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as { item: UnscheduledItem } | undefined;
    if (!dragData?.item) return;

    const dropId = over.id as string;
    if (!dropId.startsWith("cell-")) return;

    const parts = dropId.split("-team-");
    const dateStr = parts[0].replace("cell-", "");
    const rawTeamId = parts[1];
    const teamId = rawTeamId === "__unassigned__" ? undefined : rawTeamId;
    const dropDate = parseISO(dateStr);

    scheduleMutation.mutate({ item: dragData.item, date: dropDate, teamId });
  };

  const navigatePrev = () => {
    if (viewMode === "day") {
      setCurrentDate((d) => subDays(d, 1));
    } else {
      setCurrentDate((d) => subDays(d, 7));
    }
  };

  const navigateNext = () => {
    if (viewMode === "day") {
      setCurrentDate((d) => addDays(d, 1));
    } else {
      setCurrentDate((d) => addDays(d, 7));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full">
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-t-xl border-b border-gray-100"
          style={{
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={goToToday}
            >
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-gray-700 ml-1">
              {viewMode === "day"
                ? format(currentDate, "EEEE, MMM d, yyyy")
                : `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-gray-200 overflow-hidden">
              <button
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === "day"
                    ? "bg-violet-100 text-violet-700"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setViewMode("day")}
              >
                Day
              </button>
              <button
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === "week"
                    ? "bg-violet-100 text-violet-700"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setViewMode("week")}
              >
                Week
              </button>
            </div>
            {viewMode === "week" && (
              <button
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  hideWeekends
                    ? "bg-violet-50 border-violet-200 text-violet-700"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setHideWeekends((v) => !v)}
              >
                Hide Weekends
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            className={`transition-all duration-200 border-r border-gray-100 flex-shrink-0 overflow-y-auto ${
              unscheduledOpen ? "w-[220px]" : "w-[40px]"
            }`}
            style={{
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(8px)",
            }}
          >
            <button
              className="w-full flex items-center justify-between px-2.5 py-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wide hover:bg-gray-50"
              onClick={() => setUnscheduledOpen((v) => !v)}
            >
              {unscheduledOpen ? (
                <>
                  <span className="flex items-center gap-1.5">
                    Unscheduled
                    {unscheduledItems.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="h-4 min-w-[16px] px-1 text-[9px] bg-violet-100 text-violet-700"
                      >
                        {unscheduledItems.length}
                      </Badge>
                    )}
                  </span>
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <ChevronDown className="h-3.5 w-3.5 mx-auto" />
              )}
            </button>

            {unscheduledOpen && (
              <div className="px-2 pb-2 space-y-1.5">
                {unscheduledItems.length === 0 ? (
                  <p className="text-[10px] text-gray-400 text-center py-4">
                    All items are scheduled
                  </p>
                ) : (
                  unscheduledItems.map((item) => (
                    <DraggableItem key={item.id} item={item} />
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <div
              className="sticky top-0 z-10 flex border-b border-gray-100"
              style={{
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className="w-14 flex-shrink-0 sticky left-0 z-20 bg-gray-50/95 backdrop-blur-sm" />
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`text-center py-2 border-r border-gray-100 last:border-r-0 ${
                      isToday(day) ? "bg-violet-50/60" : ""
                    }`}
                  >
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isToday(day) ? "text-violet-600" : "text-gray-400"
                      }`}
                    >
                      {format(day, "EEE")}
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        isToday(day) ? "text-violet-700" : "text-gray-700"
                      }`}
                    >
                      {format(day, "d")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {teams.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 mx-2 mt-2 rounded-lg bg-violet-50/60 border border-violet-100">
                <Calendar className="h-4 w-4 text-violet-400 flex-shrink-0" />
                <p className="text-[11px] text-violet-600">
                  Tip: Create teams in the Team view to organize jobs by crew
                </p>
              </div>
            )}

            {displayRows.map((team, teamIdx) => {
              const initials = team.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={team.id}
                  className={`flex ${
                    teamIdx < displayRows.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div
                    className="w-14 flex-shrink-0 flex items-center justify-center py-2 sticky left-0 z-10"
                    style={{
                      background: "rgba(255,255,255,0.95)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(240,245,250,0.7) 50%, rgba(230,238,248,0.6) 100%)",
                        border: "1.5px solid rgba(255, 255, 255, 0.8)",
                        boxShadow:
                          "0 2px 8px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.9)",
                        color: "#334155",
                      }}
                      title={team.name}
                    >
                      {initials}
                    </div>
                  </div>

                  <div
                    className="flex-1 grid"
                    style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
                  >
                    {days.map((day) => {
                      const cellId = `cell-${format(day, "yyyy-MM-dd")}-team-${team.id}`;
                      const dayJobs = getJobsForTeamAndDay(team.id, day);

                      return (
                        <div
                          key={cellId}
                          className={`border-r border-gray-100 last:border-r-0 ${
                            isToday(day) ? "bg-violet-50/30" : ""
                          }`}
                        >
                          <DroppableCell id={cellId}>
                            <div className="space-y-0.5">
                              {dayJobs.map((job) => {
                                const span =
                                  job.durationDays && job.durationDays > 1
                                    ? Math.min(
                                        job.durationDays,
                                        days.length -
                                          days.findIndex((d) =>
                                            isSameDay(d, parseISO(job.scheduledStartAt!))
                                          )
                                      )
                                    : 1;
                                return (
                                  <JobCard
                                    key={job.id}
                                    job={job}
                                    team={team}
                                    teams={teams}
                                    spanDays={span}
                                  />
                                );
                              })}
                            </div>
                          </DroppableCell>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
