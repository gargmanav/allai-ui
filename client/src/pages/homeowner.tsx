import { useState, useRef, useMemo } from "react";
import { AnimatedPyramid } from "@/components/AnimatedPyramid";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ThreadChat } from "@/components/contractor/thread-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Menu, 
  Send, 
  Mic, 
  Droplets, 
  Zap, 
  Snowflake, 
  Wrench,
  Camera,
  ArrowLeft,
  Star,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Home,
  FileText,
  LogOut,
  ChevronRight,
  Sparkles,
  Search,
  User
} from "lucide-react";

type ViewState = "landing" | "triage" | "contractors" | "chat" | "pastRequests" | "requestDetail";

interface TriageResult {
  urgency: string;
  rootCause: string;
  estimatedCost: string;
  estimatedTime: string;
  suggestedActions: string[];
  category: string;
}

interface Contractor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  availability: string;
  priceRange: string;
}

interface ChatMessage {
  id: string;
  sender: "homeowner" | "contractor" | "maya";
  message: string;
  timestamp: Date;
  isRead?: boolean;
}

interface ContractorQuote {
  id: string;
  contractorId: string;
  contractorName: string;
  contractorInitials: string;
  contractorColor: string;
  glowColor: string;
  ringColor: string;
  bgColor: string;
  textColor: string;
  quote: number;
  availability: string;
  estimatedDays: number;
  messages: ChatMessage[];
  status: "pending" | "accepted" | "declined";
}

const mockContractorQuotes: ContractorQuote[] = [
  {
    id: "quote-1",
    contractorId: "contractor-1",
    contractorName: "Mike's Roofing",
    contractorInitials: "MR",
    contractorColor: "bg-blue-500",
    glowColor: "rgba(59, 130, 246, 0.5)",
    ringColor: "ring-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-600 dark:text-blue-400",
    quote: 850,
    availability: "Available Mon-Wed",
    estimatedDays: 2,
    status: "pending",
    messages: [
      { id: "m1", sender: "contractor", message: "Hi Sarah! I've reviewed your roof leak issue. Based on your description, it sounds like the flashing around the chimney may need repair. I can come out Monday to take a closer look.", timestamp: new Date("2025-11-12T10:30:00"), isRead: false },
      { id: "m2", sender: "homeowner", message: "That sounds great! What time works for you?", timestamp: new Date("2025-11-12T11:15:00"), isRead: true },
      { id: "m3", sender: "contractor", message: "I can be there around 9 AM. The inspection is free, and I'll give you a detailed quote on the spot. If it's just the flashing, we're looking at around $850.", timestamp: new Date("2025-11-12T11:45:00"), isRead: false },
    ],
  },
  {
    id: "quote-2",
    contractorId: "contractor-2",
    contractorName: "Premier Roofing Co",
    contractorInitials: "PR",
    contractorColor: "bg-emerald-500",
    glowColor: "rgba(16, 185, 129, 0.5)",
    ringColor: "ring-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
    quote: 1200,
    availability: "Available Thursday",
    estimatedDays: 1,
    status: "pending",
    messages: [
      { id: "m4", sender: "contractor", message: "Hello! Thanks for reaching out. We specialize in roof repairs and have 15 years of experience. For water stains appearing after rain, it could be a few things - damaged shingles, worn flashing, or gutter issues.", timestamp: new Date("2025-11-12T09:00:00"), isRead: false },
      { id: "m5", sender: "homeowner", message: "What would repair typically cost?", timestamp: new Date("2025-11-12T09:30:00"), isRead: true },
      { id: "m6", sender: "contractor", message: "For a typical flashing repair, we charge $1,200 which includes a 5-year warranty on our work. We use premium materials and can usually complete the work in one day.", timestamp: new Date("2025-11-12T10:00:00"), isRead: false },
    ],
  },
  {
    id: "quote-3",
    contractorId: "contractor-3",
    contractorName: "Budget Roof Repair",
    contractorInitials: "BR",
    contractorColor: "bg-orange-500",
    glowColor: "rgba(249, 115, 22, 0.5)",
    ringColor: "ring-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    textColor: "text-orange-600 dark:text-orange-400",
    quote: 550,
    availability: "Available tomorrow",
    estimatedDays: 3,
    status: "pending",
    messages: [
      { id: "m7", sender: "contractor", message: "Hey! Saw your request. I can come by tomorrow to check out that leak. I'm the most affordable option in the area.", timestamp: new Date("2025-11-12T14:00:00"), isRead: false },
      { id: "m8", sender: "homeowner", message: "What's your estimate looking like?", timestamp: new Date("2025-11-12T14:30:00"), isRead: true },
      { id: "m9", sender: "contractor", message: "I can do it for $550. Might take a couple extra days since I work solo, but I'll get it done right.", timestamp: new Date("2025-11-12T15:00:00"), isRead: false },
    ],
  },
];

export default function Homeowner() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [view, setView] = useState<ViewState>("landing");
  const [problemDescription, setProblemDescription] = useState("");
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [contractorQuotes, setContractorQuotes] = useState<ContractorQuote[]>(mockContractorQuotes);
  const [showMayaPanel, setShowMayaPanel] = useState(false);
  const [mayaChatMessages, setMayaChatMessages] = useState<ChatMessage[]>([]);
  const [mayaChatInput, setMayaChatInput] = useState("");
  const [isMayaTyping, setIsMayaTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mayaChatEndRef = useRef<HTMLDivElement>(null);

  const firstName = "Sarah"; // Temporarily hardcoded for demo view

  const categories = [
    { id: "plumbing", label: "Plumbing", icon: Droplets, color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30", badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", ringColor: "ring-blue-400", glowColor: "rgba(59, 130, 246, 0.4)" },
    { id: "electrical", label: "Electrical", icon: Zap, color: "text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-900/30", badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", ringColor: "ring-amber-400", glowColor: "rgba(245, 158, 11, 0.4)" },
    { id: "hvac", label: "HVAC", icon: Snowflake, color: "text-cyan-500", bgColor: "bg-cyan-100 dark:bg-cyan-900/30", badgeBg: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300", ringColor: "ring-cyan-400", glowColor: "rgba(6, 182, 212, 0.4)" },
  ];

  const otherCategories = [
    { id: "appliances", label: "Appliances", badgeBg: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" },
    { id: "roofing", label: "Roofing", badgeBg: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
    { id: "flooring", label: "Flooring", badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
    { id: "windows_doors", label: "Windows & Doors", badgeBg: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" },
    { id: "painting", label: "Painting", badgeBg: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300" },
    { id: "landscaping", label: "Landscaping", badgeBg: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
    { id: "pest_control", label: "Pest Control", badgeBg: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
    { id: "garage", label: "Garage Door", badgeBg: "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300" },
    { id: "security", label: "Security Systems", badgeBg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" },
    { id: "cleaning", label: "Cleaning", badgeBg: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300" },
    { id: "other", label: "Other", badgeBg: "bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300" },
  ];

  const getCategoryInfo = (id: string) => {
    return categories.find(c => c.id === id) || otherCategories.find(c => c.id === id);
  };

  const { data: pastRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/property-owner/cases"],
    enabled: !!user,
  });

  const { data: homeownerConversations = [] } = useQuery<any[]>({
    queryKey: ["/api/messaging/conversations"],
    staleTime: 30000,
    refetchInterval: 30000,
    enabled: !!user,
  });

  const unreadByCaseId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const conv of homeownerConversations) {
      if (conv.caseId && conv.unreadCount > 0) {
        map[conv.caseId] = (map[conv.caseId] || 0) + conv.unreadCount;
      }
    }
    return map;
  }, [homeownerConversations]);

  const triageMutation = useMutation({
    mutationFn: async (data: { description: string; category?: string }) => {
      const response = await apiRequest("POST", "/api/ai/triage", {
        description: data.description,
        category: data.category,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTriageResult(data);
      setView("triage");
      setIsAnalyzing(false);
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "We couldn't analyze your issue. Please try again.",
        variant: "destructive",
      });
      setIsAnalyzing(false);
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!problemDescription.trim()) return;
    
    setIsAnalyzing(true);
    triageMutation.mutate({ 
      description: problemDescription, 
      category: selectedCategories.length > 0 ? selectedCategories.join(", ") : undefined 
    });
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
    inputRef.current?.focus();
  };

  const removeCategory = (categoryId: string) => {
    setSelectedCategories(prev => prev.filter(id => id !== categoryId));
  };

  const handleBack = () => {
    if (view === "contractors") {
      setView("triage");
    } else if (view === "triage" || view === "chat" || view === "pastRequests") {
      setView("landing");
      setTriageResult(null);
      setProblemDescription("");
      setSelectedCategories([]);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case "critical":
      case "emergency":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "high":
      case "urgent":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "medium":
      case "moderate":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case "critical":
      case "emergency":
        return "Urgent - Act Now";
      case "high":
      case "urgent":
        return "High Priority";
      case "medium":
      case "moderate":
        return "Moderate";
      default:
        return "Low Priority";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex">
      {/* Left Sidebar - OpenAI Style (pushes content) */}
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
                onClick={() => setView("landing")}
              >
                <Plus className="h-4 w-4" />
                New Request
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
                placeholder="Search requests..." 
                className="pl-9 h-9 text-sm rounded-lg bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {searchQuery ? "Search Results" : "Recent Requests"}
            </div>
            <div className="space-y-1">
              {pastRequests
                .filter((request: any) => {
                  if (!searchQuery.trim()) return true;
                  const query = searchQuery.toLowerCase();
                  const title = (request.title || "").toLowerCase();
                  const description = (request.description || "").toLowerCase();
                  return title.includes(query) || description.includes(query);
                })
                .slice(0, searchQuery ? 20 : 5)
                .map((request: any) => (
                <div 
                  key={request.id}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedRequest(request);
                    setSelectedContractorId(mockContractorQuotes[0]?.contractorId || null);
                    setView("requestDetail");
                  }}
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate flex-1">
                    {request.title || request.description?.slice(0, 30) || "Untitled Request"}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Pencil className="h-3 w-3 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {pastRequests.length === 0 && !searchQuery && (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  No requests yet
                </p>
              )}
              {searchQuery && pastRequests.filter((r: any) => {
                const q = searchQuery.toLowerCase();
                return (r.title || "").toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q);
              }).length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  No matching requests
                </p>
              )}
              {!searchQuery && pastRequests.length > 5 && (
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3 text-sm text-muted-foreground"
                  onClick={() => setView("pastRequests")}
                >
                  View all {pastRequests.length} requests
                </Button>
              )}
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
              onClick={() => {
                toast({
                  title: "Profile",
                  description: "Profile settings coming soon - manage email, notifications, and property details",
                });
              }}
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
        {/* Minimal Header */}
        <header className="fixed top-0 right-0 z-50 bg-background/80 backdrop-blur-sm transition-all duration-300" style={{ left: sidebarOpen ? "288px" : "0" }}>
          <div className="relative flex items-center justify-center px-6 py-4">
            {/* Menu button - fixed to far left */}
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="absolute left-4">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            {sidebarOpen && view !== "landing" && (
              <Button variant="ghost" size="sm" onClick={handleBack} className="absolute left-4 gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            
            {/* Centered logo */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <AnimatedPyramid size={56} />
                <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">AllAI</span>
              </div>
              <span className="text-xs text-muted-foreground italic mt-1">Home maintenance, simplified.</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="pt-32 pb-8 px-6 max-w-4xl mx-auto min-h-screen flex flex-col">
        
        {/* Landing View - The Hero Input */}
        {view === "landing" && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-16">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-semibold mb-2">
                Hi, {firstName}
              </h1>
              <p className="text-muted-foreground">
                I help diagnose issues and connect the right help.
              </p>
            </div>

            {/* The Hero Input */}
            <form onSubmit={handleSubmit} className="w-full max-w-xl mb-8">
              <label htmlFor="problem-input" className="sr-only">
                How can I help?
              </label>
              <div className="relative group">
                {/* AI Gradient Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 rounded-full opacity-30 blur-lg group-hover:opacity-50 group-focus-within:opacity-60 transition-opacity duration-300" />
                <Input
                  id="problem-input"
                  ref={inputRef}
                  type="text"
                  placeholder="How can I help today?"
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  className="relative h-14 pl-5 pr-24 text-lg rounded-full border-2 border-muted-foreground/20 focus:border-primary/50 shadow-lg bg-background"
                  disabled={isAnalyzing}
                  aria-label="How can I help?"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                  <Button 
                    type="submit" 
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    disabled={!problemDescription.trim() || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap min-h-[32px]">
                {selectedCategories.map(catId => {
                  const catInfo = getCategoryInfo(catId);
                  return (
                    <Badge 
                      key={catId} 
                      variant="secondary" 
                      className={`gap-1 ${catInfo?.badgeBg || "bg-gray-100 text-gray-700"}`}
                    >
                      {catInfo?.label}
                      <button 
                        type="button"
                        onClick={() => removeCategory(catId)}
                        className="ml-1 hover:opacity-70"
                      >
                        ×
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </form>

            {/* Quick Categories */}
            <div className="grid grid-cols-4 gap-4 max-w-md mt-6">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className="relative flex flex-col items-center gap-2 p-2 transition-all"
                >
                  <div 
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      selectedCategories.includes(cat.id) 
                        ? `${cat.bgColor} ring-2 ${cat.ringColor} ring-offset-2 ring-offset-background` 
                        : ""
                    }`} 
                    style={selectedCategories.includes(cat.id) 
                      ? { 
                          boxShadow: `0 0 28px ${cat.glowColor}, inset 0 3px 6px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.2)`,
                          border: '1.5px solid rgba(255,255,255,0.7)'
                        } 
                      : { 
                          background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.95) 0%, rgba(240,245,255,0.8) 25%, rgba(220,230,250,0.6) 50%, rgba(200,215,245,0.45) 75%, rgba(180,200,235,0.35) 100%), linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(240,245,255,0.5) 100%)',
                          backdropFilter: 'blur(48px) saturate(220%) brightness(1.05)',
                          WebkitBackdropFilter: 'blur(48px) saturate(220%) brightness(1.05)',
                          border: '2.5px solid rgba(255,255,255,0.9)',
                          boxShadow: 'inset 0 8px 20px rgba(255,255,255,1), inset 0 -6px 12px rgba(100,130,200,0.1), inset 2px 0 8px rgba(255,255,255,0.6), inset -2px 0 8px rgba(200,210,240,0.3), 0 16px 48px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.4)'
                        }
                    }
                  >
                    <cat.icon className={`h-7 w-7 ${selectedCategories.includes(cat.id) ? cat.color : "text-gray-600 dark:text-gray-400"}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.label}</span>
                </button>
              ))}
              
              {/* Other - Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="relative flex flex-col items-center gap-2 p-2 transition-all"
                  >
                    <div 
                      className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                        selectedCategories.some(id => otherCategories.some(c => c.id === id))
                          ? "bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-400 ring-offset-2 ring-offset-background"
                          : ""
                      }`} 
                      style={selectedCategories.some(id => otherCategories.some(c => c.id === id)) 
                        ? { 
                            boxShadow: '0 0 28px rgba(139, 92, 246, 0.4), inset 0 3px 6px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.2)',
                            border: '1.5px solid rgba(255,255,255,0.7)'
                          } 
                        : { 
                            background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.95) 0%, rgba(240,245,255,0.8) 25%, rgba(220,230,250,0.6) 50%, rgba(200,215,245,0.45) 75%, rgba(180,200,235,0.35) 100%), linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(240,245,255,0.5) 100%)',
                            backdropFilter: 'blur(48px) saturate(220%) brightness(1.05)',
                            WebkitBackdropFilter: 'blur(48px) saturate(220%) brightness(1.05)',
                            border: '2.5px solid rgba(255,255,255,0.9)',
                            boxShadow: 'inset 0 8px 20px rgba(255,255,255,1), inset 0 -6px 12px rgba(100,130,200,0.1), inset 2px 0 8px rgba(255,255,255,0.6), inset -2px 0 8px rgba(200,210,240,0.3), 0 16px 48px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.4)'
                          }
                      }
                    >
                      <Wrench className={`h-7 w-7 ${selectedCategories.some(id => otherCategories.some(c => c.id === id)) ? "text-purple-500" : "text-gray-600 dark:text-gray-400"}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">More</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-52 p-3 border-0 shadow-xl" 
                  align="start"
                  side="right"
                  sideOffset={12}
                  style={{
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.6)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <div className="space-y-1">
                    {otherCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all hover:bg-gray-100/80 dark:hover:bg-gray-800/50 ${
                          selectedCategories.includes(cat.id) 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "text-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Triage View - AI Analysis Result */}
        {view === "triage" && triageResult && (
          <div className="flex-1 flex flex-col items-center pt-8">
            <div className="w-full max-w-xl">
              {/* What you described */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">You described:</p>
                <p className="text-lg">{problemDescription}</p>
              </div>

              {/* Maya's Analysis */}
              <Card className="mb-6 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-5 py-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Maya's Analysis</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  {/* Urgency Badge */}
                  <div className="flex items-center gap-3">
                    <Badge className={`${getUrgencyColor(triageResult.urgency)} border-0`}>
                      {triageResult.urgency === "critical" || triageResult.urgency === "emergency" ? (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      ) : null}
                      {getUrgencyLabel(triageResult.urgency)}
                    </Badge>
                  </div>

                  {/* Root Cause */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      What's likely happening
                    </h4>
                    <p className="text-base">{triageResult.rootCause}</p>
                  </div>

                  {/* Estimates */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Est. Cost</p>
                        <p className="font-semibold">{triageResult.estimatedCost}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Est. Time</p>
                        <p className="font-semibold">{triageResult.estimatedTime}</p>
                      </div>
                    </div>
                  </div>

                  {/* Suggested Actions */}
                  {triageResult.suggestedActions?.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Recommended steps
                      </h4>
                      <ul className="space-y-2">
                        {triageResult.suggestedActions.slice(0, 3).map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Photos */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <Button variant="outline" className="w-full gap-2">
                    <Camera className="h-4 w-4" />
                    Add Photos
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Photos help contractors give better estimates
                  </p>
                </CardContent>
              </Card>

              {/* Primary Action */}
              <Button 
                size="lg" 
                className="w-full h-14 text-lg rounded-full"
                onClick={() => setView("contractors")}
              >
                Find a Professional
              </Button>

              {/* Chat Option */}
              <Button 
                variant="ghost" 
                className="w-full mt-3 gap-2"
                onClick={() => setView("chat")}
              >
                <MessageCircle className="h-4 w-4" />
                Chat with Maya for more help
              </Button>
            </div>
          </div>
        )}

        {/* Contractors View - Pick a Pro */}
        {view === "contractors" && (
          <div className="flex-1 pt-8">
            <div className="max-w-xl mx-auto">
              <h2 className="text-2xl font-semibold mb-2">Available Professionals</h2>
              <p className="text-muted-foreground mb-6">
                Select a contractor to request their help
              </p>

              {/* Placeholder contractors - will be replaced with real data */}
              <div className="space-y-4">
                {[
                  { id: "1", name: "Mike's Plumbing", specialty: "Plumbing", rating: 4.9, reviews: 127, availability: "Available today", priceRange: "$$ - $$$" },
                  { id: "2", name: "Quick Fix Pro", specialty: "General Repair", rating: 4.7, reviews: 89, availability: "Available tomorrow", priceRange: "$$ - $$" },
                  { id: "3", name: "Elite Home Services", specialty: "Plumbing & HVAC", rating: 4.8, reviews: 203, availability: "Available today", priceRange: "$$$ - $$$$" },
                ].map((contractor) => (
                  <Card key={contractor.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{contractor.name}</h3>
                          <p className="text-sm text-muted-foreground">{contractor.specialty}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
                          <Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
                          <span className="font-medium text-sm">{contractor.rating}</span>
                          <span className="text-xs text-muted-foreground">({contractor.reviews})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3">
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {contractor.availability}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{contractor.priceRange}</span>
                      </div>
                      <Button className="w-full mt-4">
                        Request Help
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat View - Maya Chat */}
        {view === "chat" && (
          <div className="flex-1 flex flex-col pt-8">
            <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Chat with Maya</h2>
                  <p className="text-sm text-muted-foreground">Your AI assistant</p>
                </div>
              </div>
              
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  <div className="bg-muted rounded-2xl rounded-tl-sm p-4 max-w-[80%]">
                    <p className="text-sm">
                      I've analyzed your issue. What else would you like to know? I can help with:
                    </p>
                    <ul className="text-sm mt-2 space-y-1 text-muted-foreground">
                      <li>• DIY tips before calling a pro</li>
                      <li>• What to expect during the repair</li>
                      <li>• Questions to ask contractors</li>
                    </ul>
                  </div>
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="mt-4 relative">
                <Input
                  placeholder="Ask Maya anything..."
                  className="h-12 pl-4 pr-12 rounded-full"
                />
                <Button 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Past Requests View */}
        {view === "pastRequests" && (
          <div className="flex-1 flex flex-col pt-8">
            <div className="max-w-xl mx-auto w-full">
              <h2 className="text-2xl font-semibold mb-6">Your Requests</h2>
              
              {pastRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="p-4 rounded-full bg-muted inline-block mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No requests yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    When you report an issue, it will appear here
                  </p>
                  <Button onClick={() => setView("landing")}>
                    Report an Issue
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastRequests.map((request: any) => (
                    <Card 
                      key={request.id} 
                      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedRequest(request);
                        setSelectedContractorId(mockContractorQuotes[0]?.contractorId || null);
                        setView("requestDetail");
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{request.title}</h3>
                              {unreadByCaseId[request.id] > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-violet-500 text-white text-[10px] font-bold rounded-full">
                                  {unreadByCaseId[request.id]}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {request.property?.name || "Your Property"}
                            </p>
                          </div>
                          <Badge 
                            variant="secondary"
                            className={
                              request.status === "completed" 
                                ? "bg-green-100 text-green-700" 
                                : request.status === "in_progress"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }
                          >
                            {request.status === "in_progress" ? "In Progress" : 
                             request.status === "completed" ? "Completed" : 
                             request.status?.replace(/_/g, " ") || "New"}
                          </Badge>
                        </div>
                        {request.description && (
                          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                            {request.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                          {request.category && (
                            <span className="capitalize">{request.category}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Request Detail View - Chat with Contractors */}
        {view === "requestDetail" && selectedRequest && (
          <div className="flex-1 flex flex-col h-[calc(100vh-8rem)]">
            {/* Request Summary Header - frosted glass */}
            <div 
              className="px-5 py-4 border-b rounded-t-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2))",
                backdropFilter: "blur(24px) saturate(180%) brightness(1.02)",
                WebkitBackdropFilter: "blur(24px) saturate(180%) brightness(1.02)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <h2 className="font-semibold text-lg">{selectedRequest.title || "Request Details"}</h2>
              <p className="text-sm text-muted-foreground">{selectedRequest.description?.slice(0, 100)}</p>
            </div>

            {/* Contractor Selector - Horizontal scroll bubbles with frosted glass */}
            <div className="px-4 py-4 border-b bg-gradient-to-r from-muted/20 to-transparent">
              <div className="flex items-center gap-4 overflow-x-auto pb-2">
                {/* Maya AI bubble - purple gradient with hover effect like home chat box */}
                <button
                  onClick={() => setShowMayaPanel(!showMayaPanel)}
                  className="flex flex-col items-center min-w-[80px] group"
                >
                  <div 
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                      showMayaPanel 
                        ? "ring-2 ring-violet-400/70 scale-105" 
                        : "hover:scale-105 group-hover:ring-2 group-hover:ring-violet-300/50"
                    }`}
                    style={{
                      background: showMayaPanel 
                        ? "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.35), rgba(167, 139, 250, 0.2) 50%, transparent 80%), linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))"
                        : "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.8), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(250,248,255,0.95))",
                      backdropFilter: "blur(48px) saturate(180%) brightness(1.02)",
                      WebkitBackdropFilter: "blur(48px) saturate(180%) brightness(1.02)",
                      boxShadow: showMayaPanel 
                        ? "0 8px 24px rgba(139, 92, 246, 0.25), inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -2px 4px rgba(139,92,246,0.1)"
                        : "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.06)",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <Sparkles 
                      className="h-6 w-6 text-violet-500 dark:text-violet-400" 
                      style={{ animation: "spin 8s linear infinite" }}
                    />
                  </div>
                  <span className={`text-xs mt-2 font-medium transition-colors duration-300 ${showMayaPanel ? "text-violet-600" : "text-foreground"}`}>Maya</span>
                  <span className="text-[10px] text-muted-foreground">AI Advisor</span>
                </button>

                {/* Visible vertical divider between Maya and contractors */}
                <div className="relative flex items-center justify-center px-2">
                  <div 
                    className="w-[2px] h-16 rounded-full"
                    style={{
                      background: "linear-gradient(180deg, transparent 0%, rgba(139, 92, 246, 0.3) 20%, rgba(139, 92, 246, 0.5) 50%, rgba(139, 92, 246, 0.3) 80%, transparent 100%)",
                      boxShadow: "0 0 8px rgba(139, 92, 246, 0.2)",
                    }}
                  />
                </div>

                {/* Contractor bubbles - neutral when unselected, subtle color when selected */}
                {contractorQuotes.map((quote) => {
                  const isSelected = selectedContractorId === quote.contractorId && !showMayaPanel;
                  // Create subtle glow by reducing opacity
                  const subtleGlow = quote.glowColor.replace("0.5", "0.15");
                  const subtleShadow = quote.glowColor.replace("0.5", "0.1");
                  return (
                    <button
                      key={quote.contractorId}
                      onClick={() => {
                        setSelectedContractorId(quote.contractorId);
                        setShowMayaPanel(false);
                        // Mark all contractor messages as read when clicking on them
                        setContractorQuotes(prev => prev.map(q => 
                          q.contractorId === quote.contractorId 
                            ? { ...q, messages: q.messages.map(m => ({ ...m, isRead: true })) }
                            : q
                        ));
                      }}
                      className="flex flex-col items-center min-w-[80px] group"
                    >
                      <div 
                        className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isSelected ? "ring-2 ring-gray-300/60 scale-105" : "hover:scale-105"
                        }`}
                        style={{
                          background: isSelected 
                            ? `radial-gradient(ellipse at 30% 20%, ${subtleGlow}, transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(250,250,252,0.95))`
                            : "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.8), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                          backdropFilter: "blur(48px) saturate(180%) brightness(1.02)",
                          WebkitBackdropFilter: "blur(48px) saturate(180%) brightness(1.02)",
                          boxShadow: isSelected 
                            ? `0 6px 20px ${subtleShadow}, inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.03)`
                            : "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.06)",
                        }}
                      >
                        <span className={`text-sm font-bold transition-colors duration-300 ${isSelected ? quote.textColor : "text-gray-500"}`}>
                          {quote.contractorInitials}
                        </span>
                        {quote.messages.filter(m => m.sender === "contractor" && !m.isRead).length > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                            <span className="text-[10px] text-white font-medium">{quote.messages.filter(m => m.sender === "contractor" && !m.isRead).length}</span>
                          </div>
                        )}
                      </div>
                      <span className={`text-xs mt-2 font-medium truncate max-w-[70px] transition-colors duration-300 ${isSelected ? quote.textColor : "text-foreground"}`}>
                        {quote.contractorName.split(" ")[0]}
                      </span>
                      <span className={`text-[10px] font-medium transition-colors duration-300 ${isSelected ? quote.textColor : "text-muted-foreground"}`}>${quote.quote}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden flex">
              {/* Main Chat Thread - full width always */}
              <div className="flex-1 flex flex-col w-full">
                <ScrollArea className="flex-1 p-4">
                  {selectedContractorId && !showMayaPanel && (
                    <div className="space-y-4">
                      {/* Contractor info card - subtle frosted glass */}
                      {(() => {
                        const quote = contractorQuotes.find(q => q.contractorId === selectedContractorId);
                        if (!quote) return null;
                        const subtleGlow = quote.glowColor.replace("0.5", "0.08");
                        return (
                          <div 
                            className="mb-4 rounded-2xl p-4 border border-gray-200/60"
                            style={{
                              background: `radial-gradient(ellipse at 20% 20%, ${subtleGlow}, transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,250,252,0.9))`,
                              backdropFilter: "blur(24px) saturate(180%) brightness(1.02)",
                              WebkitBackdropFilter: "blur(24px) saturate(180%) brightness(1.02)",
                              boxShadow: "inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.04)",
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center"
                                style={{
                                  background: `radial-gradient(ellipse at 30% 20%, ${quote.glowColor.replace("0.5", "0.2")}, transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,248,250,0.95))`,
                                  boxShadow: "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.06)",
                                }}
                              >
                                <span className={`text-sm font-bold ${quote.textColor}`}>{quote.contractorInitials}</span>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-foreground">{quote.contractorName}</h4>
                                <p className="text-sm text-muted-foreground">{quote.availability}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-xl text-foreground">${quote.quote}</p>
                                <p className="text-xs text-muted-foreground">{quote.estimatedDays} day{quote.estimatedDays > 1 ? "s" : ""} est.</p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button size="sm" className="flex-1">
                                Accept Quote
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1">
                                Decline
                              </Button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Chat messages */}
                      {contractorQuotes
                        .find(q => q.contractorId === selectedContractorId)
                        ?.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === "homeowner" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                msg.sender === "homeowner"
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-muted rounded-bl-md"
                              }`}
                            >
                              <p className="text-sm">{msg.message}</p>
                              <p className={`text-[10px] mt-1 ${msg.sender === "homeowner" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {showMayaPanel && (
                    <div className="space-y-4">
                      {/* Maya Recommendations Section */}
                      <div 
                        className="rounded-2xl p-4 border border-violet-200/60"
                        style={{
                          background: "radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.08), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,248,255,0.9))",
                          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 12px rgba(139, 92, 246, 0.08)",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{
                              background: "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.3), transparent 70%), linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))",
                              boxShadow: "0 2px 8px rgba(139, 92, 246, 0.2)",
                            }}
                          >
                            <Sparkles className="h-4 w-4 text-violet-500" style={{ animation: "spin 8s linear infinite" }} />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">Maya AI</h4>
                            <p className="text-xs text-muted-foreground">Your second opinion</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 shadow-sm">
                            <h5 className="font-medium text-xs mb-2 text-violet-600">Quote Comparison</h5>
                            <div className="space-y-1">
                              {contractorQuotes.map((quote) => (
                                <div key={quote.id} className="flex justify-between items-center text-xs">
                                  <span className="text-muted-foreground truncate">{quote.contractorName}</span>
                                  <span className="font-medium">${quote.quote}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t">
                              Avg: ${Math.round(contractorQuotes.reduce((a, b) => a + b.quote, 0) / contractorQuotes.length)}
                            </p>
                          </div>

                          <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 shadow-sm">
                            <h5 className="font-medium text-xs mb-2 text-violet-600">My Recommendation</h5>
                            <p className="text-xs text-muted-foreground">
                              <strong className="text-foreground">Mike's Roofing</strong> offers good value at $850 with a 2-day timeline. Premier includes a 5-year warranty worth considering.
                            </p>
                          </div>

                          <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 shadow-sm">
                            <h5 className="font-medium text-xs mb-2 text-violet-600">Questions to Ask</h5>
                            <ul className="text-xs text-muted-foreground space-y-0.5">
                              <li>• Warranty on work?</li>
                              <li>• Materials used?</li>
                              <li>• References available?</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Maya Chat Messages */}
                      {mayaChatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === "homeowner" ? "justify-end" : "justify-start"}`}
                        >
                          {msg.sender !== "homeowner" && (
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0"
                              style={{
                                background: "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.3), transparent 70%), linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))",
                                boxShadow: "0 2px 8px rgba(139, 92, 246, 0.2)",
                              }}
                            >
                              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                              msg.sender === "homeowner"
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-violet-100 dark:bg-violet-900/30 rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm">{msg.message}</p>
                            <p className={`text-[10px] mt-1 ${msg.sender === "homeowner" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))}

                      {isMayaTyping && (
                        <div className="flex justify-start">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0"
                            style={{
                              background: "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.3), transparent 70%), linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))",
                            }}
                          >
                            <Sparkles className="h-3.5 w-3.5 text-violet-500" style={{ animation: "spin 1s linear infinite" }} />
                          </div>
                          <div className="bg-violet-100 dark:bg-violet-900/30 rounded-2xl rounded-bl-md px-4 py-2">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={mayaChatEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Chat Input - Contractor */}
                {selectedContractorId && !showMayaPanel && (
                  <div className="p-4 border-t">
                    <div className="relative">
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={`Message ${contractorQuotes.find(q => q.contractorId === selectedContractorId)?.contractorName || "contractor"}...`}
                        className="h-12 pl-4 pr-24 rounded-full"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && chatInput.trim()) {
                            const newMessage: ChatMessage = {
                              id: `msg-${Date.now()}`,
                              sender: "homeowner",
                              message: chatInput,
                              timestamp: new Date(),
                            };
                            setContractorQuotes(prev => prev.map(q => 
                              q.contractorId === selectedContractorId 
                                ? { ...q, messages: [...q.messages, newMessage] }
                                : q
                            ));
                            setChatInput("");
                            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                          }
                        }}
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-10 w-10 rounded-full text-muted-foreground hover:text-primary"
                          onClick={() => setShowMayaPanel(true)}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          className="h-10 w-10 rounded-full"
                          onClick={() => {
                            if (chatInput.trim()) {
                              const newMessage: ChatMessage = {
                                id: `msg-${Date.now()}`,
                                sender: "homeowner",
                                message: chatInput,
                                timestamp: new Date(),
                              };
                              setContractorQuotes(prev => prev.map(q => 
                                q.contractorId === selectedContractorId 
                                  ? { ...q, messages: [...q.messages, newMessage] }
                                  : q
                              ));
                              setChatInput("");
                              setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                            }
                          }}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Chat Input - Maya AI */}
                {showMayaPanel && (
                  <div className="p-4 border-t bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20">
                    <div className="relative">
                      <Input
                        value={mayaChatInput}
                        onChange={(e) => setMayaChatInput(e.target.value)}
                        placeholder="Ask Maya anything about these quotes..."
                        className="h-12 pl-4 pr-14 rounded-full border-violet-200 focus:ring-violet-400"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && mayaChatInput.trim() && !isMayaTyping) {
                            const userMessage = mayaChatInput.trim();
                            const newMessage: ChatMessage = {
                              id: `maya-msg-${Date.now()}`,
                              sender: "homeowner",
                              message: userMessage,
                              timestamp: new Date(),
                            };
                            setMayaChatMessages(prev => [...prev, newMessage]);
                            setMayaChatInput("");
                            setIsMayaTyping(true);
                            setTimeout(() => mayaChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                            
                            try {
                              const res = await apiRequest("POST", "/api/homeowner/maya-chat", {
                                message: userMessage,
                                quotes: contractorQuotes.map(q => ({
                                  name: q.contractorName,
                                  quote: q.quote,
                                  availability: q.availability,
                                  estimatedDays: q.estimatedDays,
                                })),
                                requestDescription: selectedRequest?.description || "",
                              });
                              const response = await res.json();
                              
                              // Handle broadcast action - add message to all contractor threads
                              if (response.action === 'broadcast' && response.broadcastMessage) {
                                const broadcastMsg = response.broadcastMessage;
                                setContractorQuotes(prev => prev.map(q => ({
                                  ...q,
                                  messages: [...q.messages, {
                                    id: `broadcast-${q.contractorId}-${Date.now()}`,
                                    sender: "homeowner" as const,
                                    message: broadcastMsg,
                                    timestamp: new Date(),
                                    isRead: true,
                                  }]
                                })));
                              }
                              
                              const mayaResponse: ChatMessage = {
                                id: `maya-resp-${Date.now()}`,
                                sender: "contractor",
                                message: response.reply || "I'm here to help you compare quotes and make the best decision. What would you like to know?",
                                timestamp: new Date(),
                              };
                              setMayaChatMessages(prev => [...prev, mayaResponse]);
                            } catch (error) {
                              const fallbackResponse: ChatMessage = {
                                id: `maya-resp-${Date.now()}`,
                                sender: "contractor",
                                message: "I'd be happy to help! Based on the quotes you've received, Mike's Roofing at $850 offers the best value with quick availability. Would you like me to help you compare specific aspects or draft a message to send to all contractors?",
                                timestamp: new Date(),
                              };
                              setMayaChatMessages(prev => [...prev, fallbackResponse]);
                            } finally {
                              setIsMayaTyping(false);
                              setTimeout(() => mayaChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                            }
                          }
                        }}
                      />
                      <Button 
                        size="icon" 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-violet-500 hover:bg-violet-600"
                        disabled={isMayaTyping || !mayaChatInput.trim()}
                        onClick={async () => {
                          if (mayaChatInput.trim() && !isMayaTyping) {
                            const userMessage = mayaChatInput.trim();
                            const newMessage: ChatMessage = {
                              id: `maya-msg-${Date.now()}`,
                              sender: "homeowner",
                              message: userMessage,
                              timestamp: new Date(),
                            };
                            setMayaChatMessages(prev => [...prev, newMessage]);
                            setMayaChatInput("");
                            setIsMayaTyping(true);
                            setTimeout(() => mayaChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                            
                            try {
                              const res = await apiRequest("POST", "/api/homeowner/maya-chat", {
                                message: userMessage,
                                quotes: contractorQuotes.map(q => ({
                                  name: q.contractorName,
                                  quote: q.quote,
                                  availability: q.availability,
                                  estimatedDays: q.estimatedDays,
                                })),
                                requestDescription: selectedRequest?.description || "",
                              });
                              const response = await res.json();
                              
                              // Handle broadcast action - add message to all contractor threads
                              if (response.action === 'broadcast' && response.broadcastMessage) {
                                const broadcastMsg = response.broadcastMessage;
                                setContractorQuotes(prev => prev.map(q => ({
                                  ...q,
                                  messages: [...q.messages, {
                                    id: `broadcast-${q.contractorId}-${Date.now()}`,
                                    sender: "homeowner" as const,
                                    message: broadcastMsg,
                                    timestamp: new Date(),
                                    isRead: true,
                                  }]
                                })));
                              }
                              
                              const mayaResponse: ChatMessage = {
                                id: `maya-resp-${Date.now()}`,
                                sender: "contractor",
                                message: response.reply || "I'm here to help you compare quotes and make the best decision. What would you like to know?",
                                timestamp: new Date(),
                              };
                              setMayaChatMessages(prev => [...prev, mayaResponse]);
                            } catch (error) {
                              const fallbackResponse: ChatMessage = {
                                id: `maya-resp-${Date.now()}`,
                                sender: "contractor",
                                message: "I'd be happy to help! Based on the quotes you've received, Mike's Roofing at $850 offers the best value with quick availability. Would you like me to help you compare specific aspects or draft a message to send to all contractors?",
                                timestamp: new Date(),
                              };
                              setMayaChatMessages(prev => [...prev, fallbackResponse]);
                            } finally {
                              setIsMayaTyping(false);
                              setTimeout(() => mayaChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                            }
                          }
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedRequest && homeownerConversations.some((c: any) => c.caseId === selectedRequest.id) && (
              <div className="px-4 pb-4">
                <ThreadChat
                  caseId={selectedRequest.id}
                  orgId={selectedRequest.orgId}
                  subject={selectedRequest.title}
                />
              </div>
            )}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
