import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ThoughtBubble } from "@/components/contractor/thought-bubble";
import { PhotoAnalysisButton } from "@/components/contractor/maya-photo-analysis";
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
  Contact,
  LayoutGrid,
  List,
  Map as MapIcon,
  FileText,
  CheckCircle2,
  Building2,
  Calculator,
  Settings2,
  Star,
  Shield,
  Zap,
  XCircle,
  Loader2,
  ThumbsUp,
  UserCheck,
  Send,
  X,
  MessageCircle,
  Droplets,
  Flame,
  Bug,
  PaintBucket,
  Hammer,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedPyramid } from "@/components/AnimatedPyramid";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Properties from "@/pages/properties";
import Entities from "@/pages/entities";
import Expenses from "@/pages/expenses";
import Revenue from "@/pages/revenue";
import Tax from "@/pages/tax";
import { HubTenantsView } from "@/components/landlord/hub-tenants-view";

import { HubRemindersView } from "@/components/landlord/hub-reminders-view";
import { HubInboxView } from "@/components/landlord/hub-inbox-view";
import { HubCalendarView } from "@/components/landlord/hub-calendar-view";
import { HubSettingsView } from "@/components/landlord/hub-settings-view";
import { HubVendorsView } from "@/components/landlord/hub-vendors-view";
import { MayaSidebarPanel } from "@/components/landlord/maya-sidebar-panel";
import { formatDistanceToNow } from "date-fns";
// ThreadChat removed - landlord uses inline note system instead

function getCategoryIcon(category?: string) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("plumbing") || cat.includes("water") || cat.includes("leak")) return Droplets;
  if (cat.includes("electric") || cat.includes("power") || cat.includes("wiring")) return Zap;
  if (cat.includes("hvac") || cat.includes("heating") || cat.includes("cooling")) return Flame;
  if (cat.includes("pest") || cat.includes("exterminator")) return Bug;
  if (cat.includes("paint") || cat.includes("cosmetic") || cat.includes("drywall")) return PaintBucket;
  if (cat.includes("structural") || cat.includes("carpentry") || cat.includes("door") || cat.includes("window")) return Hammer;
  if (cat.includes("appliance") || cat.includes("repair")) return Wrench;
  return Wrench;
}

type ViewState =
  | "landing"
  | "maintenance"
  | "portfolio"
  | "tenants"
  | "financial"
  | "calendar"
  | "reminders"
  | "inbox"
  | "settings";

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
  aiTriageJson?: {
    urgency?: string;
    rootCause?: string;
    estimatedCost?: string;
    estimatedTime?: string;
    suggestedActions?: string[];
    safetyNotes?: string;
    photoAnalysis?: any;
  } | null;
  media?: Array<{ id: string; url: string; type?: string; caption?: string }>;
  reporter?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
  property?: { id: string; name?: string; address?: string } | null;
  unit?: { id: string; unitNumber?: string } | null;
  reporterUserId?: string;
}

interface ContractorRecommendation {
  id: string;
  name: string;
  category: string | null;
  rating: string | null;
  responseTimeHours: number | null;
  emergencyAvailable: boolean;
  isPreferred: boolean;
  isTrusted: boolean;
  isFavorite: boolean;
  specialties: string[];
  mayaNote: string;
}

interface RecommendationsResponse {
  contractors: ContractorRecommendation[];
  involvementMode: string;
  autoApproveCostLimit: number | null;
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
          <Receipt className="h-4 w-4 mr-2" />
          Log Expense
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRouteNavigate("/tenants")}>
          <Users className="h-4 w-4 mr-2" />
          Add Tenant
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { onNavigate("financial-vendors"); }}>
          <Contact className="h-4 w-4 mr-2" />
          Add Vendor
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
  const [portfolioTab, setPortfolioTab] = useState("properties");
  const [financialTab, setFinancialTab] = useState("expenses");
  const [mayaHovered, setMayaHovered] = useState(false);
  const [showMayaBubble, setShowMayaBubble] = useState(false);
  const [mayaSuggestionIndex, setMayaSuggestionIndex] = useState(0);

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
        navigate("/tenant-hub");
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

  const { data: approvalPolicies = [] } = useQuery<{ id: string; name: string; isActive: boolean; involvementMode: string }[]>({
    queryKey: ["/api/approval-policies"],
    enabled: !!user,
  });

  const { data: reminders = [] } = useQuery<{ id: string; title: string; type: string; status: string; dueAt: string | null }[]>({
    queryKey: ["/api/reminders"],
    enabled: !!user,
  });

  const dueReminders = useMemo(() => {
    const now = new Date();
    return reminders.filter(r => {
      if (r.status === "Completed" || r.status === "Cancelled") return false;
      if (!r.dueAt) return false;
      const due = new Date(r.dueAt);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    });
  }, [reminders]);

  const overdueReminders = useMemo(() => {
    const now = new Date();
    return reminders.filter(r => {
      if (r.status === "Completed" || r.status === "Cancelled") return false;
      if (!r.dueAt) return false;
      return new Date(r.dueAt) < now;
    });
  }, [reminders]);

  const activePolicy = approvalPolicies.find(p => p.isActive);

  const { data: recommendations, isLoading: recsLoading } = useQuery<RecommendationsResponse>({
    queryKey: ["/api/landlord/maya/recommendations", selectedCaseId],
    enabled: !!selectedCaseId && !!user,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) headers["Authorization"] = `Bearer ${refreshToken}`;
      const res = await fetch(`/api/landlord/maya/recommendations/${selectedCaseId}`, { headers, credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
  });

  const { data: caseEvents = [] } = useQuery<{ id: string; caseId: string; type: string; description: string; metadata: any; createdAt: string }[]>({
    queryKey: ["/api/landlord/cases", selectedCaseId, "events"],
    enabled: !!selectedCaseId && !!user,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) headers["Authorization"] = `Bearer ${refreshToken}`;
      const res = await fetch(`/api/landlord/cases/${selectedCaseId}/events`, { headers, credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ caseId, vendorId }: { caseId: number; vendorId: string }) => {
      const res = await apiRequest("POST", `/api/landlord/cases/${caseId}/assign`, { vendorId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/landlord/maya/recommendations", selectedCaseId] });
      toast({ title: "Contractor assigned", description: "The case has been assigned successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
    },
  });

  const priorityMutation = useMutation({
    mutationFn: async ({ caseId, priority }: { caseId: number; priority: string }) => {
      const res = await apiRequest("POST", `/api/landlord/cases/${caseId}/priority`, { priority });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({ title: "Priority updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const STATUS_CYCLE = ["New", "In Review", "Scheduled", "In Progress", "On Hold", "Resolved", "Closed"] as const;
  const statusMutation = useMutation({
    mutationFn: async ({ caseId, status }: { caseId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/cases/${caseId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Status update failed", description: err.message, variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async ({ caseId, resolution }: { caseId: number; resolution?: string }) => {
      const res = await apiRequest("POST", `/api/landlord/cases/${caseId}/close`, { resolution });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setSelectedCaseId(null);
      toast({ title: "Case resolved", description: "The case has been closed." });
    },
    onError: (err: Error) => {
      toast({ title: "Close failed", description: err.message, variant: "destructive" });
    },
  });

  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showInlineRecs, setShowInlineRecs] = useState(false);

  const noteMutation = useMutation({
    mutationFn: async ({ caseId, note }: { caseId: number; note: string }) => {
      const res = await apiRequest("POST", `/api/landlord/cases/${caseId}/note`, { note });
      return res.json();
    },
    onSuccess: () => {
      setNoteText("");
      setShowNoteForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/landlord/cases", selectedCaseId, "events"] });
      toast({ title: "Note added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add note", description: err.message, variant: "destructive" });
    },
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
    () => cases.filter((c) => ["In Progress", "On Hold"].includes(c.status)),
    [cases]
  );
  const completedCases = useMemo(
    () =>
      cases.filter((c) =>
        ["Completed", "Resolved", "Closed"].includes(c.status)
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
      in_progress: ["In Progress", "On Hold"],
      completed: ["Completed", "Resolved", "Closed"],
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
            <Button
              variant="ghost"
              className={SIDEBAR_BTN_CLASS}
              onClick={() => setView("settings")}
            >
              <Settings2 className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                Settings
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
          view === "landing"
            ? ""
            : "h-screen flex flex-col overflow-hidden"
        }`}
      >
        <header
          className={`${
            view === "landing"
              ? "fixed top-0 left-0 right-0 lg:left-auto"
              : "shrink-0"
          } z-20 bg-background/80 backdrop-blur-sm transition-all duration-300`}
          style={
            view === "landing"
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
            view === "landing"
              ? "pt-24 sm:pt-32 pb-8 px-4 sm:px-6 max-w-4xl mx-auto min-h-screen"
              : "flex-1 min-h-0 overflow-hidden"
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
                    onNavigate={(v) => {
                      if (v === "financial-vendors") {
                        setView("financial");
                        setFinancialTab("vendors");
                      } else {
                        setView(v as ViewState);
                      }
                    }}
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
                  <ThoughtBubble visible={hoveredCard === "maintenance"}>
                    <p className="text-gray-600">{newCases.length} new cases awaiting review</p>
                    <p className="text-gray-600">{inProgressCases.length} currently in progress</p>
                    <p className="text-emerald-600 font-medium">{completedCases.length} resolved this period</p>
                  </ThoughtBubble>
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
                  <ThoughtBubble visible={hoveredCard === "financial"}>
                    <p className="text-gray-600">${(stats?.monthlyRevenue || 0).toLocaleString()} monthly revenue</p>
                    <p className="text-gray-600">${totalEstimatedCost.toLocaleString()} in expenses</p>
                    <p className="text-emerald-600 font-medium">${((stats?.monthlyRevenue || 0) - totalEstimatedCost).toLocaleString()} net income</p>
                  </ThoughtBubble>
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
                  <ThoughtBubble visible={hoveredCard === "tenants"}>
                    <p className="text-gray-600">{totalUnits} total units managed</p>
                    <p className="text-gray-600">{properties.length} properties with tenants</p>
                    <p className="text-blue-600 font-medium">{totalUnits > 0 ? "100%" : "0%"} occupancy rate</p>
                  </ThoughtBubble>
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
                  <ThoughtBubble visible={hoveredCard === "portfolio"}>
                    <p className="text-gray-600">{properties.length} properties in portfolio</p>
                    <p className="text-gray-600">{totalUnits} total units across all</p>
                    <p className="text-violet-600 font-medium">${totalPropertyValue > 0 ? totalPropertyValue.toLocaleString() : "0"} total value</p>
                  </ThoughtBubble>
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

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Today's Schedule
                  </h3>
                  <button
                    className={FROSTED_CARD_CLASS}
                    onClick={() => setView("calendar")}
                    style={FROSTED_CARD_STYLE}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                      style={{ boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)" }}
                    />
                    <div
                      className="running-light-bar h-1 transition-all duration-300"
                      style={{
                        backdropFilter: "blur(16px) saturate(200%)",
                        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    />
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                          Calendar
                        </span>
                        <Calendar className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          Today
                        </span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          0
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Appointments
                          </span>
                          <span className="text-xs font-semibold text-gray-700">
                            None today
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">
                            This Week
                          </span>
                          <span className="text-sm font-bold text-blue-600">
                            View All
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Reminders
                  </h3>
                  <button
                    className={FROSTED_CARD_CLASS}
                    onClick={() => setView("reminders")}
                    style={FROSTED_CARD_STYLE}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                      style={{ boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)" }}
                    />
                    <div
                      className="running-light-bar h-1 transition-all duration-300"
                      style={{
                        backdropFilter: "blur(16px) saturate(200%)",
                        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    />
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                          Reminders
                        </span>
                        <Bell className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          Due Soon
                        </span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          {dueReminders.length}
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Overdue
                          </span>
                          <span className={`text-xs font-semibold ${overdueReminders.length > 0 ? "text-red-500" : "text-gray-700"}`}>
                            {overdueReminders.length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">
                            Total Active
                          </span>
                          <span className="text-xs font-semibold text-emerald-600">
                            {reminders.filter(r => r.status !== "Completed" && r.status !== "Cancelled").length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">
                            Next Due
                          </span>
                          <span className="text-sm font-bold text-amber-600">
                            {dueReminders.length > 0 && dueReminders[0]?.dueAt
                              ? format(new Date(dueReminders[0].dueAt), "MMM d")
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
                  Management Mode
                </h3>
                <button
                  className={FROSTED_CARD_CLASS}
                  onClick={() => setView("settings")}
                  style={FROSTED_CARD_STYLE}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                    style={{ boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)" }}
                  />
                  <div
                    className="running-light-bar h-1 transition-all duration-300"
                    style={{
                      backdropFilter: "blur(16px) saturate(200%)",
                      boxShadow: "inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)",
                    }}
                  />
                  <div className="relative p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                        Settings
                      </span>
                      <Settings2 className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">
                        {activePolicy?.involvementMode === "hands-off" ? "🙌" :
                         activePolicy?.involvementMode === "hands-on" ? "👋" :
                         activePolicy ? "⚖️" : "⚙️"}
                      </span>
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {activePolicy?.involvementMode === "hands-off" ? "Hands Off" :
                         activePolicy?.involvementMode === "hands-on" ? "Hands On" :
                         activePolicy ? "Balanced" : "Not Set"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {activePolicy?.involvementMode === "hands-off" ? "Auto-approve most things" :
                       activePolicy?.involvementMode === "hands-on" ? "Review everything" :
                       activePolicy ? "Review some, auto-approve trusted" : "Configure your management style"}
                    </p>
                  </div>
                </button>
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

              <MayaSidebarPanel
                context="maintenance"
                description="Ask Maya about your maintenance cases, priorities, or property management questions."
                placeholder="Ask Maya about maintenance..."
                suggestions={[
                  "What maintenance cases need attention?",
                  "Which cases are most urgent?",
                  "Show me overdue maintenance items",
                ]}
              >
                  {filteredCases.length === 0 ? (
                    <div className="text-center py-12">
                      <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No cases found</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        No maintenance cases match the current filters.
                      </p>
                    </div>
                  ) : viewMode === "cards" ? (
                    <div className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground mb-3">Showing {filteredCases.length} of {cases.length} cases</p>
                      <div className="flex items-start gap-4 overflow-x-auto pb-4 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
                        {filteredCases.map((c, idx) => {
                          const isSelected = selectedCaseId === c.id;
                          const imageMedia = c.media?.find(m => m.type === "image" || m.type?.startsWith("image"));
                          const shortTitle = (c.title || c.description || "").slice(0, 20) + ((c.title || c.description || "").length > 20 ? "..." : "");
                          const tenantShort = c.reporter ? `${(c.reporter.firstName || '').charAt(0)}. ${c.reporter.lastName || ''}`.trim() : null;
                          const unitShort = c.roomNumber ? `U${c.roomNumber}` : null;
                          const CatIcon = getCategoryIcon(c.category);
                          return (
                            <button
                              key={`${c.id}-${idx}`}
                              onClick={() => { setSelectedCaseId(c.id); setShowInlineRecs(false); }}
                              className="flex flex-col items-center min-w-[70px] sm:min-w-[90px] group touch-manipulation"
                            >
                              <div
                                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden ${
                                  isSelected ? "ring-2 ring-violet-400 scale-105" : "hover:scale-105"
                                }`}
                                style={{
                                  background: imageMedia?.url ? undefined : (isSelected
                                    ? "linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))"
                                    : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))"),
                                  boxShadow: isSelected
                                    ? "0 6px 20px rgba(139, 92, 246, 0.2)"
                                    : "0 4px 12px rgba(0,0,0,0.06)",
                                }}
                              >
                                {imageMedia?.url ? (
                                  <img src={imageMedia.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <CatIcon className={`h-5 w-5 ${isSelected ? "text-violet-500" : "text-gray-400"}`} />
                                )}
                                {(c.priority === "Urgent" || c.priority === "High") && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                    <span className="text-[8px] text-white font-bold">!</span>
                                  </div>
                                )}
                              </div>
                              <span className={`text-[10px] mt-1 font-semibold leading-tight text-center max-w-[80px] truncate ${isSelected ? "text-slate-800" : "text-slate-700"}`}>
                                {shortTitle || "Issue"}
                              </span>
                              <span className={`text-[9px] truncate max-w-[80px] ${c.assignedContractorName ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                                {c.assignedContractorName || [tenantShort, unitShort].filter(Boolean).join(" · ") || "Unassigned"}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {selectedCase && (
                        <Card className="mt-4 overflow-hidden">
                          <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-white dark:from-violet-950/30 dark:to-slate-900">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-12 h-12 rounded-full flex items-center justify-center text-slate-600 font-bold overflow-hidden"
                                  style={{
                                    background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                                    boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                                  }}
                                >
                                  {selectedCase.media?.[0]?.url ? (
                                    <img src={selectedCase.media[0].url} alt="" className="w-full h-full object-cover" />
                                  ) : (() => {
                                    const CatIcon = getCategoryIcon(selectedCase.category);
                                    return <CatIcon className="h-5 w-5 text-violet-400" />;
                                  })()}
                                </div>
                                <div>
                                  <h3 className="font-bold text-lg">
                                    {selectedCase.estimatedCost ? `$${parseFloat(String(selectedCase.estimatedCost)).toLocaleString()}` : "TBD"}
                                  </h3>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">{selectedCase.category || "General"}</span>
                                  </div>
                                  {(selectedCase.propertyName || selectedCase.buildingName) && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {selectedCase.propertyName || selectedCase.buildingName}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {(selectedCase.priority === "Urgent" || selectedCase.priority === "High") && (
                                  <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Urgent</Badge>
                                )}
                                <Badge variant="outline">{selectedCase.status}</Badge>
                              </div>
                            </div>
                          </div>
                          <CardContent className="p-4 space-y-4">
                            <div className="flex items-center gap-3">
                              {selectedCase.assignedContractorName ? (
                                <div className="flex-1 rounded-xl p-3 border-2 border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/20">
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-emerald-600" />
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                        {selectedCase.assignedContractorName}
                                      </span>
                                      <span className="text-[10px] text-emerald-600/70">
                                        {selectedCase.status === "Scheduled" ? "Job confirmed - awaiting schedule" :
                                         selectedCase.status === "In Review" ? "Awaiting quote & availability" :
                                         selectedCase.status === "In Progress" ? "Work in progress" :
                                         selectedCase.status === "Resolved" || selectedCase.status === "Closed" ? "Completed" :
                                         "Assigned"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  className="flex-1 h-11 touch-manipulation bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200/60"
                                  onClick={() => setShowInlineRecs(!showInlineRecs)}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Accept & Assign
                                </Button>
                              )}
                              <Button
                                className="h-11 touch-manipulation hover:bg-slate-50 border border-slate-200/60"
                                variant="outline"
                                disabled={statusMutation.isPending}
                                title={`Move to: ${STATUS_CYCLE[(STATUS_CYCLE.indexOf(selectedCase.status as any) + 1) % STATUS_CYCLE.length]}`}
                                onClick={() => {
                                  const currentIdx = STATUS_CYCLE.indexOf(selectedCase.status as any);
                                  const nextIdx = (currentIdx + 1) % STATUS_CYCLE.length;
                                  statusMutation.mutate({ caseId: String(selectedCase.id), status: STATUS_CYCLE[nextIdx] });
                                }}
                              >
                                {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4 mr-1" />}
                                Advance Status
                              </Button>
                              {selectedCase.status !== "Resolved" && selectedCase.status !== "Closed" && (
                                <Button
                                  className="h-11 touch-manipulation bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200/60"
                                  onClick={() => closeMutation.mutate({ caseId: selectedCase.id })}
                                  disabled={closeMutation.isPending}
                                >
                                  {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                  Resolve
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <span className="text-xs text-muted-foreground">Tenant:</span>
                                <p className="text-sm font-medium">{selectedCase.reporter ? `${selectedCase.reporter.firstName || ''} ${selectedCase.reporter.lastName || ''}`.trim() || "Unknown" : "Walk-in Request"}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Value:</span>
                                <p className="text-sm font-medium text-blue-600">{selectedCase.aiTriageJson?.estimatedCost || (selectedCase.estimatedCost ? `$${parseFloat(String(selectedCase.estimatedCost)).toLocaleString()}` : "TBD")}</p>
                              </div>
                            </div>

                            {showInlineRecs && !selectedCase.assignedContractorName && (
                              <div className="space-y-3 rounded-xl p-3 border border-violet-200 bg-violet-50/30 dark:bg-violet-900/10">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-violet-500" />
                                  <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Maya's Recommendations</span>
                                  {recommendations?.involvementMode && (
                                    <Badge variant="outline" className="text-[9px] ml-auto">
                                      {recommendations.involvementMode === 'hands-on' ? 'Hands-On' :
                                       recommendations.involvementMode === 'balanced' ? 'Balanced' : 'Hands-Off'}
                                    </Badge>
                                  )}
                                </div>

                                {recsLoading ? (
                                  <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                                    <span className="text-xs text-muted-foreground ml-2">Maya is analyzing...</span>
                                  </div>
                                ) : recommendations?.contractors?.length ? (
                                  <div className="space-y-2">
                                    {recommendations.contractors.map((contractor, idx) => (
                                      <div
                                        key={contractor.id}
                                        className="group/rec rounded-xl p-3 transition-all duration-200 hover:scale-[1.01] hover:shadow-md cursor-pointer"
                                        style={{
                                          ...FROSTED_CARD_STYLE,
                                          borderColor: idx === 0 ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.85)',
                                          boxShadow: idx === 0
                                            ? '0 4px 16px rgba(139,92,246,0.12), 0 2px 8px rgba(0,0,0,0.04)'
                                            : '0 2px 8px rgba(0,0,0,0.04)',
                                        }}
                                      >
                                        <div className="flex items-start justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                            {idx === 0 && <span className="text-xs">🥇</span>}
                                            {idx === 1 && <span className="text-xs">🥈</span>}
                                            {idx === 2 && <span className="text-xs">🥉</span>}
                                            <span className="text-sm font-semibold">{contractor.name}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {contractor.isTrusted && <Shield className="h-3 w-3 text-emerald-500" />}
                                            {contractor.isFavorite && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                                          {contractor.category && (
                                            <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{contractor.category}</span>
                                          )}
                                          {contractor.rating && (
                                            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" />{parseFloat(contractor.rating).toFixed(1)}</span>
                                          )}
                                          {contractor.responseTimeHours != null && (
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{contractor.responseTimeHours}h</span>
                                          )}
                                          {contractor.emergencyAvailable && (
                                            <span className="flex items-center gap-1 text-red-500"><Zap className="h-3 w-3" />24/7</span>
                                          )}
                                        </div>
                                        {contractor.specialties.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {contractor.specialties.slice(0, 3).map(s => (
                                              <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{s}</span>
                                            ))}
                                          </div>
                                        )}
                                        <p className="text-[10px] text-violet-600 dark:text-violet-400 italic mb-2">{contractor.mayaNote}</p>
                                        <Button
                                          size="sm"
                                          className="w-full h-7 text-xs bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 text-white shadow-sm"
                                          disabled={assignMutation.isPending}
                                          onClick={() => assignMutation.mutate({ caseId: selectedCase.id, vendorId: contractor.id })}
                                        >
                                          {assignMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}
                                          Assign {contractor.name.split(' ')[0]}
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-xl p-4 text-center" style={FROSTED_CARD_STYLE}>
                                    <User className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-xs text-muted-foreground">No contractors available for this category.</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">Add vendors in Portfolio → Vendors</p>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-3">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Job Details</p>
                              <div className="space-y-2 text-sm">
                                {(selectedCase.propertyName || selectedCase.buildingName) && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span>{selectedCase.propertyName || selectedCase.buildingName}</span>
                                    {selectedCase.roomNumber && <span className="text-xs">• Unit {selectedCase.roomNumber}</span>}
                                  </div>
                                )}
                                {selectedCase.reporter && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-3.5 w-3.5" />
                                    <span>Reported by {selectedCase.reporter.firstName} {selectedCase.reporter.lastName}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{selectedCase.createdAt ? format(new Date(selectedCase.createdAt), "MMM d, yyyy 'at' h:mm a") : "—"}</span>
                                </div>
                              </div>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{selectedCase.description}</p>

                              {(() => {
                                const images = (selectedCase.media || []).filter(m => m.type === "image" || m.type?.startsWith("image") || (!m.type && m.url));
                                if (images.length === 0) return null;
                                return (
                                  <div className="space-y-2">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attached Photos</span>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                      {images.map((m, imgIdx) => (
                                        <div key={m.id} className="relative h-24 w-24 rounded-lg overflow-hidden flex-shrink-0 group/photo border border-slate-200">
                                          <img src={m.url} alt={m.caption || "Case photo"} className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/photo:opacity-100 transition-opacity" />
                                          <span className="absolute bottom-1 left-1.5 text-[9px] text-white font-medium opacity-0 group-hover/photo:opacity-100 transition-opacity">
                                            {m.caption || `Photo ${imgIdx + 1}`}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {selectedCase.aiTriageJson && (
                              <Card className="border-2 border-violet-200 dark:border-violet-700">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                                        <Sparkles className="h-3 w-3 text-white" />
                                      </div>
                                      <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Maya AI Assessment</span>
                                    </div>
                                    <PhotoAnalysisButton
                                      media={(selectedCase.media || []).map(m => ({ ...m, id: String(m.id) }))}
                                      photoAnalysis={selectedCase.aiTriageJson?.photoAnalysis}
                                    />
                                  </div>
                                  <div className="rounded-lg border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white dark:from-violet-950/20 dark:to-slate-900 p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-slate-500">Urgency</span>
                                      {selectedCase.aiTriageJson.urgency && (
                                        <Badge className={
                                          selectedCase.aiTriageJson.urgency.toLowerCase().includes("critical") ? "bg-red-100 text-red-700 border-red-200" :
                                          selectedCase.aiTriageJson.urgency.toLowerCase().includes("high") || selectedCase.aiTriageJson.urgency.toLowerCase().includes("urgent") ? "bg-orange-100 text-orange-700 border-orange-200" :
                                          selectedCase.aiTriageJson.urgency.toLowerCase().includes("moderate") ? "bg-amber-100 text-amber-700 border-amber-200" :
                                          "bg-green-100 text-green-700 border-green-200"
                                        }>
                                          {selectedCase.aiTriageJson.urgency}
                                        </Badge>
                                      )}
                                    </div>
                                    {selectedCase.aiTriageJson.rootCause && (
                                      <div>
                                        <span className="text-xs text-slate-500 block mb-0.5">Likely Cause</span>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{selectedCase.aiTriageJson.rootCause}</p>
                                      </div>
                                    )}
                                    <div className="flex gap-4">
                                      {selectedCase.aiTriageJson.estimatedCost && (
                                        <div>
                                          <span className="text-xs text-slate-500 block">Est. Cost</span>
                                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedCase.aiTriageJson.estimatedCost}</p>
                                        </div>
                                      )}
                                      {selectedCase.aiTriageJson.estimatedTime && (
                                        <div>
                                          <span className="text-xs text-slate-500 block">Est. Time</span>
                                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedCase.aiTriageJson.estimatedTime}</p>
                                        </div>
                                      )}
                                    </div>
                                    {selectedCase.aiTriageJson.suggestedActions && selectedCase.aiTriageJson.suggestedActions.length > 0 && (
                                      <div>
                                        <span className="text-xs text-slate-500 block mb-1">Suggested Steps</span>
                                        <ul className="space-y-1">
                                          {selectedCase.aiTriageJson.suggestedActions.map((action, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                              <CheckCircle className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
                                              <span>{action}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {selectedCase.aiTriageJson.safetyNotes && (
                                      <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                        <p className="text-xs text-amber-700 dark:text-amber-300">{selectedCase.aiTriageJson.safetyNotes}</p>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}


                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <MessageCircle className="h-4 w-4 text-violet-500" />
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Messages</span>
                                  {caseEvents.length > 0 && (
                                    <span className="text-xs text-slate-400 ml-auto">{caseEvents.length}</span>
                                  )}
                                </div>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto mb-3" style={{ minHeight: "40px" }}>
                                  {caseEvents.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-3">No messages yet. Add a note below.</p>
                                  ) : (
                                    caseEvents.map((evt) => {
                                      const isNote = evt.type === "landlord_note";
                                      return (
                                        <div key={evt.id} className={`flex ${isNote ? "justify-end" : "justify-start"}`}>
                                          <div
                                            className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-sm ${
                                              isNote
                                                ? "bg-violet-500 text-white rounded-br-sm"
                                                : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm"
                                            }`}
                                          >
                                            {!isNote && (
                                              <p className={`text-[10px] font-medium mb-0.5 ${isNote ? "text-violet-200" : "text-slate-500"}`}>
                                                {evt.type.replace(/_/g, " ")}
                                              </p>
                                            )}
                                            <p className="break-words">{evt.description}</p>
                                            <p className={`text-[10px] mt-0.5 ${isNote ? "text-violet-200" : "text-slate-400"}`}>
                                              {evt.createdAt ? formatDistanceToNow(new Date(evt.createdAt), { addSuffix: true }) : ""}
                                              {isNote && evt.metadata?.userName ? ` · ${evt.metadata.userName}` : ""}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                                <div className="flex gap-2 border-t pt-3">
                                  <Input
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey && noteText.trim()) {
                                        e.preventDefault();
                                        noteMutation.mutate({ caseId: selectedCase.id, note: noteText.trim() });
                                      }
                                    }}
                                    placeholder="Add a note..."
                                    className="h-9 text-sm"
                                    disabled={noteMutation.isPending}
                                  />
                                  <Button
                                    size="sm"
                                    className="h-9 px-3 bg-violet-500 hover:bg-violet-600"
                                    onClick={() => {
                                      if (noteText.trim()) {
                                        noteMutation.mutate({ caseId: selectedCase.id, note: noteText.trim() });
                                      }
                                    }}
                                    disabled={!noteText.trim() || noteMutation.isPending}
                                  >
                                    {noteMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : viewMode === "list" ? (
                    <div className="space-y-1 p-4">
                      {filteredCases.map((c) => (
                        <button
                          key={c.id}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-muted/50 ${
                            selectedCaseId === c.id
                              ? "bg-blue-50/50 dark:bg-blue-900/20 border border-blue-300"
                              : ""
                          }`}
                          onClick={() => { setSelectedCaseId(c.id); setShowInlineRecs(false); }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {c.title}
                              </span>
                              {(c.priority === "Urgent" || c.priority === "High") && (
                                <Badge variant="destructive" className="text-[10px] shrink-0 gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Urgent
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] shrink-0">{c.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {c.propertyName || c.buildingName} • {c.category}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {c.createdAt ? format(new Date(c.createdAt), "MMM d") : ""}
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
                  )}
              </MayaSidebarPanel>
            </div>
          )}

          {view === "portfolio" && (
            <Tabs value={portfolioTab} onValueChange={setPortfolioTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 px-4 sm:px-6 py-3 space-y-3 hub-themed-content">
                <div className="rounded-2xl px-4 py-3 space-y-3" style={{
                  ...FROSTED_CARD_STYLE,
                  boxShadow: '0 8px 32px rgba(139,92,246,0.08), 0 4px 16px rgba(0,0,0,0.06)',
                }}>
                  <div className="flex items-center gap-1 mb-1">
                    <Building className="h-3 w-3 text-violet-500" />
                    <span className="text-[9px] font-semibold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                      Portfolio Management
                    </span>
                  </div>
                  <TabsList className="grid w-full max-w-lg grid-cols-2">
                    <TabsTrigger value="properties">
                      <Building className="h-4 w-4 mr-2" />
                      Properties
                    </TabsTrigger>
                    <TabsTrigger value="entities">
                      <Building2 className="h-4 w-4 mr-2" />
                      Entities
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
              <MayaSidebarPanel
                context="portfolio"
                description="Ask Maya about your properties, entities, valuations, or portfolio performance."
                placeholder="Ask about your portfolio..."
                suggestions={[
                  "What's my total portfolio value?",
                  "Which properties have vacancies?",
                  "Show me properties by entity",
                ]}
              >
                <TabsContent value="properties" className="mt-0">
                  <Properties />
                </TabsContent>
                <TabsContent value="entities" className="mt-0">
                  <Entities />
                </TabsContent>
              </MayaSidebarPanel>
            </Tabs>
          )}

          {view === "tenants" && (
            <MayaSidebarPanel
              context="tenants"
              description="Ask Maya about your tenants, lease renewals, occupancy, or tenant communications."
              placeholder="Ask about tenants..."
              suggestions={[
                "Which leases are expiring soon?",
                "What's my current occupancy rate?",
                "Any tenants with overdue rent?",
              ]}
            >
              <HubTenantsView />
            </MayaSidebarPanel>
          )}

          {view === "financial" && (
            <Tabs value={financialTab} onValueChange={setFinancialTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 px-4 sm:px-6 py-3 space-y-3 hub-themed-content">
                <div className="rounded-2xl px-4 py-3 space-y-3" style={{
                  ...FROSTED_CARD_STYLE,
                  boxShadow: '0 8px 32px rgba(139,92,246,0.08), 0 4px 16px rgba(0,0,0,0.06)',
                }}>
                  <div className="flex items-center gap-1 mb-1">
                    <DollarSign className="h-3 w-3 text-violet-500" />
                    <span className="text-[9px] font-semibold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                      Financial Management
                    </span>
                  </div>
                  <TabsList className="grid w-full max-w-lg grid-cols-4">
                    <TabsTrigger value="expenses">
                      <Receipt className="h-4 w-4 mr-2" />
                      Expenses
                    </TabsTrigger>
                    <TabsTrigger value="revenue">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Revenue
                    </TabsTrigger>
                    <TabsTrigger value="vendors">
                      <Contact className="h-4 w-4 mr-2" />
                      Vendors
                    </TabsTrigger>
                    <TabsTrigger value="tax">
                      <Calculator className="h-4 w-4 mr-2" />
                      Tax
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
              <MayaSidebarPanel
                context="financial"
                description="Ask Maya about your expenses, revenue, cash flow, or tax deductions."
                placeholder="Ask about finances..."
                suggestions={[
                  "What are my biggest expenses this quarter?",
                  "Which properties cost the most to maintain?",
                  "What's my net operating income?",
                ]}
              >
                <TabsContent value="expenses" className="mt-0">
                  <Expenses />
                </TabsContent>
                <TabsContent value="revenue" className="mt-0">
                  <Revenue />
                </TabsContent>
                <TabsContent value="vendors" className="mt-0">
                  <HubVendorsView />
                </TabsContent>
                <TabsContent value="tax" className="mt-0">
                  <Tax />
                </TabsContent>
              </MayaSidebarPanel>
            </Tabs>
          )}

          {view === "calendar" && (
            <MayaSidebarPanel
              context="calendar"
              description="Ask Maya about your schedule, upcoming inspections, or appointment conflicts."
              placeholder="Ask about your schedule..."
              suggestions={[
                "What's scheduled for this week?",
                "Any upcoming property inspections?",
                "When is my next lease renewal?",
              ]}
            >
              <HubCalendarView />
            </MayaSidebarPanel>
          )}

          {view === "reminders" && (
            <MayaSidebarPanel
              context="reminders"
              description="Ask Maya about your tasks, deadlines, overdue items, or compliance requirements."
              placeholder="Ask about reminders..."
              suggestions={[
                "What reminders are due this week?",
                "Which properties have overdue tasks?",
                "Show me all lease renewal reminders",
              ]}
            >
              <HubRemindersView />
            </MayaSidebarPanel>
          )}

          {view === "inbox" && (
            <MayaSidebarPanel
              context="inbox"
              description="Ask Maya about your messages, tenant communications, or unread notifications."
              placeholder="Ask about messages..."
              suggestions={[
                "Any urgent messages I haven't responded to?",
                "Summarize recent tenant communications",
                "Which messages need immediate attention?",
              ]}
            >
              <HubInboxView />
            </MayaSidebarPanel>
          )}

          {view === "settings" && (
            <MayaSidebarPanel
              context="settings"
              description="Ask Maya about your approval settings, management mode, or automation preferences."
              placeholder="Ask about settings..."
              suggestions={[
                "What's my current management mode?",
                "Should I switch to hands-off mode?",
                "How do auto-approval thresholds work?",
              ]}
            >
              <HubSettingsView />
            </MayaSidebarPanel>
          )}
        </main>
      </div>
    </div>
  );
}
