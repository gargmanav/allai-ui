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
  UserPlus
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
import { CustomersContent } from "@/pages/customers";

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
  status: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  expiresAt?: string;
  createdAt: string;
  depositType?: string;
  depositAmount?: string;
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
  
  const [view, setView] = useState<ViewState>("landing");
  const [searchQuery, setSearchQuery] = useState("");
  const [mayaInput, setMayaInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mayaSuggestionIndex, setMayaSuggestionIndex] = useState(0);
  const [showMayaBubble, setShowMayaBubble] = useState(false);
  const [mayaHovered, setMayaHovered] = useState(false);
  
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
      // Parse estimatedCost as number to prevent string concatenation
      const parsedCost = typeof c.estimatedCost === 'string' 
        ? parseFloat(c.estimatedCost) || 0 
        : (c.estimatedCost || 0);
      return {
        ...c,
        customerName,
        customerInitials: getInitials(customerName),
        color,
        estimatedValue: parsedCost,
      };
    });
  }, [cases, marketplaceCases]);

  const selectedCase = selectedCaseId ? jobs.find(j => j.id === selectedCaseId) : null;

  // Calculate counts
  const newJobsCount = jobs.filter(j => ["New", "In Review", "Pending", "Submitted", "Open"].includes(j.status)).length;
  const activeJobsCount = jobs.filter(j => ["In Progress", "Scheduled", "Confirmed"].includes(j.status)).length;
  const scheduledJobsCount = appointments.filter(a => a.status === "Confirmed" || a.status === "Scheduled" || a.status === "Pending").length;
  const quotesCount = quotes.length;
  const draftQuotesCount = quotes.filter(q => q.status === "draft").length;
  // Actionable quotes: drafts + sent (awaiting response) + changes requested
  const actionableQuotesCount = quotes.filter(q => ["draft", "sent", "changes_requested"].includes(q.status)).length;

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

  // Placeholder for unread messages - would come from real messaging system
  const totalUnreadMessages = 0;

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
      {/* Left Sidebar - Frosted Glass */}
      <aside 
        className={`fixed left-0 top-0 h-full bg-muted/30 border-r flex flex-col z-40 transition-all duration-300 ${
          sidebarOpen ? "w-72" : "w-0"
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
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
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
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
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
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
              onClick={() => navigate("/quotes")}
            >
              <Receipt className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Quotes</span>
              {actionableQuotesCount > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-amber-100 text-amber-700 hover:bg-amber-100">{actionableQuotesCount}</Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
              onClick={() => setView("activeJobs" as ViewState)}
            >
              <CheckCircle className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Jobs</span>
              {activeJobsCount > 0 && (
                <Badge className="ml-auto h-5 px-1.5 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{activeJobsCount}</Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
              onClick={() => toast({ title: "Invoices", description: "Invoice management coming soon" })}
            >
              <DollarSign className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Invoices</span>
            </Button>
            
            {/* Separator - Purple-Blue Gradient */}
            <div className="my-3 mx-3 h-[1px] bg-gradient-to-r from-violet-400/40 via-blue-400/40 to-transparent" />
            
            {/* MANAGE Section */}
            <div className="px-3 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Manage</span>
            </div>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
              onClick={() => navigate("/contractor-schedule")}
            >
              <Calendar className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Schedule</span>
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
              onClick={() => setView("customers")}
            >
              <Users className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Customers</span>
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
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
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
              onClick={() => navigate("/inbox")}
            >
              <Mail className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Inbox</span>
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
              onClick={() => navigate("/reminders")}
            >
              <Bell className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
              <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">Reminders</span>
            </Button>
            <Button 
              variant="ghost" 
              className="group w-full justify-start gap-3 h-10 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-violet-500/25 hover:to-blue-500/25 hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] active:from-violet-500/35 active:to-blue-500/35"
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
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? "ml-72" : "ml-0"} ${view === "customers" ? "h-screen grid grid-rows-[auto_1fr] overflow-hidden" : ""}`}>
        {/* Header */}
        <header className={`${view === "customers" ? "row-start-1" : "fixed top-0 right-0"} z-50 bg-background/80 backdrop-blur-sm transition-all duration-300`} style={view !== "customers" ? { left: sidebarOpen ? "288px" : "0" } : undefined}>
          <div className="relative flex items-center justify-center px-6 py-4">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="absolute left-4">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            {(sidebarOpen && view !== "landing") || (!sidebarOpen && view !== "landing" && !selectedCaseId) ? (
              <Button variant="ghost" size="sm" onClick={() => { setView("landing"); setSelectedCaseId(null); }} className="absolute left-4 gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
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
        <main className="pt-32 pb-8 px-6 max-w-4xl mx-auto min-h-screen flex flex-col">
        
        {/* Landing View - Action-Focused Dashboard */}
        {view === "landing" && !selectedCaseId && (
          <div className="flex-1 flex flex-col pt-4">
            {/* Top Row - Greeting + Maya Button */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(), 'EEEE, MMMM d')}
                </p>
              </div>
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

            {/* Jobber-Style 4-Column Dashboard Grid - Frosted Glass */}
            {(() => {
              const requestsCount = newJobsCount;
              const requestsValue = jobs
                .filter(j => ["New", "In Review", "Pending", "Submitted", "Open"].includes(j.status))
                .reduce((sum, j) => sum + (Number(j.estimatedValue) || 0), 0);
              
              const draftQuotes = quotes.filter(q => q.status === 'draft');
              const sentQuotes = quotes.filter(q => q.status === 'sent');
              const sentQuotesValue = sentQuotes.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);
              
              const activeJobs = jobs.filter(j => ["In Progress", "Scheduled", "Confirmed"].includes(j.status));
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
              
              // Mock sparkline data for "Last 7 days" trend visualization
              // In production, this would come from historical data API
              const requestsSparkline = { received: [3, 5, 2, 8, 4, 6, requestsCount], converted: [1, 2, 1, 4, 3, 3, assessmentCompleted] };
              const quotesSparkline = { sent: [2, 1, 3, 4, 2, 5, sentQuotes.length], converted: [1, 1, 2, 2, 1, 3, approvedQuotes.length] };
              const jobsSparkline = { started: [2, 3, 1, 4, 5, 2, activeJobs.length], completed: [1, 2, 1, 3, 4, 2, requiresInvoicing] };
              const invoicesSparkline = { sent: [3, 2, 4, 1, 5, 3, awaitingPayment], paid: [2, 1, 3, 1, 4, 2, 0] };
              
              return (
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {/* Requests Column - Enhanced Frosted Glass */}
                  <button
                    className="group relative rounded-2xl overflow-hidden text-left transition-all duration-300 hover:shadow-[0_8px_32px_rgba(139,92,246,0.15)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2"
                    onClick={() => setView("newJobs" as ViewState)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(24px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                    }}
                  >
                    {/* Hover overlay with purple-blue gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 via-violet-500/0 to-blue-500/0 group-hover:from-violet-500/10 group-hover:via-violet-400/8 group-hover:to-blue-500/15 transition-all duration-500" />
                    {/* Glow effect on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: 'inset 0 0 40px rgba(139, 92, 246, 0.08)' }} />
                    
                    {/* Top accent bar */}
                    <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600 group-hover:from-violet-500 group-hover:to-blue-500 transition-all duration-300" />
                    
                    <div className="relative p-4">
                      {/* Header with icon */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Requests</span>
                        <Briefcase className="h-4 w-4 text-blue-500 group-hover:text-violet-500 transition-colors duration-300" />
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
                          secondaryColor="#10b981"
                          labels={{ primary: "Received", secondary: "Converted" }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Quotes Column - Enhanced Frosted Glass */}
                  <button
                    className="group relative rounded-2xl overflow-hidden text-left transition-all duration-300 hover:shadow-[0_8px_32px_rgba(139,92,246,0.15)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2"
                    onClick={() => navigate("/quotes")}
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(24px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 via-violet-500/0 to-blue-500/0 group-hover:from-violet-500/10 group-hover:via-violet-400/8 group-hover:to-blue-500/15 transition-all duration-500" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: 'inset 0 0 40px rgba(139, 92, 246, 0.08)' }} />
                    
                    <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-600 group-hover:from-violet-500 group-hover:to-blue-500 transition-all duration-300" />
                    
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Quotes</span>
                        <Receipt className="h-4 w-4 text-amber-500 group-hover:text-violet-500 transition-colors duration-300" />
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
                          secondaryData={quotesSparkline.converted}
                          secondaryColor="#10b981"
                          labels={{ primary: "Sent", secondary: "Converted" }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Jobs Column - Enhanced Frosted Glass */}
                  <button
                    className="group relative rounded-2xl overflow-hidden text-left transition-all duration-300 hover:shadow-[0_8px_32px_rgba(139,92,246,0.15)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2"
                    onClick={() => setView("activeJobs" as ViewState)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(24px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 via-violet-500/0 to-blue-500/0 group-hover:from-violet-500/10 group-hover:via-violet-400/8 group-hover:to-blue-500/15 transition-all duration-500" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: 'inset 0 0 40px rgba(139, 92, 246, 0.08)' }} />
                    
                    <div className="h-1 bg-gradient-to-r from-green-400 to-green-600 group-hover:from-violet-500 group-hover:to-blue-500 transition-all duration-300" />
                    
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Jobs</span>
                        <CheckCircle className="h-4 w-4 text-green-500 group-hover:text-violet-500 transition-colors duration-300" />
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
                          <span className="text-sm font-bold text-green-600">${activeJobsValue.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Last 7 days sparkline */}
                      <div className="pt-2 border-t border-gray-100/50 mt-2">
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide">Last 7 days</span>
                        <Sparkline 
                          data={jobsSparkline.started}
                          color="#3b82f6"
                          secondaryData={jobsSparkline.completed}
                          secondaryColor="#22c55e"
                          labels={{ primary: "Started", secondary: "Completed" }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Invoices Column - Enhanced Frosted Glass */}
                  <button
                    className="group relative rounded-2xl overflow-hidden text-left transition-all duration-300 hover:shadow-[0_8px_32px_rgba(139,92,246,0.15)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2"
                    onClick={() => navigate("/quotes")}
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(24px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 via-violet-500/0 to-blue-500/0 group-hover:from-violet-500/10 group-hover:via-violet-400/8 group-hover:to-blue-500/15 transition-all duration-500" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: 'inset 0 0 40px rgba(139, 92, 246, 0.08)' }} />
                    
                    <div className="h-1 bg-gradient-to-r from-violet-400 to-violet-600 group-hover:from-violet-500 group-hover:to-blue-500 transition-all duration-300" />
                    
                    <div className="relative p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Invoices</span>
                        <DollarSign className="h-4 w-4 text-violet-500 group-hover:text-violet-600 transition-colors duration-300" />
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
                          secondaryColor="#10b981"
                          labels={{ primary: "Sent", secondary: "Paid" }}
                        />
                      </div>
                    </div>
                  </button>
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
                appointments={teamAppointments.map(apt => ({
                  id: apt.id,
                  title: apt.title,
                  scheduledStartAt: apt.scheduledStartAt,
                  scheduledEndAt: apt.scheduledEndAt,
                  status: apt.status,
                  contractorId: apt.contractorId,
                  address: apt.address,
                  customerName: apt.customerName
                }))}
                onViewCalendar={() => navigate("/contractor-schedule")}
              />
            </div>
          </div>
        )}

        {/* New Jobs View */}
        {view === ("newJobs" as ViewState) && (
          <div className="flex-1 flex flex-col items-center pt-8">
            <div className="w-full max-w-xl">
              <h2 className="text-2xl font-semibold mb-2">New Job Requests</h2>
              <p className="text-muted-foreground mb-6">Jobs waiting for your response</p>
              
              <div className="space-y-4">
                {jobs.filter(j => ["New", "In Review", "Pending", "Submitted"].includes(j.status)).map((job) => (
                  <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => { handleSelectCase(job.id); setView("landing"); }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${job.color.bg} flex items-center justify-center text-white font-medium`}>
                            {job.customerInitials}
                          </div>
                          <div>
                            <div className="font-medium">{job.title}</div>
                            <div className="text-sm text-muted-foreground">{job.customerName}</div>
                          </div>
                        </div>
                        <Badge className={getPriorityColor(job.priority)}>{job.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{job.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-green-600">${job.estimatedValue}</span>
                        <Button size="sm" className="rounded-full">View Details</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {jobs.filter(j => ["New", "In Review", "Pending", "Submitted"].includes(j.status)).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No new job requests</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Active Jobs View */}
        {view === ("activeJobs" as ViewState) && (
          <div className="flex-1 flex flex-col items-center pt-8">
            <div className="w-full max-w-xl">
              <h2 className="text-2xl font-semibold mb-2">Active Jobs</h2>
              <p className="text-muted-foreground mb-6">Jobs currently in progress</p>
              
              <div className="space-y-4">
                {jobs.filter(j => ["In Progress", "Scheduled", "Confirmed"].includes(j.status)).map((job) => (
                  <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => { handleSelectCase(job.id); setView("landing"); }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${job.color.bg} flex items-center justify-center text-white font-medium`}>
                            {job.customerInitials}
                          </div>
                          <div>
                            <div className="font-medium">{job.title}</div>
                            <div className="text-sm text-muted-foreground">{job.customerName}</div>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-700">{job.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{job.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-green-600">${job.estimatedValue}</span>
                        <Button size="sm" className="rounded-full">View Details</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {jobs.filter(j => ["In Progress", "Scheduled", "Confirmed"].includes(j.status)).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active jobs</p>
                  </div>
                )}
              </div>
            </div>
          </div>
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

        {/* Quotes View */}
        {view === "quotes" && (
          <div className="flex-1 flex flex-col items-center pt-8">
            <div className="w-full max-w-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold mb-1">Quotes</h2>
                  <p className="text-muted-foreground">Manage your quotes</p>
                </div>
                <Button className="rounded-full gap-2">
                  <Receipt className="h-4 w-4" />
                  New Quote
                </Button>
              </div>
              
              <div className="space-y-4">
                {jobs.map((job) => (
                  <Card key={job.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{job.title}</div>
                        <Badge variant="outline">Draft</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-3">{job.customerName}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">${job.estimatedValue}</span>
                        <Button size="sm" variant="outline" className="rounded-full">Send Quote</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages View */}
        {view === ("messages" as ViewState) && (
          <div className="flex-1 flex flex-col items-center pt-8">
            <div className="w-full max-w-xl">
              <h2 className="text-2xl font-semibold mb-2">Messages</h2>
              <p className="text-muted-foreground mb-6">{totalUnreadMessages} unread messages</p>
              
              <div className="space-y-2">
                {jobs.length > 0 ? jobs.map((job) => (
                    <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => { handleSelectCase(job.id); setView("landing"); }}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${job.color.bg} flex items-center justify-center text-white font-medium`}>
                            {job.customerInitials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{job.customerName}</div>
                            <p className="text-sm text-muted-foreground truncate">{job.title}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )) : (
                    <div className="text-center text-muted-foreground py-8">
                      No messages yet
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* Team View - Members + Calendar */}
        {view === ("team" as ViewState) && (
          <div className="flex-1 flex flex-col pt-4 px-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold">Team</h2>
                <p className="text-muted-foreground">Manage your team members and view schedules</p>
              </div>
            </div>
            
            <Tabs defaultValue="members" className="flex-1 flex flex-col">
              <TabsList className="w-fit mb-4">
                <TabsTrigger value="members" className="gap-2">
                  <Users className="h-4 w-4" />
                  Members
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Calendar
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="members" className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    {(teamData?.allMembers?.length || 0) + 1} team member{(teamData?.allMembers?.length || 0) !== 0 ? 's' : ''}
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600">
                        <UserPlus className="h-4 w-4" />
                        Add Team Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Team Member</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="memberName">Name</Label>
                          <Input id="memberName" placeholder="Enter name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="memberEmail">Email</Label>
                          <Input id="memberEmail" type="email" placeholder="email@example.com" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="memberPhone">Phone</Label>
                          <Input id="memberPhone" placeholder="(555) 123-4567" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="memberRole">Role</Label>
                          <Input id="memberRole" placeholder="e.g. Technician, Apprentice" />
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={() => toast({ title: "Coming Soon", description: "Team member management is being implemented" })}>
                          Add Member
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="grid gap-4">
                  {/* You (owner) card */}
                  <Card className="border-2 border-violet-200 dark:border-violet-800/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                          style={{ backgroundColor: '#8B5CF6' }}
                        >
                          {getInitials([user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'You')}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'You'}
                            </h3>
                            <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                              Owner
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{user?.email || ''}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Team members */}
                  {(teamData?.allMembers || []).map((member) => (
                    <Card key={member.id} className="group hover:border-violet-200 dark:hover:border-violet-800/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                            style={{ backgroundColor: member.color }}
                          >
                            {getInitials(member.name)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{member.name}</h3>
                              {member.role && (
                                <Badge variant="secondary">{member.role}</Badge>
                              )}
                              {member.hasLogin && (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                                  Has Login
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {member.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {member.email}
                                </span>
                              )}
                              {member.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {member.phone}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => toast({ title: "Edit Member", description: "Editing coming soon" })}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => toast({ title: "Remove Member", description: "Removal coming soon" })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {(teamData?.allMembers?.length || 0) === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No team members yet</p>
                      <p className="text-sm">Add team members to assign jobs and track schedules</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="calendar" className="flex-1">
                <TeamCalendar
                  teamMembers={[
                    { 
                      id: user?.id || '', 
                      name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'You', 
                      role: 'Lead', 
                      color: '#8B5CF6' 
                    },
                    ...(teamData?.allMembers || []).map(m => ({
                      id: m.memberId,
                      name: m.name,
                      role: m.role || undefined,
                      color: m.color,
                    }))
                  ]}
                  appointments={teamAppointments}
                  onAppointmentClick={(apt) => {
                    toast({ title: apt.title || 'Appointment', description: apt.customerName || apt.address || '' });
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
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
                    className="flex-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                    onClick={() => acceptCaseMutation.mutate(selectedCase.id)}
                    disabled={acceptCaseMutation.isPending || selectedCase.status === "In Progress"}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {selectedCase.status === "In Progress" ? "Accepted" : "Accept Job"}
                  </Button>
                  <Button variant="outline" className="rounded-full">
                    Send Quote
                  </Button>
                  <Button variant="outline" className="rounded-full">
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Job Details */}
            <Card className="flex-1 flex flex-col min-h-[200px]">
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
