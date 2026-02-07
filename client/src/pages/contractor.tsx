import { useState, useRef, useEffect, useMemo } from "react";
import { format, isToday, isTomorrow, parseISO, startOfDay, endOfDay } from "date-fns";
import { AnimatedPyramid } from "@/components/AnimatedPyramid";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Menu, 
  Send, 
  Mic, 
  ArrowLeft,
  Clock,
  DollarSign,
  Home,
  LogOut,
  Sparkles,
  Search,
  User,
  Briefcase,
  Calendar,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Users,
  Receipt,
  Plus,
  ExternalLink,
  Building2,
  Mail,
  Bell,
  MapPin,
  Edit2,
  Trash2,
  Phone,
  UserPlus,
  Loader2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TeamCalendar } from "@/components/contractor/team-calendar";
import { TeamTimeline } from "@/components/contractor/team-timeline";
import { Sparkline } from "@/components/contractor/sparkline";
import { ThoughtBubble } from "@/components/contractor/thought-bubble";
import { MayaCarouselLayout } from "@/components/contractor/maya-carousel-layout";
import { CustomersContent } from "@/pages/customers";
import { QuickAdd } from "@/components/contractor/quick-add-fab";
import { TeamView } from "@/components/contractor/team-view";
import { ThreadChat } from "@/components/contractor/thread-chat";
import { MayaPhotoAnalysis, PhotoAnalysisButton } from "@/components/contractor/maya-photo-analysis";

type ViewState = "landing" | "jobDetail" | "pastJobs" | "calendar" | "quotes" | "customers" | "newJobs" | "activeJobs" | "messages" | "team";

interface ChatMessage {
  id: string;
  sender: "contractor" | "customer" | "maya";
  message: string;
  timestamp: Date;
  isRead?: boolean;
}

interface ContractorCase {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  buildingName?: string;
  roomNumber?: string;
  locationText?: string;
  estimatedCost?: number;
  actualCost?: number;
  assignedContractorId?: string;
  createdAt: string;
  updatedAt: string;
  customerId?: string;
  customer?: { id: string; name: string; email?: string; phone?: string };
}

interface ContractorCustomer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  notes?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  geocodedAt?: string | null;
}

interface ContractorQuote {
  id: string;
  customerId?: string;
  customer?: ContractorCustomer;
  caseId?: string;
  title?: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  expiresAt?: string;
  createdAt: string;
  depositType?: string;
  depositAmount?: string;
  clientMessage?: string;
  internalNotes?: string;
  discountAmount?: string;
  taxPercent?: string;
  depositValue?: string;
}

interface ContractorAppointment {
  id: string;
  caseId?: string;
  contractorId: string;
  title?: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  notes?: string;
}

const BUBBLE_COLORS = [
  { bg: "bg-rose-500", glow: "rgba(244, 63, 94, 0.5)", ring: "ring-rose-400", bgLight: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-600 dark:text-rose-400" },
  { bg: "bg-emerald-500", glow: "rgba(16, 185, 129, 0.5)", ring: "ring-emerald-400", bgLight: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" },
  { bg: "bg-violet-500", glow: "rgba(139, 92, 246, 0.5)", ring: "ring-violet-400", bgLight: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-400" },
  { bg: "bg-blue-500", glow: "rgba(59, 130, 246, 0.5)", ring: "ring-blue-400", bgLight: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
  { bg: "bg-amber-500", glow: "rgba(245, 158, 11, 0.5)", ring: "ring-amber-400", bgLight: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-cyan-500", glow: "rgba(6, 182, 212, 0.5)", ring: "ring-cyan-400", bgLight: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-600 dark:text-cyan-400" },
];

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getBubbleColor = (index: number) => BUBBLE_COLORS[index % BUBBLE_COLORS.length];

export default function Contractor() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [view, setView] = useState<ViewState>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get("view");
    if (urlView && ["landing", "jobDetail", "pastJobs", "calendar", "quotes", "customers", "newJobs", "activeJobs", "messages", "team"].includes(urlView)) {
      return urlView as ViewState;
    }
    return "landing";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [mayaInput, setMayaInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mayaSuggestionIndex, setMayaSuggestionIndex] = useState(0);
  const [showMayaBubble, setShowMayaBubble] = useState(false);
  const [mayaHovered, setMayaHovered] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  
  const mayaSuggestions = [
    "Which job is most lucrative?",
    "What should I prioritize today?",
    "Any quotes need follow-up?"
  ];
  
  useEffect(() => {
    if (!mayaHovered) return;
    const interval = setInterval(() => {
      setShowMayaBubble(false);
      setTimeout(() => {
        setMayaSuggestionIndex((prev) => (prev + 1) % mayaSuggestions.length);
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
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [isMayaTyping, setIsMayaTyping] = useState(false);
  const [mayaChatMessages, setMayaChatMessages] = useState<ChatMessage[]>([
    {
      id: "maya-welcome",
      sender: "maya",
      message: "Hi! I'm Maya, your AI assistant. I can help you manage jobs, schedule appointments, create quotes, and more. What would you like to do?",
      timestamp: new Date(),
    }
  ]);

  const firstName = user?.firstName || user?.username?.split("@")[0] || "John";

  // Fetch real data from APIs - both direct assignments and marketplace offers
  const { data: cases = [], isLoading: casesLoading } = useQuery<ContractorCase[]>({
    queryKey: ['/api/contractor/cases'],
    enabled: !!user
  });

  const { data: marketplaceCases = [], isLoading: marketplaceLoading } = useQuery<ContractorCase[]>({
    queryKey: ['/api/marketplace/cases'],
    enabled: !!user
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<ContractorQuote[]>({
    queryKey: ['/api/contractor/quotes'],
    enabled: !!user
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<ContractorCustomer[]>({
    queryKey: ['/api/contractor/customers'],
    enabled: !!user
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<ContractorAppointment[]>({
    queryKey: ['/api/contractor/appointments'],
    enabled: !!user
  });

  // Dashboard metrics for sparklines (real historical data)
  const { data: dashboardMetrics } = useQuery<{
    requests: { received: number[]; converted: number[] };
    quotes: { sent: number[]; approved: number[] };
    jobs: { started: number[]; completed: number[] };
    invoices: { sent: number[]; paid: number[] };
    days: string[];
  }>({
    queryKey: ['/api/contractor/dashboard-metrics'],
    enabled: !!user
  });

  // Team members query
  const { data: teamData } = useQuery<{
    allMembers: Array<{
      id: string;
      memberId: string;
      name: string;
      email?: string;
      phone?: string;
      role?: string;
      color: string;
      hasLogin: boolean;
    }>;
  }>({
    queryKey: ['/api/contractor/team-members'],
    enabled: !!user
  });

  // Team calendar appointments
  const { data: teamAppointments = [] } = useQuery<Array<{
    id: string;
    title?: string;
    scheduledStartAt: string;
    scheduledEndAt: string;
    status?: string;
    contractorId: string;
    address?: string;
    customerName?: string;
  }>>({
    queryKey: ['/api/contractor/team-calendar'],
    enabled: !!user
  });

  // Combine direct assignments and marketplace jobs, transform to displayable format
  const jobs = useMemo(() => {
    const allCases = [
      ...cases.map(c => ({ ...c, source: 'direct' as const })),
      ...marketplaceCases.map(c => ({ ...c, source: 'marketplace' as const }))
    ];
    
    // Remove duplicates by ID
    const uniqueCases = allCases.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
    
    return uniqueCases.map((c, index) => {
      const color = getBubbleColor(index);
      const customerName = c.customer?.name || c.buildingName || "New Job";
      const parsedCost = typeof c.estimatedCost === 'string' 
        ? parseFloat(c.estimatedCost) || 0 
        : (c.estimatedCost || 0);
      let estimatedValue = parsedCost;
      if (estimatedValue === 0 && (c as any).aiTriageJson?.estimatedCost) {
        const costStr = (c as any).aiTriageJson.estimatedCost as string;
        const nums = costStr.match(/[\d,]+/g);
        if (nums && nums.length > 0) {
          const highest = Math.max(...nums.map(n => parseFloat(n.replace(/,/g, '')) || 0));
          if (highest > 0) estimatedValue = highest;
        }
      }
      return {
        ...c,
        customerName,
        customerInitials: getInitials(customerName),
        color,
        estimatedValue,
      };
    });
  }, [cases, marketplaceCases]);

  const selectedCase = selectedCaseId ? jobs.find(j => j.id === selectedCaseId) : null;

  // Calculate counts
  const newJobsCount = jobs.filter(j => ["New", "In Review", "Pending", "Submitted", "Open"].includes(j.status)).length;
  const activeJobs = jobs.filter(j => ["In Progress", "Scheduled", "Confirmed"].includes(j.status));
  const activeJobsCount = activeJobs.length;
  const completedJobsCount = jobs.filter(j => j.status === "Completed").length;
  const allJobsCount = activeJobsCount + completedJobsCount;
  const scheduledJobsCount = appointments.filter(a => a.status === "Confirmed" || a.status === "Scheduled" || a.status === "Pending").length;
  const quotesCount = quotes.length;
  const draftQuotesCount = quotes.filter(q => q.status === "draft").length;
  const approvedQuotesCount = quotes.filter(q => q.status === "approved").length;

  // Today's appointments - for the schedule view
  const todaysAppointments = useMemo(() => {
    return appointments
      .filter(apt => {
        if (!apt.scheduledStartAt) return false;
        const aptDate = typeof apt.scheduledStartAt === 'string' ? parseISO(apt.scheduledStartAt) : apt.scheduledStartAt;
        return isToday(aptDate);
      })
      .sort((a, b) => {
        const dateA = typeof a.scheduledStartAt === 'string' ? parseISO(a.scheduledStartAt) : a.scheduledStartAt;
        const dateB = typeof b.scheduledStartAt === 'string' ? parseISO(b.scheduledStartAt) : b.scheduledStartAt;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
  }, [appointments]);

  // Next upcoming appointment (any future date) - for the hero card
  const nextUpcomingAppointment = useMemo(() => {
    const now = new Date();
    const upcoming = appointments
      .filter(apt => {
        if (!apt.scheduledStartAt) return false;
        const aptDate = typeof apt.scheduledStartAt === 'string' ? parseISO(apt.scheduledStartAt) : new Date(apt.scheduledStartAt);
        return aptDate > now && ['Confirmed', 'Pending', 'Scheduled'].includes(apt.status);
      })
      .sort((a, b) => {
        const dateA = typeof a.scheduledStartAt === 'string' ? parseISO(a.scheduledStartAt) : a.scheduledStartAt;
        const dateB = typeof b.scheduledStartAt === 'string' ? parseISO(b.scheduledStartAt) : b.scheduledStartAt;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    return upcoming[0] || null;
  }, [appointments]);

  const conversationsQuery = useQuery<any[]>({
    queryKey: ["/api/messaging/conversations"],
    staleTime: 30000,
    refetchInterval: 30000,
  });
  const totalUnreadMessages = useMemo(() => {
    if (!conversationsQuery.data) return 0;
    return conversationsQuery.data.reduce((s: number, c: any) => s + (c.unreadCount || 0), 0);
  }, [conversationsQuery.data]);

  // Quick categories with real counts - 8 items in 2 rows of 4
  const quickCategories = [
    { id: "new-jobs", label: "New Jobs", icon: Briefcase, count: newJobsCount },
    { id: "active-jobs", label: "Active", icon: CheckCircle, count: activeJobsCount },
    { id: "schedule", label: "Schedule", icon: Calendar, count: scheduledJobsCount },
    { id: "quotes", label: "Quotes", icon: Receipt, count: quotesCount },
    { id: "inbox", label: "Inbox", icon: Mail, count: 0 },
    { id: "customers", label: "Customers", icon: Users, count: customers.length },
    { id: "reminders", label: "Reminders", icon: Bell, count: 0 },
    { id: "messages", label: "Messages", icon: MessageSquare, count: totalUnreadMessages },
  ];

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
  };

  // Placeholder for unread count - would come from real messaging system
  const getUnreadCount = (job: any) => {
    return 0; // TODO: Implement real unread message count from messaging API
  };

  // Accept case mutation
  const acceptCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      return await apiRequest("POST", `/api/contractor/accept-case`, { caseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/appointments'] });
      toast({ title: "Job Accepted", description: "You've accepted this job." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to accept job.", variant: "destructive" });
    }
  });

  // Update case status mutation
  const updateCaseStatus = useMutation({
    mutationFn: async ({ caseId, status }: { caseId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/cases/${caseId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/cases'] });
      toast({ title: "Status Updated", description: "Job status has been updated." });
    }
  });

  const handleMayaSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!mayaInput.trim()) return;
    
    const userMessage = mayaInput;
    setMayaInput("");
    
    const userChatMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "contractor",
      message: userMessage,
      timestamp: new Date(),
    };
    setMayaChatMessages(prev => [...prev, userChatMessage]);
    setIsMayaTyping(true);

    // Real Maya AI call
    try {
      const res = await apiRequest("POST", "/api/contractor/maya-chat", {
        message: userMessage,
        context: {
          newJobs: newJobsCount,
          scheduledJobs: scheduledJobsCount,
          totalQuotes: quotesCount,
        }
      });
      const data = await res.json();
      
      const mayaResponse: ChatMessage = {
        id: `maya-${Date.now()}`,
        sender: "maya",
        message: data.reply || "I'm here to help. What would you like to know about your jobs or schedule?",
        timestamp: new Date(),
      };
      setMayaChatMessages(prev => [...prev, mayaResponse]);
    } catch (error) {
      // Fallback to simple responses
      let mayaResponse = "I'm here to help you manage your work. You can ask me about your schedule, create quotes, or get insights about your jobs.";
      
      if (userMessage.toLowerCase().includes("schedule") || userMessage.toLowerCase().includes("today")) {
        mayaResponse = `You have ${scheduledJobsCount} appointments scheduled.`;
      } else if (userMessage.toLowerCase().includes("new") || userMessage.toLowerCase().includes("jobs")) {
        mayaResponse = `You have ${newJobsCount} new job requests waiting for your response.`;
      } else if (userMessage.toLowerCase().includes("quote") || userMessage.toLowerCase().includes("price")) {
        mayaResponse = `You have ${quotesCount} quotes. ${draftQuotesCount} are still drafts. Would you like to create a new quote?`;
      }
      
      const mayaChatResponse: ChatMessage = {
        id: `maya-${Date.now()}`,
        sender: "maya",
        message: mayaResponse,
        timestamp: new Date(),
      };
      setMayaChatMessages(prev => [...prev, mayaChatResponse]);
    } finally {
      setIsMayaTyping(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mayaChatMessages, selectedCase]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Urgent": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "High": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "Normal": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default: return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New": return "bg-blue-100 text-blue-700";
      case "Scheduled": return "bg-purple-100 text-purple-700";
      case "In Progress": return "bg-orange-100 text-orange-700";
      case "Completed": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Left Sidebar - Frosted Glass */}
      <aside 
        className={`fixed left-0 top-0 h-full bg-background/95 backdrop-blur-xl border-r flex flex-col z-40 transition-all duration-300 ${
          sidebarOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full lg:translate-x-0 lg:w-0"
        } overflow-hidden`}
      >
        <div className="w-72 h-full flex flex-col">
          {/* Header with Search */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                  <Home className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-sm">Contractor Hub</span>
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

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {/* Home - Standalone at top */}
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => setView("landing")}
            >
              <Home className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Home</span>
            </Button>
            
            {/* Separator - Purple-Blue Gradient */}
            <div className="my-3 mx-3 h-[1px] bg-gradient-to-r from-violet-400/40 via-blue-400/40 to-transparent" />
            
            {/* WORK Section - Natural workflow: Requests → Quotes → Jobs → Invoices */}
            <div className="px-3 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Work</span>
            </div>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => setView("newJobs" as ViewState)}
            >
              <Briefcase className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Requests</span>
              {newJobsCount > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">{newJobsCount}</Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => navigate("/quotes")}
            >
              <Receipt className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Quotes</span>
              {draftQuotesCount > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-amber-100 text-amber-700 hover:bg-amber-100">{draftQuotesCount}</Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => setView("activeJobs" as ViewState)}
            >
              <CheckCircle className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Jobs</span>
              {allJobsCount > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{allJobsCount}</Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => toast({ title: "Invoices", description: "Invoice management coming soon" })}
            >
              <DollarSign className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Invoices</span>
              {approvedQuotesCount > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-violet-100 text-violet-700 hover:bg-violet-100">{approvedQuotesCount}</Badge>
              )}
            </Button>
            
            {/* Separator - Purple-Blue Gradient */}
            <div className="my-3 mx-3 h-[1px] bg-gradient-to-r from-violet-400/40 via-blue-400/40 to-transparent" />
            
            {/* MANAGE Section */}
            <div className="px-3 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Manage</span>
            </div>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => navigate("/contractor-schedule")}
            >
              <Calendar className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Schedule</span>
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => setView("customers")}
            >
              <Users className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Customers</span>
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => setView("team" as ViewState)}
            >
              <Users className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Team</span>
            </Button>
            
            {/* Separator - Purple-Blue Gradient */}
            <div className="my-3 mx-3 h-[1px] bg-gradient-to-r from-violet-400/40 via-blue-400/40 to-transparent" />
            
            {/* ACCOUNT Section */}
            <div className="px-3 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Account</span>
            </div>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => navigate("/inbox")}
            >
              <Mail className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Inbox</span>
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => navigate("/reminders")}
            >
              <Bell className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Reminders</span>
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-11 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35 touch-manipulation"
              onClick={() => toast({ title: "Profile", description: "Profile settings coming soon" })}
            >
              <User className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Profile</span>
            </Button>
          </div>

          {/* Sign Out at Bottom */}
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

      {/* Main Content Area - uses grid for customers view */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-72" : "ml-0"} ${view === "customers" ? "h-screen grid grid-rows-[auto_1fr] overflow-hidden" : view === "newJobs" || view === "activeJobs" || view === "quotes" || view === "team" ? "h-screen flex flex-col overflow-hidden" : ""}`}>
        {/* Header */}
        <header className={`${view === "customers" || view === "newJobs" || view === "activeJobs" || view === "quotes" || view === "team" ? (view === "customers" ? "row-start-1" : "shrink-0") : "fixed top-0 left-0 right-0 lg:left-auto"} z-20 bg-background/80 backdrop-blur-sm transition-all duration-300`} style={view !== "customers" && view !== "newJobs" && view !== "activeJobs" && view !== "quotes" && view !== "team" ? { left: sidebarOpen ? "288px" : "0" } : undefined}>
          <div className="relative flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="absolute left-2 sm:left-4 h-10 w-10 touch-manipulation">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            {(sidebarOpen && view !== "landing") || (!sidebarOpen && view !== "landing" && !selectedCaseId) ? (
              <Button variant="ghost" size="sm" onClick={() => { setView("landing"); setSelectedCaseId(null); }} className="absolute left-2 sm:left-4 gap-2 h-10 touch-manipulation">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            ) : null}
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <AnimatedPyramid size={56} />
                <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">AllAI</span>
              </div>
              <span className="text-xs text-muted-foreground italic mt-1">Pro tools for contractors</span>
            </div>
          </div>
        </header>

        {/* Main Content - different layout for customers view */}
        {view !== "customers" ? (
        <main className={`flex flex-col ${
          view === "newJobs" || view === "activeJobs" || view === "quotes" 
            ? "flex-1 min-h-0 overflow-hidden" 
            : "pt-24 sm:pt-32 pb-8 px-4 sm:px-6 max-w-4xl mx-auto min-h-screen"
        }`}>
        
        {/* Landing View - Action-Focused Dashboard */}
        {view === "landing" && !selectedCaseId && (
          <div className="flex-1 flex flex-col pt-4">
            {/* Top Row - Greeting + Quick Add + Maya Button */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(), 'EEEE, MMMM d')}
                </p>
              </div>
              <div className="flex items-center gap-2">
              <QuickAdd onNavigate={(v) => setView(v as ViewState)} />
              <div 
                className="relative"
                onMouseEnter={() => setMayaHovered(true)}
                onMouseLeave={() => setMayaHovered(false)}
              >
                <div 
                  className={`absolute -top-12 right-0 px-3 py-1.5 rounded-lg text-xs text-violet-600 dark:text-violet-400 whitespace-nowrap transition-all duration-300 ${showMayaBubble ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.15)'
                  }}
                >
                  {mayaSuggestions[mayaSuggestionIndex]}
                  <div className="absolute -bottom-1 right-6 w-2 h-2 rotate-45" style={{ background: 'rgba(139, 92, 246, 0.15)', borderRight: '1px solid rgba(139, 92, 246, 0.25)', borderBottom: '1px solid rgba(139, 92, 246, 0.25)' }} />
                </div>
                <button
                  onClick={() => setView("maya" as ViewState)}
                  className={`group flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${mayaHovered ? 'scale-105' : ''}`}
                  style={{
                    background: mayaHovered 
                      ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.35) 0%, rgba(59, 130, 246, 0.35) 100%)'
                      : 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
                    border: `1px solid ${mayaHovered ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.3)'}`,
                    boxShadow: mayaHovered 
                      ? '0 6px 24px rgba(139, 92, 246, 0.4)' 
                      : '0 4px 12px rgba(139, 92, 246, 0.15)'
                  }}
                >
                  <Sparkles className={`h-4 w-4 transition-colors ${mayaHovered ? 'text-violet-400' : 'text-violet-500'}`} />
                  <span className={`text-sm font-medium transition-colors ${mayaHovered ? 'text-violet-600 dark:text-violet-300' : 'text-violet-700 dark:text-violet-400'}`}>Ask Maya</span>
                </button>
              </div>
              </div>
            </div>

            {/* Jobber-Style 4-Column Dashboard Grid - Frosted Glass */}
            {(() => {
              const requestsCount = newJobsCount;
              const requestsValue = jobs
                .filter(j => ["New", "In Review", "Pending", "Submitted", "Open"].includes(j.status))
                .reduce((sum, j) => sum + (Number(j.estimatedValue) || 0), 0);
              
              const draftQuotes = quotes.filter(q => q.status === 'draft');
              const sentQuotes = quotes.filter(q => q.status === 'sent');
              const sentQuotesValue = sentQuotes.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);
              
              const activeJobsValue = activeJobs.reduce((sum, j) => sum + (Number(j.estimatedValue) || 0), 0);
              
              const approvedQuotes = quotes.filter(q => q.status === 'approved');
              const totalOwed = approvedQuotes.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);
              
              // Additional metrics for Jobber-like sub-rows
              const assessmentCompleted = jobs.filter(j => j.status === 'Assessed').length;
              const overdueRequests = jobs.filter(j => {
                const created = new Date(j.createdAt);
                const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
                return ["New", "Pending"].includes(j.status) && daysSince > 7;
              }).length;
              const changesRequested = quotes.filter(q => q.status === 'changes_requested').length;
              const requiresInvoicing = jobs.filter(j => j.status === 'Completed').length;
              const pastDueInvoices = 0; // Would come from invoices API
              const awaitingPayment = approvedQuotes.length;
              
              // Sparkline data from real historical metrics API (with fallback to current values only)
              const requestsSparkline = dashboardMetrics?.requests ?? { received: [requestsCount], converted: [assessmentCompleted] };
              const quotesSparkline = dashboardMetrics?.quotes ?? { sent: [sentQuotes.length], approved: [approvedQuotes.length] };
              const jobsSparkline = dashboardMetrics?.jobs ?? { started: [activeJobs.length], completed: [requiresInvoicing] };
              const invoicesSparkline = dashboardMetrics?.invoices ?? { sent: [awaitingPayment], paid: [0] };
              
              // Calculate summary stats for tooltips
              const requestsTotal7Days = requestsSparkline.received.reduce((a, b) => a + b, 0);
              const requestsConverted7Days = requestsSparkline.converted.reduce((a, b) => a + b, 0);
              const requestsConversionRate = requestsTotal7Days > 0 ? Math.round((requestsConverted7Days / requestsTotal7Days) * 100) : 0;
              
              const quotesSent7Days = quotesSparkline.sent.reduce((a, b) => a + b, 0);
              const quotesApproved7Days = quotesSparkline.approved.reduce((a, b) => a + b, 0);
              const quotesApprovalRate = quotesSent7Days > 0 ? Math.round((quotesApproved7Days / quotesSent7Days) * 100) : 0;
              
              const jobsStarted7Days = jobsSparkline.started.reduce((a, b) => a + b, 0);
              const jobsCompleted7Days = jobsSparkline.completed.reduce((a, b) => a + b, 0);
              const jobsCompletionRate = jobsStarted7Days > 0 ? Math.round((jobsCompleted7Days / jobsStarted7Days) * 100) : 0;
              
              const invoicesSent7Days = invoicesSparkline.sent.reduce((a, b) => a + b, 0);
              const invoicesPaid7Days = invoicesSparkline.paid.reduce((a, b) => a + b, 0);
              const invoicesPaymentRate = invoicesSent7Days > 0 ? Math.round((invoicesPaid7Days / invoicesSent7Days) * 100) : 0;
              
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                  {/* Requests Column - Heavy Frosted Glass with Blue Hue on Hover */}
                  <div 
                    className="relative"
                    onMouseEnter={() => setHoveredCard("requests")}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <ThoughtBubble visible={hoveredCard === "requests"}>
                      <p className="text-gray-600">{requestsTotal7Days} requests received</p>
                      <p className="text-gray-600">{requestsConverted7Days} converted to jobs</p>
                      <p className="text-blue-600 font-medium">{requestsConversionRate}% conversion rate</p>
                    </ThoughtBubble>
                  <button
                    className="group relative w-full rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.10] hover:-translate-y-3 hover:shadow-[0_25px_60px_rgba(139,92,246,0.35),0_15px_35px_rgba(59,130,246,0.25),0_8px_20px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2"
                    onClick={() => setView("newJobs" as ViewState)}
                    style={{
                      background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
                      backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                      WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                      border: '2px solid rgba(255, 255, 255, 0.85)',
                      boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)'
                    }}
                  >
                    {/* Hover overlay - very light gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    {/* Subtle glow effect on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }} />
                    
                    {/* Animated running light top bar - AllAI pyramid colors */}
                    <div 
                      className="running-light-bar h-1 transition-all duration-300" 
                      style={{ 
                        backdropFilter: 'blur(16px) saturate(200%)',
                        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)'
                      }} 
                    />
                    
                    <div className="relative p-4">
                      {/* Header with icon */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Requests</span>
                        <Briefcase className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      
                      {/* Primary metric */}
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">New</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{requestsCount}</span>
                      </div>
                      
                      {/* Sub-metrics */}
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">Converted</span>
                          <span className="text-xs font-semibold text-emerald-600">{assessmentCompleted}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">Overdue</span>
                          <span className={`text-xs font-semibold ${overdueRequests > 0 ? 'text-red-500' : 'text-gray-700'}`}>{overdueRequests}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">Value</span>
                          <span className="text-sm font-bold text-blue-600">${requestsValue.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Last 7 days sparkline */}
                      <div className="pt-2 border-t border-gray-100/50 mt-2">
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide">Last 7 days</span>
                        <Sparkline 
                          data={requestsSparkline.received}
                          color="#3b82f6"
                          secondaryData={requestsSparkline.converted}
                          secondaryColor="#6b7280"
                          labels={{ primary: "Received", secondary: "Converted" }}
                        />
                      </div>
                    </div>
                  </button>
                  </div>

                  {/* Quotes Column - Heavy Frosted Glass with Amber Hue on Hover */}
                  <div 
                    className="relative"
                    onMouseEnter={() => setHoveredCard("quotes")}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <ThoughtBubble visible={hoveredCard === "quotes"}>
                      <p className="text-gray-600">{quotesSent7Days} quotes sent</p>
                      <p className="text-gray-600">{quotesApproved7Days} approved</p>
                      <p className="text-amber-600 font-medium">{quotesApprovalRate}% approval rate</p>
                    </ThoughtBubble>
                  <button
                    className="group relative w-full rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.10] hover:-translate-y-3 hover:shadow-[0_25px_60px_rgba(139,92,246,0.35),0_15px_35px_rgba(59,130,246,0.25),0_8px_20px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2"
                    onClick={() => navigate("/quotes")}
                    style={{
                      background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
                      backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                      WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                      border: '2px solid rgba(255, 255, 255, 0.85)',
                      boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)'
                    }}
                  >
                    {/* Hover overlay - very light gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    {/* Subtle glow effect on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }} />
                    
                    {/* Animated running light top bar - AllAI pyramid colors */}
                    <div 
                      className="running-light-bar h-1 transition-all duration-300" 
                      style={{ 
                        backdropFilter: 'blur(16px) saturate(200%)',
                        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)'
                      }} 
                    />
                    
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Quotes</span>
                        <Receipt className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">Draft</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{draftQuotes.length}</span>
                      </div>
                      
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">Approved</span>
                          <span className="text-xs font-semibold text-emerald-600">{approvedQuotes.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">Changes</span>
                          <span className={`text-xs font-semibold ${changesRequested > 0 ? 'text-orange-500' : 'text-gray-700'}`}>{changesRequested}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">Awaiting</span>
                          <span className="text-sm font-bold text-amber-600">${sentQuotesValue.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Last 7 days sparkline */}
                      <div className="pt-2 border-t border-gray-100/50 mt-2">
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide">Last 7 days</span>
                        <Sparkline 
                          data={quotesSparkline.sent}
                          color="#f59e0b"
                          secondaryData={quotesSparkline.approved}
                          secondaryColor="#6b7280"
                          labels={{ primary: "Sent", secondary: "Approved" }}
                        />
                      </div>
                    </div>
                  </button>
                  </div>

                  {/* Jobs Column - Heavy Frosted Glass with Teal/Green Hue on Hover */}
                  <div 
                    className="relative"
                    onMouseEnter={() => setHoveredCard("jobs")}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <ThoughtBubble visible={hoveredCard === "jobs"}>
                      <p className="text-gray-600">{jobsStarted7Days} jobs started</p>
                      <p className="text-gray-600">{jobsCompleted7Days} completed</p>
                      <p className="text-green-600 font-medium">{jobsCompletionRate}% completion rate</p>
                    </ThoughtBubble>
                  <button
                    className="group relative w-full rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.10] hover:-translate-y-3 hover:shadow-[0_25px_60px_rgba(139,92,246,0.35),0_15px_35px_rgba(59,130,246,0.25),0_8px_20px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2"
                    onClick={() => setView("activeJobs" as ViewState)}
                    style={{
                      background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
                      backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                      WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                      border: '2px solid rgba(255, 255, 255, 0.85)',
                      boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)'
                    }}
                  >
                    {/* Hover overlay - very light gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    {/* Subtle glow effect on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }} />
                    
                    {/* Animated running light top bar - AllAI pyramid colors */}
                    <div 
                      className="running-light-bar h-1 transition-all duration-300" 
                      style={{ 
                        backdropFilter: 'blur(16px) saturate(200%)',
                        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)'
                      }} 
                    />
                    
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Jobs</span>
                        <CheckCircle className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">Active</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{activeJobs.length}</span>
                      </div>
                      
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">Completed</span>
                          <span className="text-xs font-semibold text-emerald-600">{requiresInvoicing}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">Scheduled</span>
                          <span className="text-xs font-semibold text-gray-700">{scheduledJobsCount}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">Value</span>
                          <span className="text-sm font-bold text-slate-700">${activeJobsValue.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Last 7 days sparkline */}
                      <div className="pt-2 border-t border-gray-100/50 mt-2">
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide">Last 7 days</span>
                        <Sparkline 
                          data={jobsSparkline.started}
                          color="#10b981"
                          secondaryData={jobsSparkline.completed}
                          secondaryColor="#6b7280"
                          labels={{ primary: "Started", secondary: "Completed" }}
                        />
                      </div>
                    </div>
                  </button>
                  </div>

                  {/* Invoices Column - Heavy Frosted Glass with Violet Hue on Hover */}
                  <div 
                    className="relative"
                    onMouseEnter={() => setHoveredCard("invoices")}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <ThoughtBubble visible={hoveredCard === "invoices"}>
                      <p className="text-gray-600">{invoicesSent7Days} invoices sent</p>
                      <p className="text-gray-600">{invoicesPaid7Days} paid</p>
                      <p className="text-violet-600 font-medium">{invoicesPaymentRate}% payment rate</p>
                    </ThoughtBubble>
                  <button
                    className="group relative w-full rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.10] hover:-translate-y-3 hover:shadow-[0_25px_60px_rgba(139,92,246,0.35),0_15px_35px_rgba(59,130,246,0.25),0_8px_20px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2"
                    onClick={() => navigate("/quotes")}
                    style={{
                      background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
                      backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                      WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                      border: '2px solid rgba(255, 255, 255, 0.85)',
                      boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)'
                    }}
                  >
                    {/* Hover overlay - very light gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
                    {/* Subtle glow effect on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }} />
                    
                    {/* Animated running light top bar - AllAI pyramid colors */}
                    <div 
                      className="running-light-bar h-1 transition-all duration-300" 
                      style={{ 
                        backdropFilter: 'blur(16px) saturate(200%)',
                        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)'
                      }} 
                    />
                    
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Invoices</span>
                        <DollarSign className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors duration-300" />
                      </div>
                      
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-gray-500 font-medium">Owed</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{approvedQuotes.length}</span>
                      </div>
                      
                      <div className="space-y-1.5 pt-2 border-t border-gray-100/50">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">Paid</span>
                          <span className="text-xs font-semibold text-emerald-600">0</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-500">Past Due</span>
                          <span className={`text-xs font-semibold ${pastDueInvoices > 0 ? 'text-red-500' : 'text-gray-700'}`}>{pastDueInvoices}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[11px] text-gray-500">Total</span>
                          <span className="text-sm font-bold text-violet-600">${totalOwed.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Last 30 days sparkline */}
                      <div className="pt-2 border-t border-gray-100/50 mt-2">
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide">Last 30 days</span>
                        <Sparkline 
                          data={invoicesSparkline.sent}
                          color="#8b5cf6"
                          secondaryData={invoicesSparkline.paid}
                          secondaryColor="#6b7280"
                          labels={{ primary: "Sent", secondary: "Paid" }}
                        />
                      </div>
                    </div>
                  </button>
                  </div>
                </div>
              );
            })()}

            {/* Today's Schedule - Team Timeline with current time indicator */}
            <div className="mb-8">
              <TeamTimeline 
                teamMembers={(teamData?.allMembers || []).map(m => ({
                  id: m.id,
                  memberId: m.memberId,
                  name: m.name,
                  color: m.color
                }))}
                appointments={teamAppointments.map((apt: any) => ({
                  id: apt.id,
                  title: apt.title,
                  scheduledStartAt: apt.scheduledStartAt,
                  scheduledEndAt: apt.scheduledEndAt,
                  status: apt.status,
                  contractorId: apt.contractorId,
                  teamId: apt.teamId,
                  address: apt.address,
                  customerName: apt.customerName,
                  urgency: apt.urgency,
                  source: apt.source
                }))}
                onViewCalendar={() => navigate("/contractor-schedule")}
              />
            </div>
          </div>
        )}

        {/* New Jobs View - Maya Carousel Layout */}
        {view === ("newJobs" as ViewState) && (
          <MayaCarouselLayout
            title="New Job Requests"
            subtitle="Jobs waiting for your response"
            items={jobs.filter(j => ["New", "In Review", "Pending", "Submitted"].includes(j.status)).map(job => ({
              id: job.id,
              title: job.title,
              customerName: job.customerName,
              customerInitials: job.customerInitials,
              description: job.description,
              status: job.status,
              priority: job.priority,
              estimatedValue: job.estimatedValue,
              scheduledDate: job.scheduledDate,
              address: job.address,
              category: job.category,
              createdAt: job.createdAt,
              color: job.color,
              reporterUserId: (job as any).reporterUserId,
              orgId: (job as any).orgId,
              aiTriageJson: (job as any).aiTriageJson,
              media: (job as any).media,
            }))}
            filterTabs={[
              { id: "all", label: "All", count: jobs.filter(j => ["New", "In Review", "Pending", "Submitted"].includes(j.status)).length },
              { id: "new", label: "New", count: jobs.filter(j => j.status === "New").length },
              { id: "in review", label: "In Review", count: jobs.filter(j => j.status === "In Review").length },
              { id: "pending", label: "Pending", count: jobs.filter(j => j.status === "Pending").length },
            ]}
            activeFilter="new"
            showSearch={true}
            showCategoryFilter={true}
            showPriorityFilter={true}
            showSort={true}
            categories={["Plumbing", "HVAC", "Electrical", "General Maintenance", "Appliance Repair", "Roofing", "Painting"]}
            itemType="request"
            onItemSelect={(item) => { handleSelectCase(item.id); }}
            onAccept={(item) => { 
              toast({ title: "Job Accepted", description: `${item.title} has been accepted.` });
            }}
            onSendQuote={(item) => {
              navigate("/quotes");
            }}
            onSchedule={(item) => {
              setView("calendar");
            }}
            emptyIcon={<Briefcase className="h-12 w-12 mx-auto opacity-50" />}
            emptyMessage="No new job requests"
          />
        )}

        {/* Active Jobs View - Maya Carousel Layout */}
        {view === ("activeJobs" as ViewState) && (
          <MayaCarouselLayout
            title="Jobs"
            subtitle="Track and manage your active work"
            items={jobs.filter(j => ["In Progress", "Scheduled", "Confirmed", "Completed"].includes(j.status)).map(job => ({
              id: job.id,
              title: job.title,
              customerName: job.customerName,
              customerInitials: job.customerInitials,
              description: job.description,
              status: job.status,
              priority: job.priority,
              estimatedValue: job.estimatedValue,
              scheduledDate: job.scheduledDate,
              address: job.address,
              category: job.category,
              createdAt: job.createdAt,
              color: job.color,
              reporterUserId: (job as any).reporterUserId,
              orgId: (job as any).orgId,
              aiTriageJson: (job as any).aiTriageJson,
              media: (job as any).media,
            }))}
            filterTabs={[
              { id: "all", label: "All Jobs", count: allJobsCount },
              { id: "in progress", label: "In Progress", count: jobs.filter(j => j.status === "In Progress").length },
              { id: "scheduled", label: "Scheduled", count: jobs.filter(j => j.status === "Scheduled" || j.status === "Confirmed").length },
              { id: "completed", label: "Completed", count: completedJobsCount },
            ]}
            activeFilter="all"
            showSearch={true}
            showCategoryFilter={true}
            showSort={true}
            categories={["Plumbing", "HVAC", "Electrical", "General Maintenance", "Appliance Repair", "Roofing", "Painting"]}
            itemType="job"
            onItemSelect={(item) => { handleSelectCase(item.id); }}
            onSchedule={(item) => {
              setView("calendar");
            }}
            emptyIcon={<CheckCircle className="h-12 w-12 mx-auto opacity-50" />}
            emptyMessage="No active jobs"
          />
        )}

        {/* Calendar/Schedule View */}
        {view === "calendar" && (
          <div className="flex-1 flex flex-col items-center pt-8">
            <div className="w-full max-w-xl">
              <h2 className="text-2xl font-semibold mb-2">Your Schedule</h2>
              <p className="text-muted-foreground mb-6">Upcoming appointments</p>
              
              <div className="space-y-4">
                {jobs.filter(j => j.status === "Scheduled").map((job) => (
                  <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => { handleSelectCase(job.id); setView("landing"); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-full ${job.color.bg} flex items-center justify-center text-white font-medium`}>
                          {job.customerInitials}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{job.title}</div>
                          <div className="text-sm text-muted-foreground">{job.customerName}</div>
                        </div>
                        <Badge className="bg-purple-100 text-purple-700">Scheduled</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{job.scheduledDate || "Date TBD"}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {jobs.filter(j => j.status === "Scheduled").length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No scheduled appointments</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quotes View - Maya Carousel Layout */}
        {view === "quotes" && (
          <MayaCarouselLayout
            title="Quotes"
            subtitle="Manage and send quotes to customers"
            items={quotes.map(quote => {
              const customer = quote.customer || customers.find(c => c.id === quote.customerId);
              const customerName = customer?.name || customer?.company || "Unknown Customer";
              const initials = customerName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
              const colors = [
                { bg: "bg-blue-500", text: "text-blue-600" },
                { bg: "bg-emerald-500", text: "text-emerald-600" },
                { bg: "bg-violet-500", text: "text-violet-600" },
                { bg: "bg-orange-500", text: "text-orange-600" },
              ];
              const colorIdx = customerName.charCodeAt(0) % colors.length;
              return {
                id: quote.id,
                title: quote.title || `Quote #${quote.id.slice(0, 8)}`,
                customerName,
                customerInitials: initials,
                description: `Total: $${parseFloat(quote.total).toLocaleString()}`,
                status: quote.status.charAt(0).toUpperCase() + quote.status.slice(1),
                estimatedValue: parseFloat(quote.total),
                subtotal: parseFloat(quote.subtotal),
                taxAmount: parseFloat(quote.taxAmount || "0"),
                total: parseFloat(quote.total),
                expiresAt: quote.expiresAt,
                createdAt: new Date(quote.createdAt).toLocaleDateString(),
                color: colors[colorIdx],
                caseId: quote.caseId,
                customerId: quote.customerId,
                clientMessage: quote.clientMessage,
                internalNotes: quote.internalNotes,
                discountAmount: parseFloat(quote.discountAmount || "0"),
                taxPercent: parseFloat(quote.taxPercent || "0"),
                depositType: quote.depositType,
                depositValue: parseFloat(quote.depositValue || "0"),
              };
            })}
            filterTabs={[
              { id: "all", label: "All", count: quotes.length },
              { id: "draft", label: "Draft", count: quotes.filter(q => q.status === "draft").length },
              { id: "sent", label: "Sent", count: quotes.filter(q => q.status === "sent" || q.status === "awaiting_response").length },
              { id: "approved", label: "Approved", count: quotes.filter(q => q.status === "approved").length },
              { id: "declined", label: "Declined", count: quotes.filter(q => q.status === "declined").length },
              { id: "expired", label: "Expired", count: quotes.filter(q => q.status === "expired").length },
            ]}
            activeFilter="draft"
            showSearch={true}
            showSort={true}
            itemType="quote"
            onItemSelect={() => {}}
            emptyIcon={<Receipt className="h-12 w-12 mx-auto opacity-50" />}
            emptyMessage="No quotes found"
          />
        )}

        {/* Messages View */}
        {view === ("messages" as ViewState) && (
          <div className="flex-1 flex flex-col pt-4 px-4 max-w-3xl mx-auto w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold">Messages</h2>
                <p className="text-sm text-muted-foreground">{totalUnreadMessages} unread</p>
              </div>
            </div>

            <div className="flex-1 flex gap-4 min-h-0">
              <div className="w-full sm:w-80 flex flex-col border rounded-lg bg-white overflow-hidden shrink-0">
                <div className="overflow-y-auto flex-1">
                  {conversationsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : (conversationsQuery.data || []).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No conversations yet</p>
                    </div>
                  ) : (
                    (conversationsQuery.data || []).map((conv: any) => {
                      const isActive = selectedCaseId === conv.caseId;
                      return (
                        <button
                          key={conv.id}
                          onClick={() => {
                            if (conv.caseId) handleSelectCase(conv.caseId);
                          }}
                          className={`w-full text-left px-4 py-3 border-b hover:bg-slate-50 transition-colors ${isActive ? "bg-violet-50 border-l-2 border-l-violet-500" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-b from-white to-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0 shadow-sm">
                              {(conv.homeownerName || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm truncate ${conv.unreadCount > 0 ? "font-semibold" : "font-medium"}`}>
                                  {conv.homeownerName}
                                </span>
                                {conv.unreadCount > 0 && (
                                  <span className="shrink-0 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-violet-500 text-white text-[10px] font-bold rounded-full">
                                    {conv.unreadCount}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{conv.lastMessagePreview || conv.subject || "No messages"}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">{conv.stage || "request"}</Badge>
                                {conv.lastMessageAt && (
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(conv.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="hidden sm:flex flex-1 flex-col min-h-0">
                {selectedCaseId ? (
                  (() => {
                    const conv = (conversationsQuery.data || []).find((c: any) => c.caseId === selectedCaseId);
                    if (!conv) return (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>Select a conversation</p>
                      </div>
                    );
                    return (
                      <ThreadChat
                        caseId={conv.caseId}
                        homeownerUserId={conv.homeownerUserId}
                        orgId={conv.orgId}
                        subject={conv.subject}
                      />
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground border rounded-lg bg-white">
                    <div className="text-center">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a conversation to read messages</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Team View - Maya Sidebar + Members/Calendar */}
        {view === ("team" as ViewState) && (
          <TeamView
            user={user}
            teamData={teamData}
            teamAppointments={teamAppointments}
            activeJobs={activeJobs}
          />
        )}

        {/* Job Detail View - When customer bubble is selected */}
        {view === "landing" && selectedCaseId && selectedCase && (
          <div className="flex-1 flex flex-col">
            {/* Job Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">{selectedCase.title}</h2>
              <p className="text-muted-foreground">{selectedCase.description}</p>
            </div>

            {/* Customer Bubbles Row */}
            <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-2">
              {/* Maya Bubble */}
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="flex flex-col items-center gap-1 flex-shrink-0"
              >
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
                    border: '2px solid rgba(139, 92, 246, 0.3)',
                  }}
                >
                  <Sparkles className="h-5 w-5 text-violet-500" />
                </div>
                <span className="text-xs text-muted-foreground">Maya</span>
              </button>

              {/* Job Bubbles */}
              {jobs.map((job) => {
                const unread = getUnreadCount(job);
                const isSelected = selectedCaseId === job.id;
                
                return (
                  <button
                    key={job.id}
                    onClick={() => handleSelectCase(job.id)}
                    className="flex flex-col items-center gap-1 flex-shrink-0"
                  >
                    <div 
                      className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isSelected ? `${job.bgColor} ring-2 ${job.ringColor}` : ""
                      }`}
                      style={isSelected 
                        ? { boxShadow: `0 0 20px ${job.glowColor}` } 
                        : { 
                            background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.9) 0%, rgba(220,230,250,0.5) 100%)',
                            border: '2px solid rgba(255,255,255,0.8)',
                          }
                      }
                    >
                      {unread > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                          {unread}
                        </div>
                      )}
                      <span className={`text-sm font-medium ${isSelected ? job.textColor : "text-gray-500"}`}>
                        {job.customerInitials}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{job.customerName.split(" ")[0]}</span>
                    <span className="text-[10px] text-muted-foreground">${job.estimatedValue}</span>
                  </button>
                );
              })}
            </div>

            {/* Job Info Card */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${selectedCase.color.bg} flex items-center justify-center text-white font-medium`}>
                      {selectedCase.customerInitials}
                    </div>
                    <div>
                      <div className="font-medium">{selectedCase.customerName}</div>
                      <div className="text-sm text-muted-foreground">{selectedCase.category}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getPriorityColor(selectedCase.priority || "Normal")}>
                      {selectedCase.priority || "Normal"}
                    </Badge>
                    <Badge className={getStatusColor(selectedCase.status)}>
                      {selectedCase.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    className="flex-1 rounded-full border-violet-200 text-violet-700 hover:bg-violet-50"
                    onClick={() => acceptCaseMutation.mutate(selectedCase.id)}
                    disabled={acceptCaseMutation.isPending || selectedCase.status === "In Progress"}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {selectedCase.status === "In Progress" ? "Accepted" : "Accept"}
                  </Button>
                  <Button variant="outline" className="rounded-full">
                    Quote
                  </Button>
                  <Button variant="outline" className="rounded-full">
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Job Details */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Job Details</h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  {selectedCase.property && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{selectedCase.property.address}</span>
                    </div>
                  )}
                  {selectedCase.createdAt && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Created: {new Date(selectedCase.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedCase.description && (
                    <p className="mt-3 text-foreground">{selectedCase.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Triage Assessment */}
            {(selectedCase as any).aiTriageJson && (
              <Card className="mb-4 border-violet-100">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Maya AI Assessment</span>
                    </div>
                    <PhotoAnalysisButton
                      media={(selectedCase as any).media || []}
                      photoAnalysis={(selectedCase as any).aiTriageJson?.photoAnalysis}
                    />
                  </div>
                  <div className="rounded-lg border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Urgency</span>
                      <Badge className={
                        (selectedCase as any).aiTriageJson.urgency === "critical" ? "bg-red-100 text-red-700 border-red-200" :
                        (selectedCase as any).aiTriageJson.urgency === "high" ? "bg-orange-100 text-orange-700 border-orange-200" :
                        (selectedCase as any).aiTriageJson.urgency === "moderate" ? "bg-amber-100 text-amber-700 border-amber-200" :
                        "bg-green-100 text-green-700 border-green-200"
                      }>
                        {(selectedCase as any).aiTriageJson.urgency || "Unknown"}
                      </Badge>
                    </div>
                    {(selectedCase as any).aiTriageJson.rootCause && (
                      <div>
                        <span className="text-xs text-slate-500 block mb-0.5">Likely Cause</span>
                        <p className="text-sm text-slate-700">{(selectedCase as any).aiTriageJson.rootCause}</p>
                      </div>
                    )}
                    <div className="flex gap-4">
                      {(selectedCase as any).aiTriageJson.estimatedCost && (
                        <div>
                          <span className="text-xs text-slate-500 block">Est. Cost</span>
                          <p className="text-sm font-medium text-slate-700">{(selectedCase as any).aiTriageJson.estimatedCost}</p>
                        </div>
                      )}
                      {(selectedCase as any).aiTriageJson.estimatedTime && (
                        <div>
                          <span className="text-xs text-slate-500 block">Est. Time</span>
                          <p className="text-sm font-medium text-slate-700">{(selectedCase as any).aiTriageJson.estimatedTime}</p>
                        </div>
                      )}
                    </div>
                    {(selectedCase as any).aiTriageJson.suggestedActions?.length > 0 && (
                      <div>
                        <span className="text-xs text-slate-500 block mb-1">Suggested Steps</span>
                        <ul className="space-y-1">
                          {(selectedCase as any).aiTriageJson.suggestedActions.map((action: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                              <CheckCircle className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(selectedCase as any).aiTriageJson.safetyNotes && (
                      <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 border border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700">{(selectedCase as any).aiTriageJson.safetyNotes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Messages Thread */}
            <ThreadChat
              caseId={selectedCase.id}
              homeownerUserId={(selectedCase as any).reporterUserId}
              orgId={(selectedCase as any).orgId}
              subject={selectedCase.title}
            />
          </div>
        )}

        </main>
        ) : (
        /* Customers View - uses grid row-start-2 to fill remaining space */
        <div className="row-start-2 flex flex-col overflow-hidden min-h-0">
          <CustomersContent embedded={true} />
        </div>
        )}
      </div>
    </div>
  );
}
