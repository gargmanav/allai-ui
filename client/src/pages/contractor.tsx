import { useState, useRef, useEffect } from "react";
import { AnimatedPyramid } from "@/components/AnimatedPyramid";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
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
  FileText,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Wrench,
  Users,
  Receipt
} from "lucide-react";

type ViewState = "landing" | "jobDetail" | "pastJobs" | "calendar" | "quotes" | "customers" | "newJobs" | "messages";

interface ChatMessage {
  id: string;
  sender: "contractor" | "customer" | "maya";
  message: string;
  timestamp: Date;
  isRead?: boolean;
}

interface Job {
  id: string;
  customerId: string;
  customerName: string;
  customerInitials: string;
  customerColor: string;
  glowColor: string;
  ringColor: string;
  bgColor: string;
  textColor: string;
  title: string;
  description: string;
  priority: "Low" | "Normal" | "High" | "Urgent";
  status: "New" | "Scheduled" | "In Progress" | "Completed";
  category: string;
  estimatedValue: number;
  scheduledDate?: string;
  messages: ChatMessage[];
}

const mockJobs: Job[] = [
  {
    id: "job-1",
    customerId: "customer-1",
    customerName: "Sarah Johnson",
    customerInitials: "SJ",
    customerColor: "bg-rose-500",
    glowColor: "rgba(244, 63, 94, 0.5)",
    ringColor: "ring-rose-400",
    bgColor: "bg-rose-100 dark:bg-rose-900/30",
    textColor: "text-rose-600 dark:text-rose-400",
    title: "Roof Leak Repair",
    description: "Small water stain appearing on ceiling in NE corner bedroom. Only shows up after heavy rain.",
    priority: "High",
    status: "New",
    category: "Roofing",
    estimatedValue: 850,
    messages: [
      { id: "m1", sender: "customer", message: "Hi! I noticed the water stain is getting bigger. Can you come take a look soon?", timestamp: new Date("2025-11-12T10:30:00"), isRead: false },
      { id: "m2", sender: "contractor", message: "I can come by Monday morning. Does 9 AM work?", timestamp: new Date("2025-11-12T11:15:00"), isRead: true },
      { id: "m3", sender: "customer", message: "Perfect! See you then.", timestamp: new Date("2025-11-12T11:45:00"), isRead: false },
    ]
  },
  {
    id: "job-2",
    customerId: "customer-2",
    customerName: "Michael Chen",
    customerInitials: "MC",
    customerColor: "bg-emerald-500",
    glowColor: "rgba(16, 185, 129, 0.5)",
    ringColor: "ring-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
    title: "HVAC Maintenance",
    description: "Annual filter replacement and system check for office building.",
    priority: "Normal",
    status: "Scheduled",
    category: "HVAC",
    estimatedValue: 450,
    scheduledDate: "2025-11-15",
    messages: [
      { id: "m4", sender: "customer", message: "Can we reschedule to the afternoon?", timestamp: new Date("2025-11-13T09:00:00"), isRead: false },
    ]
  },
  {
    id: "job-3",
    customerId: "customer-3",
    customerName: "Emily Rodriguez",
    customerInitials: "ER",
    customerColor: "bg-violet-500",
    glowColor: "rgba(139, 92, 246, 0.5)",
    ringColor: "ring-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    textColor: "text-violet-600 dark:text-violet-400",
    title: "Electrical Outlet Repair",
    description: "Two outlets in kitchen not working. May be tripped breaker or wiring issue.",
    priority: "Urgent",
    status: "New",
    category: "Electrical",
    estimatedValue: 200,
    messages: [
      { id: "m5", sender: "customer", message: "This is urgent - I can't use my kitchen appliances!", timestamp: new Date("2025-11-14T08:00:00"), isRead: false },
    ]
  },
];

const quickCategories = [
  { id: "new-jobs", label: "New Jobs", icon: Briefcase, count: 2 },
  { id: "schedule", label: "Schedule", icon: Calendar, count: 5 },
  { id: "quotes", label: "Quotes", icon: Receipt, count: 3 },
  { id: "messages", label: "Messages", icon: MessageSquare, count: 4 },
];

export default function Contractor() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [view, setView] = useState<ViewState>("landing");
  const [searchQuery, setSearchQuery] = useState("");
  const [mayaInput, setMayaInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
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

  const selectedCustomerJob = selectedCustomerId 
    ? jobs.find(j => j.customerId === selectedCustomerId) 
    : null;

  const getUnreadCount = (job: Job) => {
    return job.messages.filter(m => m.sender === "customer" && !m.isRead).length;
  };

  const totalUnreadMessages = jobs.reduce((acc, job) => acc + getUnreadCount(job), 0);
  const newJobsCount = jobs.filter(j => j.status === "New").length;
  const scheduledJobsCount = jobs.filter(j => j.status === "Scheduled").length;

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setJobs(prev => prev.map(j => 
      j.customerId === customerId 
        ? { ...j, messages: j.messages.map(m => ({ ...m, isRead: true })) }
        : j
    ));
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !selectedCustomerId) return;
    
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "contractor",
      message: chatMessage,
      timestamp: new Date(),
      isRead: true,
    };
    
    setJobs(prev => prev.map(j => 
      j.customerId === selectedCustomerId 
        ? { ...j, messages: [...j.messages, newMessage] }
        : j
    ));
    setChatMessage("");
  };

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
    
    setTimeout(async () => {
      let mayaResponse = "I'm here to help you manage your work. You can ask me about your schedule, create quotes, or get insights about your jobs.";
      
      if (userMessage.toLowerCase().includes("schedule") || userMessage.toLowerCase().includes("today")) {
        mayaResponse = `You have ${scheduledJobsCount} jobs scheduled. Your next appointment is the HVAC Maintenance for Michael Chen tomorrow at 2 PM.`;
      } else if (userMessage.toLowerCase().includes("new") || userMessage.toLowerCase().includes("jobs")) {
        mayaResponse = `You have ${newJobsCount} new job requests waiting for your response. The most urgent is the Electrical Outlet Repair for Emily Rodriguez.`;
      } else if (userMessage.toLowerCase().includes("quote") || userMessage.toLowerCase().includes("price")) {
        mayaResponse = "I can help you create a quote. Which customer would you like to send it to?";
      }
      
      const mayaChatResponse: ChatMessage = {
        id: `maya-${Date.now()}`,
        sender: "maya",
        message: mayaResponse,
        timestamp: new Date(),
      };
      setMayaChatMessages(prev => [...prev, mayaChatResponse]);
      setIsMayaTyping(false);
    }, 1000);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mayaChatMessages, selectedCustomerJob?.messages]);

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
                onClick={() => { setView("landing"); setSelectedJob(null); setSelectedCustomerId(null); }}
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
                    setSelectedJob(job);
                    handleSelectCustomer(job.customerId);
                    setView("landing");
                  }}
                >
                  <div className={`w-8 h-8 rounded-full ${job.customerColor} flex items-center justify-center text-white text-xs font-medium`}>
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
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3"
              onClick={() => toast({ title: "Profile", description: "Profile settings coming soon" })}
            >
              <User className="h-4 w-4" />
              Profile
            </Button>
            <Separator className="my-2" />
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
            {(sidebarOpen && view !== "landing") || (!sidebarOpen && view !== "landing" && !selectedCustomerId) ? (
              <Button variant="ghost" size="sm" onClick={() => { setView("landing"); setSelectedJob(null); setSelectedCustomerId(null); }} className="absolute left-4 gap-2">
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
        {view === "landing" && !selectedCustomerId && (
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
                      setSelectedCustomerId(null);
                      setSelectedJob(null);
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
                    const isSelected = selectedCustomerId === job.customerId;
                    
                    return (
                      <button
                        key={job.id}
                        onClick={() => handleSelectCustomer(job.customerId)}
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

            {/* Quick Categories */}
            <div className="grid grid-cols-4 gap-4 max-w-md mt-6">
              {quickCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (cat.id === "new-jobs") {
                      setView("newJobs" as ViewState);
                    } else if (cat.id === "schedule") {
                      setView("calendar" as ViewState);
                    } else if (cat.id === "quotes") {
                      setView("quotes" as ViewState);
                    } else if (cat.id === "messages") {
                      setView("messages" as ViewState);
                    }
                  }}
                  className="relative flex flex-col items-center gap-2 p-2 transition-all"
                >
                  <div 
                    className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all"
                    style={{ 
                      background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.95) 0%, rgba(240,245,255,0.8) 25%, rgba(220,230,250,0.6) 50%, rgba(200,215,245,0.45) 75%, rgba(180,200,235,0.35) 100%)',
                      backdropFilter: 'blur(48px) saturate(220%) brightness(1.05)',
                      border: '2.5px solid rgba(255,255,255,0.9)',
                      boxShadow: 'inset 0 8px 20px rgba(255,255,255,1), inset 0 -6px 12px rgba(100,130,200,0.1), 0 16px 48px rgba(0,0,0,0.15)'
                    }}
                  >
                    {cat.count > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg">
                        {cat.count}
                      </div>
                    )}
                    <cat.icon className="h-7 w-7 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.label}</span>
                </button>
              ))}
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
                {jobs.filter(j => j.status === "New").map((job) => (
                  <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => { handleSelectCustomer(job.customerId); setView("landing"); }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${job.customerColor} flex items-center justify-center text-white font-medium`}>
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
                {jobs.filter(j => j.status === "New").length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No new job requests</p>
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
                  <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => { handleSelectCustomer(job.customerId); setView("landing"); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-full ${job.customerColor} flex items-center justify-center text-white font-medium`}>
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
                {jobs.filter(j => j.messages.length > 0).map((job) => {
                  const unread = getUnreadCount(job);
                  const lastMessage = job.messages[job.messages.length - 1];
                  return (
                    <Card key={job.id} className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${unread > 0 ? "border-blue-200 bg-blue-50/30" : ""}`} onClick={() => { handleSelectCustomer(job.customerId); setView("landing"); }}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${job.customerColor} flex items-center justify-center text-white font-medium relative`}>
                            {job.customerInitials}
                            {unread > 0 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                                {unread}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{job.customerName}</div>
                            <p className="text-sm text-muted-foreground truncate">{lastMessage.message}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {lastMessage.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Job Detail View - When customer bubble is selected */}
        {view === "landing" && selectedCustomerId && selectedCustomerJob && (
          <div className="flex-1 flex flex-col">
            {/* Job Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">{selectedCustomerJob.title}</h2>
              <p className="text-muted-foreground">{selectedCustomerJob.description}</p>
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
                const isSelected = selectedCustomerId === job.customerId;
                
                return (
                  <button
                    key={job.id}
                    onClick={() => handleSelectCustomer(job.customerId)}
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
                    <div className={`w-10 h-10 rounded-full ${selectedCustomerJob.customerColor} flex items-center justify-center text-white font-medium`}>
                      {selectedCustomerJob.customerInitials}
                    </div>
                    <div>
                      <div className="font-medium">{selectedCustomerJob.customerName}</div>
                      <div className="text-sm text-muted-foreground">{selectedCustomerJob.category}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getPriorityColor(selectedCustomerJob.priority)}>
                      {selectedCustomerJob.priority}
                    </Badge>
                    <Badge className={getStatusColor(selectedCustomerJob.status)}>
                      {selectedCustomerJob.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-600">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Job
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

            {/* Chat Messages */}
            <Card className="flex-1 flex flex-col min-h-[300px]">
              <CardContent className="flex-1 flex flex-col p-4">
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4">
                    {selectedCustomerJob.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === "contractor" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            msg.sender === "contractor"
                              ? "bg-blue-500 text-white"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${msg.sender === "contractor" ? "text-blue-100" : "text-muted-foreground"}`}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                
                <div className="mt-4 flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="rounded-full"
                  />
                  <Button 
                    size="icon" 
                    className="rounded-full"
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
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
