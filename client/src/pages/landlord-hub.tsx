import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Home,
  Building,
  Users,
  Wrench,
  DollarSign,
  Bell,
  Calendar,
  Mail,
  Search,
  ArrowLeft,
  Menu,
  LogOut,
  Plus,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Briefcase,
  Receipt,
  MapPin,
  LayoutGrid,
  List,
  Map as MapIcon,
  FileText,
  Send,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AnimatedPyramid } from "@/components/AnimatedPyramid";
import { cn } from "@/lib/utils";

type ViewState =
  | "landing"
  | "maintenance"
  | "portfolio"
  | "tenants"
  | "financial"
  | "calendar"
  | "reminders"
  | "inbox";

type DashboardStats = {
  totalProperties: number;
  monthlyRevenue: number;
  openCases: number;
  dueReminders: number;
};

interface MaintenanceCase {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  buildingName?: string;
  roomNumber?: string;
  locationText?: string;
  estimatedCost?: number | string;
  actualCost?: number | string;
  assignedContractorId?: number;
  assignedContractorName?: string;
  createdAt: string;
  updatedAt: string;
  propertyId?: number;
  propertyName?: string;
}

interface PropertyData {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  totalUnits?: number;
  estimatedValue?: number | string;
}

interface MayaChatMessage {
  role: "user" | "maya";
  content: string;
  timestamp: Date;
}

interface LifecycleStage {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface LifecycleGroup {
  id: string;
  label: string;
  stages: LifecycleStage[];
}

const MAINTENANCE_LIFECYCLE: LifecycleGroup[] = [
  {
    id: "intake",
    label: "INTAKE",
    stages: [{ id: "new", label: "New", icon: FileText }],
  },
  {
    id: "assignment",
    label: "ASSIGNMENT",
    stages: [
      { id: "assigned", label: "Assigned", icon: User },
      { id: "quoted", label: "Quoted", icon: Receipt },
    ],
  },
  {
    id: "execution",
    label: "EXECUTION",
    stages: [
      { id: "scheduled", label: "Scheduled", icon: Calendar },
      { id: "in_progress", label: "In Progress", icon: Wrench },
      { id: "completed", label: "Completed", icon: CheckCircle },
    ],
  },
];

function getLifecycleGroupId(stageId: string): string | null {
  for (const group of MAINTENANCE_LIFECYCLE) {
    if (group.stages.some((s) => s.id === stageId)) {
      return group.id;
    }
  }
  return null;
}

function MaintenanceLifecycleBar({
  activeStage,
  onStageClick,
  counts,
  statusMessage,
}: {
  activeStage: string;
  onStageClick: (stageId: string) => void;
  counts: Record<string, number>;
  statusMessage?: string;
}) {
  const activeGroupId = getLifecycleGroupId(activeStage);

  return (
    <div className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/40 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1 mb-1.5">
        <CheckCircle2 className="h-3 w-3 text-blue-500" />
        <span className="text-[9px] font-semibold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
          Maintenance Lifecycle
        </span>
        {statusMessage && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {statusMessage}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {MAINTENANCE_LIFECYCLE.map((group, groupIndex) => {
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
                      isActiveGroup
                        ? "text-blue-600 dark:text-blue-400"
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

                      return (
                        <div key={stage.id} className="flex items-center">
                          {stageIndex > 0 && (
                            <div
                              className={cn(
                                "w-4 h-px",
                                isActive ||
                                  activeStage ===
                                    group.stages[stageIndex - 1]?.id
                                  ? "bg-blue-300 dark:bg-blue-600"
                                  : "bg-slate-200 dark:bg-slate-700"
                              )}
                            />
                          )}

                          <button
                            onClick={() => onStageClick(stage.id)}
                            className="flex flex-col items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-all group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50"
                          >
                            <div className="relative">
                              <div
                                className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                                  isActive
                                    ? "bg-blue-500 shadow-sm shadow-blue-200 dark:shadow-blue-900/50"
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
                                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] flex items-center justify-center rounded-full bg-blue-500 text-white text-[9px] font-bold leading-none px-0.5">
                                  {count > 99 ? "99+" : count}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-[9px] font-medium leading-tight whitespace-nowrap",
                                isActive
                                  ? "text-blue-600 dark:text-blue-400"
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

function LandlordQuickAdd({
  onNavigate,
  onRouteNavigate,
}: {
  onNavigate: (view: string) => void;
  onRouteNavigate: (path: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Quick Add
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onNavigate("maintenance")}>
          <Wrench className="h-4 w-4 mr-2" />
          Create Maintenance Request
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRouteNavigate("/financial")}>
          <DollarSign className="h-4 w-4 mr-2" />
          Log Expense
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRouteNavigate("/tenants")}>
          <Users className="h-4 w-4 mr-2" />
          Add Tenant
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNavigate("reminders")}>
          <Bell className="h-4 w-4 mr-2" />
          Set Reminder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const FROSTED_CARD_STYLE = {
  background:
    "radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)",
  backdropFilter: "blur(60px) saturate(220%) brightness(1.04)",
  WebkitBackdropFilter: "blur(60px) saturate(220%) brightness(1.04)",
  border: "2px solid rgba(255, 255, 255, 0.85)",
  boxShadow:
    "inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)",
};

const FROSTED_CARD_CLASS =
  "group relative w-full rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.10] hover:-translate-y-3 hover:shadow-[0_25px_60px_rgba(139,92,246,0.35),0_15px_35px_rgba(59,130,246,0.25),0_8px_20px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2";

const SIDEBAR_BTN_CLASS =
  "group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation";

export default function LandlordHub() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [view, setView] = useState<ViewState>("landing");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [maintenanceFilter, setMaintenanceFilter] = useState("new");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list" | "map">("cards");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [mayaHovered, setMayaHovered] = useState(false);
  const [showMayaBubble, setShowMayaBubble] = useState(false);
  const [mayaSuggestionIndex, setMayaSuggestionIndex] = useState(0);
  const [mayaChatMessages, setMayaChatMessages] = useState<MayaChatMessage[]>(
    []
  );
  const [mayaChatInput, setMayaChatInput] = useState("");
  const [isMayaTyping, setIsMayaTyping] = useState(false);

  const mayaSuggestions = [
    "What needs my attention today?",
    "Which properties need maintenance?",
    "Any leases expiring soon?",
  ];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.primaryRole === "contractor") {
        navigate("/contractor");
      } else if (user.primaryRole === "tenant") {
        navigate("/tenant-dashboard");
      } else if (user.primaryRole === "platform_super_admin") {
        navigate("/admin-dashboard");
      } else if (user.primaryRole === "property_owner") {
        navigate("/homeowner");
      }
    }
  }, [user, isLoading]);

  useEffect(() => {
    if (!mayaHovered) return;
    const interval = setInterval(() => {
      setShowMayaBubble(false);
      setTimeout(() => {
        setMayaSuggestionIndex(
          (prev) => (prev + 1) % mayaSuggestions.length
        );
        setShowMayaBubble(true);
      }, 150);
    }, 2000);
    return () => clearInterval(interval);
  }, [mayaHovered]);

  useEffect(() => {
    if (mayaHovered) {
      setShowMayaBubble(true);
    } else {
      setShowMayaBubble(false);
    }
  }, [mayaHovered]);

  const firstName =
    user?.firstName || user?.username?.split("@")[0] || "there";

  const { data: cases = [] } = useQuery<MaintenanceCase[]>({
    queryKey: ["/api/cases"],
    enabled: !!user,
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: !!user,
  });

  const { data: properties = [] } = useQuery<PropertyData[]>({
    queryKey: ["/api/properties"],
    enabled: !!user,
  });

  const newCases = useMemo(
    () =>
      cases.filter((c) =>
        ["New", "Submitted", "Open"].includes(c.status)
      ),
    [cases]
  );
  const assignedCases = useMemo(
    () =>
      cases.filter((c) => ["Assigned", "In Review"].includes(c.status)),
    [cases]
  );
  const quotedCases = useMemo(
    () => cases.filter((c) => ["Quoted"].includes(c.status)),
    [cases]
  );
  const scheduledCases = useMemo(
    () => cases.filter((c) => ["Scheduled", "Confirmed"].includes(c.status)),
    [cases]
  );
  const inProgressCases = useMemo(
    () => cases.filter((c) => ["In Progress"].includes(c.status)),
    [cases]
  );
  const completedCases = useMemo(
    () =>
      cases.filter((c) =>
        ["Completed", "Resolved"].includes(c.status)
      ),
    [cases]
  );

  const lifecycleCounts = useMemo(
    () => ({
      new: newCases.length,
      assigned: assignedCases.length,
      quoted: quotedCases.length,
      scheduled: scheduledCases.length,
      in_progress: inProgressCases.length,
      completed: completedCases.length,
    }),
    [newCases, assignedCases, quotedCases, scheduledCases, inProgressCases, completedCases]
  );

  const lifecycleStatusMessage = useMemo(() => {
    const messages: Record<string, string> = {
      new: `${newCases.length} new case${newCases.length !== 1 ? "s" : ""} awaiting review`,
      assigned: `${assignedCases.length} case${assignedCases.length !== 1 ? "s" : ""} assigned to contractors`,
      quoted: `${quotedCases.length} case${quotedCases.length !== 1 ? "s" : ""} with quotes`,
      scheduled: `${scheduledCases.length} case${scheduledCases.length !== 1 ? "s" : ""} scheduled`,
      in_progress: `${inProgressCases.length} case${inProgressCases.length !== 1 ? "s" : ""} in progress`,
      completed: `${completedCases.length} case${completedCases.length !== 1 ? "s" : ""} completed`,
    };
    return messages[maintenanceFilter] || "";
  }, [maintenanceFilter, newCases, assignedCases, quotedCases, scheduledCases, inProgressCases, completedCases]);

  const filteredCases = useMemo(() => {
    let result = [...cases];

    const filterMap: Record<string, string[]> = {
      new: ["New", "Submitted", "Open"],
      assigned: ["Assigned", "In Review"],
      quoted: ["Quoted"],
      scheduled: ["Scheduled", "Confirmed"],
      in_progress: ["In Progress"],
      completed: ["Completed", "Resolved"],
    };

    if (filterMap[maintenanceFilter]) {
      result = result.filter((c) =>
        filterMap[maintenanceFilter].includes(c.status)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter(
        (c) => c.category?.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    if (priorityFilter !== "all") {
      result = result.filter(
        (c) => c.priority?.toLowerCase() === priorityFilter.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.buildingName?.toLowerCase().includes(q) ||
          c.propertyName?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "oldest":
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        case "priority": {
          const order: Record<string, number> = {
            Urgent: 0,
            High: 1,
            Normal: 2,
            Low: 3,
          };
          return (
            (order[a.priority || "Normal"] || 2) -
            (order[b.priority || "Normal"] || 2)
          );
        }
        default:
          return 0;
      }
    });

    return result;
  }, [cases, maintenanceFilter, categoryFilter, priorityFilter, searchQuery, sortBy]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    cases.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats);
  }, [cases]);

  const selectedCase = useMemo(
    () => filteredCases.find((c) => c.id === selectedCaseId),
    [filteredCases, selectedCaseId]
  );

  const openCasesCount = newCases.length + assignedCases.length + inProgressCases.length;
  const urgentCasesCount = cases.filter(
    (c) =>
      (c.priority === "Urgent" || c.priority === "High") &&
      !["Completed", "Resolved"].includes(c.status)
  ).length;
  const totalEstimatedCost = cases
    .filter((c) => !["Completed", "Resolved"].includes(c.status))
    .reduce((sum, c) => sum + (parseFloat(String(c.estimatedCost || 0)) || 0), 0);

  const totalUnits = properties.reduce(
    (sum, p) => sum + (p.totalUnits || 0),
    0
  );
  const totalPropertyValue = properties.reduce(
    (sum, p) => sum + (parseFloat(String(p.estimatedValue || 0)) || 0),
    0
  );

  const handleMayaChat = async () => {
    if (!mayaChatInput.trim()) return;
    const question = mayaChatInput.trim();
    const userMsg: MayaChatMessage = {
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    setMayaChatMessages((prev) => [...prev, userMsg]);
    setMayaChatInput("");
    setIsMayaTyping(true);

    try {
      const res = await apiRequest("POST", "/api/maya/chat", {
        message: question,
        context: "maintenance",
      });
      const data = await res.json();
      setMayaChatMessages((prev) => [
        ...prev,
        {
          role: "maya",
          content: data.response || "I can help you manage your properties. What would you like to know?",
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMayaChatMessages((prev) => [
        ...prev,
        {
          role: "maya",
          content: `You have ${openCasesCount} open maintenance cases. ${urgentCasesCount > 0 ? `${urgentCasesCount} are marked urgent.` : "None are currently urgent."} How can I help?`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsMayaTyping(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full bg-background/95 backdrop-blur-xl border-r flex flex-col z-40 transition-all duration-300 ${
          sidebarOpen
            ? "w-72 translate-x-0"
            : "w-72 -translate-x-full lg:translate-x-0 lg:w-0"
        } overflow-hidden`}
      >
        <div className="w-72 h-full flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
                  <Building className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-sm">AllAI Property</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSidebarOpen(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9 h-9 text-sm rounded-lg bg-background/50 border-muted"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => {
                setView("landing");
                setSelectedCaseId(null);
              }}
            >
              <Home className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Home
              </span>
            </Button>

            <div className="my-3 mx-3 h-[1px] bg-gradient-to-r from-violet-400/40 via-blue-400/40 to-transparent" />

            <div className="px-3 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                Maintenance
              </span>
            </div>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => {
                setMaintenanceFilter("new");
                setView("maintenance");
              }}
            >
              <FileText className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                New
              </span>
              {newCases.length > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">
                  {newCases.length}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => {
                setMaintenanceFilter("assigned");
                setView("maintenance");
              }}
            >
              <User className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Assigned
              </span>
              {assignedCases.length > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-amber-100 text-amber-700 hover:bg-amber-100">
                  {assignedCases.length}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => {
                setMaintenanceFilter("in_progress");
                setView("maintenance");
              }}
            >
              <Wrench className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                In Progress
              </span>
              {inProgressCases.length > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  {inProgressCases.length}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => {
                setMaintenanceFilter("completed");
                setView("maintenance");
              }}
            >
              <CheckCircle className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Completed
              </span>
              {completedCases.length > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-slate-100 text-slate-700 hover:bg-slate-100">
                  {completedCases.length}
                </Badge>
              )}
            </Button>

            <div className="my-3 mx-3 h-[1px] bg-gradient-to-r from-violet-400/40 via-blue-400/40 to-transparent" />

            <div className="px-3 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                Manage
              </span>
            </div>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => setView("portfolio")}
            >
              <Building className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Portfolio
              </span>
            </Button>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => setView("tenants")}
            >
              <Users className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Tenants
              </span>
            </Button>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => setView("financial")}
            >
              <DollarSign className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Financial
              </span>
            </Button>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => setView("reminders")}
            >
              <Bell className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Reminders
              </span>
            </Button>

            <div className="my-3 mx-3 h-[1px] bg-gradient-to-r from-violet-400/40 via-blue-400/40 to-transparent" />

            <div className="px-3 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                Account
              </span>
            </div>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => setView("inbox")}
            >
              <Mail className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Inbox
              </span>
            </Button>
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => setView("calendar")}
            >
              <Calendar className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Calendar
              </span>
            </Button>
          </div>

          <div className="p-3 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => logout?.()}
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Sign Out</span>
            </Button>
          </div>
        </div>
      </aside>

      <div
        className={`flex-1 transition-all duration-300 ${
          sidebarOpen ? "lg:ml-72" : "ml-0"
        } ${
          view === "maintenance"
            ? "h-screen flex flex-col overflow-hidden"
            : ""
        }`}
      >
        <header
          className={`${
            view === "maintenance"
              ? "shrink-0"
              : "fixed top-0 left-0 right-0 lg:left-auto"
          } z-20 bg-background/80 backdrop-blur-sm transition-all duration-300`}
          style={
            view !== "maintenance"
              ? { left: sidebarOpen ? "288px" : "0" }
              : undefined
          }
        >
          <div className="relative flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="absolute left-2 sm:left-4 h-10 w-10 touch-manipulation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            {view !== "landing" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setView("landing");
                  setSelectedCaseId(null);
                }}
                className="absolute left-2 sm:left-4 gap-2 h-10 touch-manipulation"
                style={!sidebarOpen ? { left: "48px" } : undefined}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            )}

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <AnimatedPyramid size={56} />
                <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
                  AllAI
                </span>
              </div>
              <span className="text-xs text-muted-foreground italic mt-1">
                Property management made simple
              </span>
            </div>
          </div>
        </header>

        <main
          className={`flex flex-col ${
            view === "maintenance"
              ? "flex-1 min-h-0 overflow-hidden"
              : "pt-24 sm:pt-32 pb-8 px-4 sm:px-6 max-w-4xl mx-auto min-h-screen"
          }`}
        >
          {view === "landing" && (
            <div className="flex-1 flex flex-col pt-4">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    Good{" "}
                    {new Date().getHours() < 12
                      ? "morning"
                      : new Date().getHours() < 17
                        ? "afternoon"
                        : "evening"}
                    , {firstName}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(), "EEEE, MMMM d")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <LandlordQuickAdd
                    onNavigate={(v) => setView(v as ViewState)}
                    onRouteNavigate={navigate}
                  />
                  <div
                    className="relative"
                    onMouseEnter={() => setMayaHovered(true)}
                    onMouseLeave={() => setMayaHovered(false)}
                  >
                    <div
                      className={`absolute -top-12 right-0 px-3 py-1.5 rounded-lg text-xs text-violet-600 dark:text-violet-400 whitespace-nowrap transition-all duration-300 ${
                        showMayaBubble
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-2"
                      }`}
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)",
                        border: "1px solid rgba(139, 92, 246, 0.25)",
                        boxShadow: "0 4px 12px rgba(139, 92, 246, 0.15)",
                      }}
                    >
                      {mayaSuggestions[mayaSuggestionIndex]}
                      <div
                        className="absolute -bottom-1 right-6 w-2 h-2 rotate-45"
                        style={{
                          background: "rgba(139, 92, 246, 0.15)",
                          borderRight: "1px solid rgba(139, 92, 246, 0.25)",
                          borderBottom: "1px solid rgba(139, 92, 246, 0.25)",
                        }}
                      />
                    </div>
                    <button
                      onClick={() => setView("maintenance")}
                      className={`group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
                        mayaHovered ? "scale-105" : ""
                      }`}
                      style={{
                        background: mayaHovered
                          ? "linear-gradient(135deg, rgba(139, 92, 246, 0.35) 0%, rgba(59, 130, 246, 0.35) 100%)"
                          : "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)",
                        border: `1px solid ${
                          mayaHovered
                            ? "rgba(139, 92, 246, 0.5)"
                            : "rgba(139, 92, 246, 0.3)"
                        }`,
                        boxShadow: mayaHovered
                          ? "0 6px 24px rgba(139, 92, 246, 0.4)"
                          : "0 4px 12px rgba(139, 92, 246, 0.15)",
                      }}
                    >
                      <Sparkles
                        className={`h-4 w-4 transition-colors ${
                          mayaHovered ? "text-violet-400" : "text-violet-500"
                        }`}
                      />
                      <span
                        className={`text-sm font-medium transition-colors ${
                          mayaHovered
                            ? "text-violet-600 dark:text-violet-300"
                            : "text-violet-700 dark:text-violet-400"
                        }`}
                      >
                        Ask Maya
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                <div
                  className="relative"
                  onMouseEnter={() => setHoveredCard("maintenance")}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <button
                    className={FROSTED_CARD_CLASS}
                    onClick={() => {
                      setMaintenanceFilter("new");
                      setView("maintenance");
                    }}
                    style={FROSTED_CARD_STYLE}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                      style={{
                        boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)",
                      }}
                    />
                    <div
                      className="running-light-bar h-1 transition-all duration-300"
                      style={{
                        backdropFilter: "blur(16px) saturate(200%)",
                        boxShadow:
                          "inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    />
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                          Maintenance
                        </span>
                        <Wrench className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          Open Cases
                        </span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          {openCasesCount}
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Assigned
                          </span>
                          <span className="text-xs font-semibold text-emerald-600">
                            {assignedCases.length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Urgent
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              urgentCasesCount > 0
                                ? "text-red-500"
                                : "text-gray-700"
                            }`}
                          >
                            {urgentCasesCount}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">
                            Value
                          </span>
                          <span className="text-sm font-bold text-blue-600">
                            ${totalEstimatedCost.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                <div
                  className="relative"
                  onMouseEnter={() => setHoveredCard("financial")}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <button
                    className={FROSTED_CARD_CLASS}
                    onClick={() => setView("financial")}
                    style={FROSTED_CARD_STYLE}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                      style={{
                        boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)",
                      }}
                    />
                    <div
                      className="running-light-bar h-1 transition-all duration-300"
                      style={{
                        backdropFilter: "blur(16px) saturate(200%)",
                        boxShadow:
                          "inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    />
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                          Financial
                        </span>
                        <DollarSign className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          Monthly Revenue
                        </span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          ${(stats?.monthlyRevenue || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Expenses
                          </span>
                          <span className="text-xs font-semibold text-amber-600">
                            ${totalEstimatedCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Net Income
                          </span>
                          <span className="text-xs font-semibold text-emerald-600">
                            $
                            {(
                              (stats?.monthlyRevenue || 0) - totalEstimatedCost
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">
                            Outstanding
                          </span>
                          <span className="text-sm font-bold text-amber-600">
                            $0
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                <div
                  className="relative"
                  onMouseEnter={() => setHoveredCard("tenants")}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <button
                    className={FROSTED_CARD_CLASS}
                    onClick={() => setView("tenants")}
                    style={FROSTED_CARD_STYLE}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                      style={{
                        boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)",
                      }}
                    />
                    <div
                      className="running-light-bar h-1 transition-all duration-300"
                      style={{
                        backdropFilter: "blur(16px) saturate(200%)",
                        boxShadow:
                          "inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    />
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                          Tenants
                        </span>
                        <Users className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          Active
                        </span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          {totalUnits}
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Vacancies
                          </span>
                          <span className="text-xs font-semibold text-amber-600">
                            0
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Expiring Soon
                          </span>
                          <span className="text-xs font-semibold text-orange-500">
                            0
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">
                            Occupancy
                          </span>
                          <span className="text-sm font-bold text-emerald-600">
                            {totalUnits > 0 ? "100%" : "0%"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                <div
                  className="relative"
                  onMouseEnter={() => setHoveredCard("portfolio")}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <button
                    className={FROSTED_CARD_CLASS}
                    onClick={() => setView("portfolio")}
                    style={FROSTED_CARD_STYLE}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                      style={{
                        boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)",
                      }}
                    />
                    <div
                      className="running-light-bar h-1 transition-all duration-300"
                      style={{
                        backdropFilter: "blur(16px) saturate(200%)",
                        boxShadow:
                          "inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    />
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                          Portfolio
                        </span>
                        <Building className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          Properties
                        </span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          {stats?.totalProperties || properties.length}
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Total Units
                          </span>
                          <span className="text-xs font-semibold text-emerald-600">
                            {totalUnits}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Total Value
                          </span>
                          <span className="text-xs font-semibold text-gray-700">
                            $
                            {totalPropertyValue > 0
                              ? totalPropertyValue.toLocaleString()
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">
                            Avg Rent
                          </span>
                          <span className="text-sm font-bold text-blue-600">
                            $
                            {totalUnits > 0 && (stats?.monthlyRevenue || 0) > 0
                              ? Math.round(
                                  (stats?.monthlyRevenue || 0) / totalUnits
                                ).toLocaleString()
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Today's Schedule
                </h3>
                <div
                  className="rounded-xl p-6 text-center"
                  style={FROSTED_CARD_STYLE}
                >
                  <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No appointments scheduled for today
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setView("calendar")}
                  >
                    View Calendar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {view === "maintenance" && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 px-4 sm:px-6 py-3 space-y-3">
                <MaintenanceLifecycleBar
                  activeStage={maintenanceFilter}
                  onStageClick={(stageId) => {
                    setMaintenanceFilter(stageId);
                    setSelectedCaseId(null);
                  }}
                  counts={lifecycleCounts}
                  statusMessage={lifecycleStatusMessage}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat.toLowerCase()}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={priorityFilter}
                    onValueChange={setPriorityFilter}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="All Priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant={viewMode === "cards" ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setViewMode("cards")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "map" ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setViewMode("map")}
                    >
                      <MapIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex min-h-0 overflow-hidden">
                <div className="hidden lg:flex flex-col w-64 border-r p-4 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Maya AI Advisor</p>
                      <p className="text-[10px] text-muted-foreground">
                        Your intelligent assistant
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                    {mayaChatMessages.length === 0 && (
                      <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50">
                        Ask Maya about your maintenance cases, priorities, or
                        property management questions.
                      </div>
                    )}
                    {mayaChatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-xs p-2 rounded-lg ${
                          msg.role === "user"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 ml-4"
                            : "bg-muted/50 mr-4"
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                    {isMayaTyping && (
                      <div className="text-xs p-2 rounded-lg bg-muted/50 mr-4 animate-pulse">
                        Maya is thinking...
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask Maya about maintenance..."
                      className="h-8 text-xs"
                      value={mayaChatInput}
                      onChange={(e) => setMayaChatInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleMayaChat()
                      }
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleMayaChat}
                      disabled={!mayaChatInput.trim() || isMayaTyping}
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {filteredCases.length === 0 ? (
                    <div className="text-center py-12">
                      <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No cases found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        No maintenance cases match the current filters.
                      </p>
                    </div>
                  ) : viewMode === "cards" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {filteredCases.map((c) => (
                        <button
                          key={c.id}
                          className={`text-left rounded-xl border p-4 transition-all hover:shadow-md hover:border-blue-300 ${
                            selectedCaseId === c.id
                              ? "border-blue-500 shadow-md bg-blue-50/50 dark:bg-blue-900/20"
                              : "border-border"
                          }`}
                          onClick={() => setSelectedCaseId(c.id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="text-sm font-semibold line-clamp-1">
                              {c.title}
                            </h4>
                            <Badge
                              variant={
                                c.priority === "Urgent" || c.priority === "High"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-[10px] ml-2 shrink-0"
                            >
                              {c.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {c.description}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {c.category && (
                              <span className="bg-muted px-1.5 py-0.5 rounded">
                                {c.category}
                              </span>
                            )}
                            {(c.propertyName || c.buildingName) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {c.propertyName || c.buildingName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                            >
                              {c.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {c.createdAt
                                ? format(
                                    new Date(c.createdAt),
                                    "MMM d"
                                  )
                                : ""}
                            </span>
                          </div>
                          {c.assignedContractorName && (
                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                              <User className="h-3 w-3" />
                              {c.assignedContractorName}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    viewMode === "list" ? (
                    <div className="space-y-1">
                      {filteredCases.map((c) => (
                        <button
                          key={c.id}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-muted/50 ${
                            selectedCaseId === c.id
                              ? "bg-blue-50/50 dark:bg-blue-900/20 border border-blue-300"
                              : ""
                          }`}
                          onClick={() => setSelectedCaseId(c.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {c.title}
                              </span>
                              <Badge
                                variant={
                                  c.priority === "Urgent" ||
                                  c.priority === "High"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[10px] shrink-0"
                              >
                                {c.priority}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[10px] shrink-0"
                              >
                                {c.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {c.propertyName || c.buildingName} •{" "}
                              {c.category}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {c.createdAt
                              ? format(new Date(c.createdAt), "MMM d")
                              : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-xl">
                      <div className="text-center py-12">
                        <MapIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">Map View</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {filteredCases.length} maintenance cases across your properties
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Map visualization coming soon
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedCase && (
                  <div className="hidden xl:flex flex-col w-80 border-l p-4 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold">Case Details</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSelectedCaseId(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-base font-semibold">
                          {selectedCase.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={
                              selectedCase.priority === "Urgent" ||
                              selectedCase.priority === "High"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {selectedCase.priority}
                          </Badge>
                          <Badge variant="outline">{selectedCase.status}</Badge>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Description
                        </p>
                        <p className="text-sm">{selectedCase.description}</p>
                      </div>

                      {selectedCase.category && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Category
                          </p>
                          <p className="text-sm">{selectedCase.category}</p>
                        </div>
                      )}

                      {(selectedCase.propertyName ||
                        selectedCase.buildingName) && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Property
                          </p>
                          <p className="text-sm flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {selectedCase.propertyName ||
                              selectedCase.buildingName}
                          </p>
                        </div>
                      )}

                      {selectedCase.estimatedCost && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Estimated Cost
                          </p>
                          <p className="text-sm font-semibold">
                            $
                            {parseFloat(
                              String(selectedCase.estimatedCost)
                            ).toLocaleString()}
                          </p>
                        </div>
                      )}

                      {selectedCase.assignedContractorName && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Assigned Contractor
                          </p>
                          <p className="text-sm flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {selectedCase.assignedContractorName}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Created
                        </p>
                        <p className="text-sm">
                          {selectedCase.createdAt
                            ? format(
                                new Date(selectedCase.createdAt),
                                "MMM d, yyyy 'at' h:mm a"
                              )
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === "portfolio" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="text-center py-20">
                <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold">Portfolio</h2>
                <p className="text-muted-foreground mt-2">
                  Property portfolio management
                </p>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/portfolio")}
                >
                  Open Portfolio
                </Button>
              </div>
            </div>
          )}

          {view === "tenants" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="text-center py-20">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold">Tenants</h2>
                <p className="text-muted-foreground mt-2">
                  Tenant management and communication
                </p>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/tenants")}
                >
                  Open Tenants
                </Button>
              </div>
            </div>
          )}

          {view === "financial" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="text-center py-20">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold">Financial</h2>
                <p className="text-muted-foreground mt-2">
                  Income, expenses, and financial reports
                </p>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/financial")}
                >
                  Open Financial
                </Button>
              </div>
            </div>
          )}

          {view === "calendar" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="text-center py-20">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold">Calendar</h2>
                <p className="text-muted-foreground mt-2">
                  Appointments and scheduling
                </p>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/admin-calendar")}
                >
                  Open Calendar
                </Button>
              </div>
            </div>
          )}

          {view === "reminders" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="text-center py-20">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold">Reminders</h2>
                <p className="text-muted-foreground mt-2">
                  Tasks, reminders, and to-dos
                </p>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/reminders")}
                >
                  Open Reminders
                </Button>
              </div>
            </div>
          )}

          {view === "inbox" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="text-center py-20">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold">Inbox</h2>
                <p className="text-muted-foreground mt-2">
                  Messages and notifications
                </p>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/inbox")}
                >
                  Open Inbox
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
