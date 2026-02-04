import { useState, useRef, useEffect, useMemo } from "react";
import { format, isToday, parseISO, startOfDay, endOfDay } from "date-fns";
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
  Bell
} from "lucide-react";

type ViewState = "landing" | "jobDetail" | "pastJobs" | "calendar" | "quotes" | "customers" | "newJobs" | "activeJobs" | "messages";

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
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
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

  const firstName = user?.firstName || user?.username?.split("@")[0] || "Contractor";

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
      return {
        ...c,
        customerName,
        customerInitials: getInitials(customerName),
        color,
        estimatedValue: c.estimatedCost || 0,
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

  // Today's appointments - for the schedule view
  const todaysAppointments = useMemo(() => {
    const today = new Date();
    return appointments
      .filter(apt => {
        if (!apt.scheduledAt) return false;
        const aptDate = typeof apt.scheduledAt === 'string' ? parseISO(apt.scheduledAt) : apt.scheduledAt;
        return isToday(aptDate);
      })
      .sort((a, b) => {
        const dateA = typeof a.scheduledAt === 'string' ? parseISO(a.scheduledAt) : a.scheduledAt;
        const dateB = typeof b.scheduledAt === 'string' ? parseISO(b.scheduledAt) : b.scheduledAt;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
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
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <Button 
                className="flex-1 justify-start gap-3 bg-primary/10 hover:bg-primary/20 text-primary"
                variant="ghost"
                onClick={() => { setView("landing"); setSelectedCaseId(null); }}
              >
                <Briefcase className="h-4 w-4" />
                Job Board
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="ml-2"
                onClick={() => setSidebarOpen(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search jobs..." 
                className="pl-9 h-9 text-sm rounded-lg bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Active Jobs
            </div>
            <div className="space-y-1">
              {jobs
                .filter(job => {
                  if (!searchQuery.trim()) return true;
                  const query = searchQuery.toLowerCase();
                  return job.title.toLowerCase().includes(query) || 
                         job.customerName.toLowerCase().includes(query);
                })
                .map((job) => (
                <div 
                  key={job.id}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => {
                    handleSelectCase(job.id);
                    setView("landing");
                  }}
                >
                  <div className={`w-8 h-8 rounded-full ${job.color.bg} flex items-center justify-center text-white text-xs font-medium`}>
                    {job.customerInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{job.title}</span>
                    <span className="text-xs text-muted-foreground truncate block">{job.customerName}</span>
                  </div>
                  {getUnreadCount(job) > 0 && (
                    <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                      {getUnreadCount(job)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto border-t p-4 space-y-1">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3"
              onClick={() => setView("landing")}
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
            <Separator className="my-2" />
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3"
              onClick={() => navigate("/quotes")}
            >
              <Receipt className="h-4 w-4" />
              Quotes
              {quotesCount > 0 && (
                <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">{quotesCount}</Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3"
              onClick={() => navigate("/customers")}
            >
              <Users className="h-4 w-4" />
              Customers
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3"
              onClick={() => navigate("/inbox")}
            >
              <Mail className="h-4 w-4" />
              Inbox
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3"
              onClick={() => navigate("/reminders")}
            >
              <Bell className="h-4 w-4" />
              Reminders
            </Button>
            <Separator className="my-2" />
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3"
              onClick={() => toast({ title: "Profile", description: "Profile settings coming soon" })}
            >
              <User className="h-4 w-4" />
              Profile
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={() => logout?.()}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? "ml-72" : "ml-0"}`}>
        {/* Header */}
        <header className="fixed top-0 right-0 z-50 bg-background/80 backdrop-blur-sm transition-all duration-300" style={{ left: sidebarOpen ? "288px" : "0" }}>
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

        {/* Main Content */}
        <main className="pt-32 pb-8 px-6 max-w-4xl mx-auto min-h-screen flex flex-col">
        
        {/* Landing View - AI-First with Job Bubbles */}
        {view === "landing" && !selectedCaseId && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-16">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-semibold mb-2">
                Hi, {firstName}
              </h1>
              <p className="text-muted-foreground">
                {newJobsCount} new jobs waiting • {totalUnreadMessages} unread messages
              </p>
            </div>

            {/* Maya AI Input */}
            <form onSubmit={handleMayaSubmit} className="w-full max-w-xl mb-8">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 rounded-full opacity-30 blur-lg group-hover:opacity-50 group-focus-within:opacity-60 transition-opacity duration-300" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask Maya about your schedule, jobs, quotes..."
                  value={mayaInput}
                  onChange={(e) => setMayaInput(e.target.value)}
                  className="relative h-14 pl-5 pr-24 text-lg rounded-full border-2 border-muted-foreground/20 focus:border-primary/50 shadow-lg bg-background"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground">
                    <Mic className="h-5 w-5" />
                  </Button>
                  <Button type="submit" size="icon" className="h-10 w-10 rounded-full" disabled={!mayaInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>

            {/* Job Bubbles - Like Contractor Bubbles for Homeowners */}
            {jobs.length > 0 && (
              <div className="w-full max-w-xl mb-8">
                <div className="text-sm text-muted-foreground mb-4 text-center">Your Jobs</div>
                <div className="flex items-center justify-center gap-6 flex-wrap">
                  {/* Maya AI Bubble */}
                  <button
                    onClick={() => {
                      setView("maya");
                      setSelectedCaseId(null);
                    }}
                    className="flex flex-col items-center gap-2 transition-all group"
                  >
                    <div 
                      className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all group-hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                        backdropFilter: 'blur(48px) saturate(220%) brightness(1.05)',
                        border: '2.5px solid rgba(139, 92, 246, 0.4)',
                        boxShadow: 'inset 0 8px 20px rgba(255,255,255,0.8), 0 8px 24px rgba(139, 92, 246, 0.25)'
                      }}
                    >
                      <Sparkles className="h-7 w-7 text-violet-500 animate-pulse" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Maya</span>
                    <span className="text-xs text-muted-foreground">AI Assistant</span>
                  </button>

                  {/* Job Bubbles */}
                  {jobs.slice(0, 4).map((job) => {
                    const unread = getUnreadCount(job);
                    const isSelected = selectedCaseId === job.id;
                    
                    return (
                      <button
                        key={job.id}
                        onClick={() => handleSelectCase(job.id)}
                        className="flex flex-col items-center gap-2 transition-all"
                      >
                        <div 
                          className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                            isSelected ? `${job.bgColor} ring-2 ${job.ringColor} ring-offset-2 ring-offset-background` : ""
                          }`}
                          style={isSelected 
                            ? { 
                                boxShadow: `0 0 28px ${job.glowColor}, inset 0 3px 6px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.2)`,
                                border: '1.5px solid rgba(255,255,255,0.7)'
                              } 
                            : { 
                                background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.95) 0%, rgba(240,245,255,0.8) 25%, rgba(220,230,250,0.6) 50%, rgba(200,215,245,0.45) 75%, rgba(180,200,235,0.35) 100%)',
                                backdropFilter: 'blur(48px) saturate(220%) brightness(1.05)',
                                border: '2.5px solid rgba(255,255,255,0.9)',
                                boxShadow: 'inset 0 8px 20px rgba(255,255,255,1), inset 0 -6px 12px rgba(100,130,200,0.1), 0 16px 48px rgba(0,0,0,0.15)'
                              }
                          }
                        >
                          {unread > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg">
                              {unread}
                            </div>
                          )}
                          <span className={`text-lg font-semibold ${isSelected ? job.textColor : "text-gray-600 dark:text-gray-400"}`}>
                            {job.customerInitials}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[80px] truncate">
                          {job.customerName.split(" ")[0]}
                        </span>
                        <span className="text-xs text-muted-foreground">${job.estimatedValue}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status Badges - Compact row for New Jobs and Active */}
            <div className="flex items-center gap-3 mt-6 mb-6">
              <button
                onClick={() => setView("newJobs" as ViewState)}
                className="flex items-center gap-2 px-4 py-2 rounded-full transition-all hover:scale-105"
                style={{
                  background: newJobsCount > 0 
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)'
                    : 'rgba(0,0,0,0.05)',
                  border: newJobsCount > 0 ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(0,0,0,0.1)'
                }}
              >
                <Briefcase className={`h-4 w-4 ${newJobsCount > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${newJobsCount > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                  {newJobsCount} New
                </span>
              </button>
              
              <button
                onClick={() => setView("activeJobs" as ViewState)}
                className="flex items-center gap-2 px-4 py-2 rounded-full transition-all hover:scale-105"
                style={{
                  background: activeJobsCount > 0 
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%)'
                    : 'rgba(0,0,0,0.05)',
                  border: activeJobsCount > 0 ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(0,0,0,0.1)'
                }}
              >
                <CheckCircle className={`h-4 w-4 ${activeJobsCount > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${activeJobsCount > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                  {activeJobsCount} Active
                </span>
              </button>
            </div>

            {/* Today's Schedule - Main Focus */}
            <div className="w-full max-w-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Today's Schedule
                </h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-600 hover:text-blue-700"
                  onClick={() => navigate("/contractor-schedule")}
                >
                  View All
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
              
              {todaysAppointments.length === 0 ? (
                <div 
                  className="rounded-2xl p-8 text-center"
                  style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)',
                    border: '1px solid rgba(0,0,0,0.05)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                  }}
                >
                  <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-3">No appointments scheduled for today</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full"
                    onClick={() => navigate("/contractor-schedule")}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Schedule Job
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaysAppointments.map((apt, index) => {
                    const aptTime = typeof apt.scheduledAt === 'string' ? parseISO(apt.scheduledAt) : apt.scheduledAt;
                    const timeStr = format(aptTime, 'h:mm a');
                    const colors = [
                      { bg: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-200' },
                      { bg: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200' },
                      { bg: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-200' },
                      { bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-200' },
                    ];
                    const color = colors[index % colors.length];
                    
                    return (
                      <div 
                        key={apt.id}
                        className={`flex items-center gap-4 p-4 rounded-xl ${color.light} ${color.border} border cursor-pointer hover:shadow-md transition-all`}
                        onClick={() => navigate("/contractor-schedule")}
                      >
                        <div className="text-center min-w-[60px]">
                          <div className="text-lg font-bold text-gray-800">{timeStr}</div>
                        </div>
                        <div className={`w-1 h-12 ${color.bg} rounded-full`} />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{apt.title || 'Appointment'}</div>
                          <div className="text-sm text-gray-500">
                            {apt.address || apt.notes || 'No location specified'}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {apt.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
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
      </div>
    </div>
  );
}
