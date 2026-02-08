import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, startOfWeek, parseISO, isSameDay, isToday, subDays, isAfter, isBefore } from "date-fns";
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
  MapPin,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Zap,
  DollarSign,
  CheckCircle,
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

const HOUR_WIDTH = 60;
const TIMELINE_START = 6;
const TIMELINE_END = 20;
const TOTAL_HOURS = TIMELINE_END - TIMELINE_START;

function formatHour(h: number) {
  if (h === 12) return "12 PM";
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
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

  const typeLabel = item.type === "case" ? "Case" : item.type === "quote" ? "Quote" : "Job";
  const typeColor = item.type === "case" ? "bg-blue-50 text-blue-600 border-blue-100" : item.type === "quote" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-violet-50 text-violet-600 border-violet-100";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
        isDragging
          ? "border-violet-300 bg-violet-50 shadow-lg"
          : "border-gray-100 bg-white hover:border-violet-200 hover:bg-violet-50/30"
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-800 truncate">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${typeColor}`}>
            {typeLabel}
          </Badge>
          {item.urgency && item.urgency !== "Low" && (
            <Badge
              variant="outline"
              className={`text-[8px] px-1 py-0 h-3.5 ${
                item.urgency === "Emergent"
                  ? "border-red-200 text-red-600 bg-red-50"
                  : "border-orange-200 text-orange-600 bg-orange-50"
              }`}
            >
              <Zap className="h-2 w-2 mr-0.5" />
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
  className,
}: {
  id: string;
  children: React.ReactNode;
  isOver?: boolean;
  className?: string;
}) {
  const { setNodeRef, isOver: cellIsOver } = useDroppable({ id });
  const active = isOver || cellIsOver;

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[52px] p-0.5 transition-colors ${
        active
          ? "bg-violet-50 border border-dashed border-violet-300 rounded"
          : "border border-transparent"
      } ${className || ""}`}
    >
      {children}
    </div>
  );
}

function getTimeCategory(job: ScheduledJob): "remaining" | "active" | "complete" {
  if (job.status === "Completed") return "complete";
  if (!job.scheduledStartAt || !job.scheduledEndAt) return "remaining";
  const now = new Date();
  const start = parseISO(job.scheduledStartAt);
  const end = parseISO(job.scheduledEndAt);
  if (isAfter(now, end)) return "complete";
  if (isBefore(now, start)) return "remaining";
  return "active";
}

function getJobCardColors(category: "remaining" | "active" | "complete") {
  if (category === "complete") return {
    bg: "rgba(220, 252, 231, 0.5)",
    border: "1px solid rgba(134, 239, 172, 0.4)",
  };
  if (category === "active") return {
    bg: "rgba(255, 237, 213, 0.5)",
    border: "1px solid rgba(251, 146, 60, 0.4)",
  };
  return {
    bg: "rgba(219, 234, 254, 0.5)",
    border: "1px solid rgba(147, 197, 253, 0.4)",
  };
}

function JobCardPopover({
  job,
  team,
  teams,
  children,
}: {
  job: ScheduledJob;
  team?: Team;
  teams: Team[];
  children: React.ReactNode;
}) {
  const { toast } = useToast();
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
      <PopoverTrigger asChild>{children}</PopoverTrigger>
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
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] ${statusColor}`}>{job.status}</Badge>
            {job.scheduledStartAt && (
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(parseISO(job.scheduledStartAt), "MMM d, h:mm a")}
                {job.scheduledEndAt && ` - ${format(parseISO(job.scheduledEndAt), "h:mm a")}`}
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

function DayTimelineJobBlock({
  job,
  team,
  teams,
}: {
  job: ScheduledJob;
  team?: Team;
  teams: Team[];
}) {
  if (!job.scheduledStartAt) return null;

  const start = parseISO(job.scheduledStartAt);
  let startHour: number;
  let endHour: number;

  if (job.isAllDay || !job.scheduledEndAt) {
    startHour = TIMELINE_START;
    endHour = TIMELINE_END;
  } else {
    const end = parseISO(job.scheduledEndAt);
    startHour = start.getHours() + start.getMinutes() / 60;
    endHour = end.getHours() + end.getMinutes() / 60;
    if (endHour <= startHour) endHour = startHour + 1;
  }

  const clampedStart = Math.max(startHour, TIMELINE_START);
  const clampedEnd = Math.min(endHour, TIMELINE_END);
  if (clampedEnd <= clampedStart) return null;

  const left = (clampedStart - TIMELINE_START) * HOUR_WIDTH;
  const width = Math.max((clampedEnd - clampedStart) * HOUR_WIDTH, 50);

  const category = getTimeCategory(job);
  const colors = getJobCardColors(category);
  const teamColor = team?.color || "#6366f1";
  const isUrgent = job.urgency === "High" || job.urgency === "Emergent";

  return (
    <JobCardPopover job={job} team={team} teams={teams}>
      <button
        className="absolute top-1 bottom-1 cursor-pointer transition-all duration-200 hover:shadow-md hover:z-20 rounded-sm overflow-hidden"
        style={{
          left,
          width,
          zIndex: 10,
        }}
      >
        <div
          className="h-full flex overflow-hidden rounded-sm"
          style={{
            background: colors.bg,
            backdropFilter: "blur(8px)",
            border: colors.border,
          }}
        >
          <div className="w-1 flex-shrink-0" style={{ backgroundColor: teamColor }} />
          <div className="flex-1 px-1.5 py-0.5 flex items-center gap-1 min-w-0">
            {isUrgent && (
              <span className="flex-shrink-0 px-1 py-0.5 text-[7px] font-bold bg-amber-100 text-amber-700 rounded">
                !
              </span>
            )}
            <span className="text-[10px] font-medium text-gray-700 truncate">
              {job.title}
            </span>
            {category === "complete" && (
              <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0 ml-auto" />
            )}
          </div>
        </div>
      </button>
    </JobCardPopover>
  );
}

function WeekJobCard({
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
  const category = getTimeCategory(job);
  const colors = getJobCardColors(category);
  const teamColor = team?.color || "#6366f1";

  const isAllDay = job.isAllDay || !job.scheduledEndAt;
  const timeStr = !isAllDay && job.scheduledStartAt
    ? format(parseISO(job.scheduledStartAt), "h:mm a")
    : "";

  return (
    <JobCardPopover job={job} team={team} teams={teams}>
      <button
        className="w-full text-left rounded-md p-1 transition-all hover:shadow-sm cursor-pointer group overflow-hidden"
        style={{
          borderLeft: `3px solid ${teamColor}`,
          background: colors.bg,
          border: colors.border,
          borderLeftWidth: "3px",
          borderLeftColor: teamColor,
          gridColumn: spanDays && spanDays > 1 ? `span ${spanDays}` : undefined,
        }}
      >
        <div className="flex items-center gap-1">
          {isAllDay ? (
            <span className="text-[7px] font-semibold text-violet-500 bg-violet-50 px-1 rounded leading-none py-0.5">
              ALL DAY
            </span>
          ) : timeStr ? (
            <span className="text-[8px] font-medium text-gray-400 leading-none">
              {timeStr}
            </span>
          ) : null}
          {category === "complete" && (
            <CheckCircle className="h-2.5 w-2.5 text-green-500 flex-shrink-0 ml-auto" />
          )}
        </div>
        <p className="text-[10px] font-medium text-gray-800 truncate leading-tight group-hover:text-violet-700 mt-0.5">
          {job.title}
        </p>
        {job.customerName && (
          <p className="text-[8px] text-gray-400 truncate mt-0.5">{job.customerName}</p>
        )}
      </button>
    </JobCardPopover>
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

  const getJobsForDay = (day: Date) => {
    return (scheduledJobs || []).filter((job: ScheduledJob) => {
      if (!job.scheduledStartAt) return false;
      const jobDate = parseISO(job.scheduledStartAt);
      return isSameDay(jobDate, day);
    });
  };

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

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const getCurrentTimePosition = () => {
    if (currentHour < TIMELINE_START || currentHour > TIMELINE_END) return null;
    return (currentHour - TIMELINE_START + currentMinute / 60) * HOUR_WIDTH;
  };
  const currentTimePos = getCurrentTimePosition();

  const timelineMarkers = useMemo(() => {
    const markers = [];
    for (let h = TIMELINE_START; h <= TIMELINE_END; h++) {
      markers.push(h);
    }
    return markers;
  }, []);

  const todayStats = useMemo(() => {
    const todayJobs = getJobsForDay(viewMode === "day" ? currentDate : new Date());
    let remaining = 0, active = 0, complete = 0;
    todayJobs.forEach((j) => {
      const cat = getTimeCategory(j);
      if (cat === "remaining") remaining++;
      else if (cat === "active") active++;
      else complete++;
    });
    return { total: todayJobs.length, remaining, active, complete };
  }, [scheduledJobs, currentDate, viewMode]);

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

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="flex flex-col items-center px-2 py-0.5 rounded bg-gray-50 border border-gray-100">
                <span className="text-xs font-bold text-gray-800">{todayStats.total}</span>
                <span className="text-[7px] text-gray-400 uppercase">Today</span>
              </div>
              <div className="flex flex-col items-center px-2 py-0.5 rounded" style={{ background: "rgba(219,234,254,0.5)", border: "1px solid rgba(147,197,253,0.3)" }}>
                <span className="text-xs font-bold text-blue-700">{todayStats.remaining}</span>
                <span className="text-[7px] text-blue-400 uppercase">Left</span>
              </div>
              <div className="flex flex-col items-center px-2 py-0.5 rounded bg-orange-50 border border-orange-100">
                <span className="text-xs font-bold text-orange-600">{todayStats.active}</span>
                <span className="text-[7px] text-orange-400 uppercase">Active</span>
              </div>
              <div className="flex flex-col items-center px-2 py-0.5 rounded bg-green-50 border border-green-100">
                <span className="text-xs font-bold text-green-600">{todayStats.complete}</span>
                <span className="text-[7px] text-green-400 uppercase">Done</span>
              </div>
            </div>

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
              background: "rgba(250,249,255,0.95)",
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
                  <div className="text-center py-6">
                    <CheckCircle className="h-6 w-6 text-green-400 mx-auto mb-2" />
                    <p className="text-[11px] text-gray-500 font-medium">All caught up!</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">No items need scheduling</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[9px] text-gray-400 px-1 pt-1">
                      Drag items onto the calendar to schedule them
                    </p>
                    {unscheduledItems.map((item) => (
                      <DraggableItem key={item.id} item={item} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {teams.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 mx-2 mt-2 mb-1 rounded-lg bg-violet-50/60 border border-violet-100">
                <Calendar className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                <p className="text-[10px] text-violet-600">
                  Tip: Create teams in the Team view to organize jobs by crew
                </p>
              </div>
            )}

            {viewMode === "day" ? (
              <DayView
                day={currentDate}
                displayRows={displayRows}
                teams={teams}
                getJobsForTeamAndDay={getJobsForTeamAndDay}
                timelineMarkers={timelineMarkers}
                currentTimePos={currentTimePos}
              />
            ) : (
              <WeekView
                days={days}
                displayRows={displayRows}
                teams={teams}
                getJobsForTeamAndDay={getJobsForTeamAndDay}
              />
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
}

function DayView({
  day,
  displayRows,
  teams,
  getJobsForTeamAndDay,
  timelineMarkers,
  currentTimePos,
}: {
  day: Date;
  displayRows: Team[];
  teams: Team[];
  getJobsForTeamAndDay: (teamId: string, day: Date) => ScheduledJob[];
  timelineMarkers: number[];
  currentTimePos: number | null;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden m-2"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)",
        border: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.03)",
      }}
    >
      <div className="overflow-x-auto">
        <div style={{ minWidth: TOTAL_HOURS * HOUR_WIDTH + 60 }}>
          <div className="flex items-center border-b border-gray-100 bg-gray-50/50">
            <div className="w-14 flex-shrink-0 px-2 py-2 sticky left-0 z-20 bg-gray-50/95 backdrop-blur-sm">
              <Clock className="h-3.5 w-3.5 text-gray-400 mx-auto" />
            </div>
            <div className="flex-1 relative flex">
              {timelineMarkers.map((hour) => (
                <div
                  key={hour}
                  className="flex-shrink-0 text-[10px] text-gray-400 font-medium border-l border-gray-100"
                  style={{ width: HOUR_WIDTH }}
                >
                  <span className="px-1">{formatHour(hour)}</span>
                </div>
              ))}
            </div>
          </div>

          {displayRows.map((team, teamIdx) => {
            const initials = team.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const dayJobs = getJobsForTeamAndDay(team.id, day);
            const cellId = `cell-${format(day, "yyyy-MM-dd")}-team-${team.id}`;

            return (
              <div
                key={team.id}
                className={`flex items-center min-h-[52px] ${
                  teamIdx < displayRows.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <div
                  className="w-14 flex-shrink-0 px-2 py-2 flex items-center justify-center sticky left-0 z-20"
                  style={{
                    background: "rgba(255,255,255,0.95)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(240,245,250,0.7) 50%, rgba(230,238,248,0.6) 100%)",
                      border: "1.5px solid rgba(255, 255, 255, 0.8)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.9)",
                      color: "#334155",
                    }}
                    title={team.name}
                  >
                    {initials}
                  </div>
                </div>

                <DroppableCell id={cellId} className="flex-1 relative h-12">
                  <div className="absolute inset-0 flex pointer-events-none">
                    {timelineMarkers.map((hour) => (
                      <div
                        key={hour}
                        className="flex-shrink-0 border-l border-gray-100"
                        style={{ width: HOUR_WIDTH }}
                      />
                    ))}
                  </div>

                  {isToday(day) && currentTimePos !== null && (
                    <div
                      className="absolute top-0 bottom-0 z-20 pointer-events-none"
                      style={{
                        left: currentTimePos,
                        width: "1px",
                        backgroundImage: "repeating-linear-gradient(to bottom, rgba(239, 68, 68, 0.5) 0px, rgba(239, 68, 68, 0.5) 4px, transparent 4px, transparent 8px)",
                      }}
                    />
                  )}

                  {dayJobs.map((job) => (
                    <DayTimelineJobBlock
                      key={job.id}
                      job={job}
                      team={teams.find((t) => t.id === job.teamId) || team}
                      teams={teams}
                    />
                  ))}
                </DroppableCell>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekView({
  days,
  displayRows,
  teams,
  getJobsForTeamAndDay,
}: {
  days: Date[];
  displayRows: Team[];
  teams: Team[];
  getJobsForTeamAndDay: (teamId: string, day: Date) => ScheduledJob[];
}) {
  return (
    <>
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
              className="w-14 flex-shrink-0 flex items-start justify-center py-2 sticky left-0 z-10"
              style={{
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(240,245,250,0.7) 50%, rgba(230,238,248,0.6) 100%)",
                  border: "1.5px solid rgba(255, 255, 255, 0.8)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.9)",
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
                const dayJobs = getJobsForTeamAndDay(team.id, day)
                  .sort((a, b) => {
                    if (!a.scheduledStartAt) return 1;
                    if (!b.scheduledStartAt) return -1;
                    return a.scheduledStartAt.localeCompare(b.scheduledStartAt);
                  });

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
                            <WeekJobCard
                              key={job.id}
                              job={job}
                              team={teams.find((t) => t.id === job.teamId) || team}
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
    </>
  );
}
