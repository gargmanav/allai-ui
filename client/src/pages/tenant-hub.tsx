import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { AnimatedPyramid } from "@/components/AnimatedPyramid";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThreadChat } from "@/components/contractor/thread-chat";
import { MayaPhotoAnalysis } from "@/components/contractor/maya-photo-analysis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Pencil, Trash2, MessageCircle } from "lucide-react";
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
  X,
  ImagePlus,
  ArrowLeft,
  Star,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Home,
  FileText,
  LogOut,
  ChevronRight,
  Sparkles,
  Search,
  User,
  CalendarDays,
  CircleDot
} from "lucide-react";

type ViewState = "landing" | "triage" | "pickTime" | "pastRequests" | "requestDetail" | "chat";

interface TriageResult {
  urgency: string;
  rootCause: string;
  estimatedTime: string;
  suggestedActions: string[];
  category: string;
}

interface TenantCase {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  buildingName?: string;
  roomNumber?: string;
  createdAt: string;
  updatedAt: string;
  assignedContractorId?: string;
  assignedContractorName?: string;
  scheduledStartAt?: string;
  orgId?: string;
  aiTriageJson?: {
    photoAnalysis?: {
      tenant?: { summary: string; advice: string; safetyLevel?: string };
    };
  };
  media?: Array<{ id: string; url: string; type: string; caption?: string }>;
}

interface ChatMessage {
  id: string;
  sender: "tenant" | "contractor" | "maya";
  message: string;
  timestamp: Date;
  isRead?: boolean;
}

const STATUS_STEPS = [
  { id: "submitted", label: "Submitted", icon: FileText },
  { id: "assigned", label: "Assigned", icon: User },
  { id: "scheduled", label: "Scheduled", icon: CalendarDays },
  { id: "in_progress", label: "In Progress", icon: Wrench },
  { id: "completed", label: "Completed", icon: CheckCircle },
];

function getStatusStep(status: string): number {
  switch (status) {
    case "New":
    case "Open":
      return 0;
    case "In Review":
    case "Assigned":
      return 1;
    case "Scheduled":
    case "Confirmed":
      return 2;
    case "In Progress":
      return 3;
    case "Resolved":
    case "Completed":
    case "Closed":
      return 4;
    default:
      return 0;
  }
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case "New":
    case "Open":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
    case "In Review":
    case "Assigned":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
    case "Scheduled":
    case "Confirmed":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300";
    case "In Progress":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300";
    case "Resolved":
    case "Completed":
    case "Closed":
      return "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300";
  }
}

export default function TenantHub() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<ViewState>("landing");
  const [problemDescription, setProblemDescription] = useState("");
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TenantCase | null>(null);
  const [showMayaPanel, setShowMayaPanel] = useState(false);
  const [mayaChatMessages, setMayaChatMessages] = useState<ChatMessage[]>([]);
  const [mayaChatInput, setMayaChatInput] = useState("");
  const [isMayaTyping, setIsMayaTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingRequestId, setRenamingRequestId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<{ file: File; preview: string }[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const mayaChatEndRef = useRef<HTMLDivElement>(null);

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.slice(0, 5 - selectedPhotos.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setSelectedPhotos(prev => [...prev, ...newPhotos].slice(0, 5));
    if (e.target) e.target.value = "";
  }, [selectedPhotos.length]);

  const removePhoto = useCallback((index: number) => {
    setSelectedPhotos(prev => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const firstName = user?.firstName || "there";

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

  const { data: myCases = [] } = useQuery<TenantCase[]>({
    queryKey: ['/api/tenant/cases'],
    enabled: !!user,
  });

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: ['/api/tenant/appointments'],
    enabled: !!user,
  });

  const { data: scheduledJobs = [] } = useQuery<any[]>({
    queryKey: ['/api/scheduled-jobs'],
    enabled: !!user,
  });

  useEffect(() => {
    if (selectedRequest?.id && myCases.length > 0) {
      const updated = myCases.find((r) => r.id === selectedRequest.id);
      if (updated && (updated.status !== selectedRequest.status || updated.scheduledStartAt !== selectedRequest.scheduledStartAt)) {
        setSelectedRequest(updated);
      }
    }
  }, [myCases, selectedRequest?.id]);

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

  const createCaseMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; category?: string; aiTriageJson?: any; priority?: string; mediaUrls?: string[] }) => {
      const response = await apiRequest("POST", "/api/tenant/cases", {
        title: data.title,
        description: data.description,
        priority: data.priority,
        category: data.category,
        aiTriageJson: data.aiTriageJson,
        mediaUrls: data.mediaUrls || [],
      });
      return response.json();
    },
    onSuccess: async (newCase) => {
      if (selectedPhotos.length > 0 && newCase?.id) {
        try {
          const formData = new FormData();
          selectedPhotos.forEach(p => formData.append("photos", p.file));
          const headers: Record<string, string> = {};
          const refreshToken = localStorage.getItem("refreshToken");
          if (refreshToken) {
            headers["Authorization"] = `Bearer ${refreshToken}`;
          }
          const uploadRes = await fetch(`/api/tenant/cases/${newCase.id}/photos`, {
            method: "POST",
            body: formData,
            credentials: "include",
            headers,
          });
          if (!uploadRes.ok) {
            toast({ title: "Photos couldn't be uploaded", description: "Your request was saved but photos failed to upload.", variant: "destructive" });
          }
        } catch (err) {
          console.error("Photo upload failed:", err);
          toast({ title: "Photos couldn't be uploaded", description: "Your request was saved but photos failed to upload.", variant: "destructive" });
        }
        selectedPhotos.forEach(p => URL.revokeObjectURL(p.preview));
        setSelectedPhotos([]);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      setSelectedRequest(newCase);
      setView("requestDetail");
      toast({ title: "Request submitted", description: "Your maintenance request has been sent to your property manager." });
    },
    onError: () => {
      toast({ title: "Failed to submit", description: "Could not save your request. Please try again.", variant: "destructive" });
    },
  });

  const renameCaseMutation = useMutation({
    mutationFn: async ({ caseId, title }: { caseId: string; title: string }) => {
      const response = await apiRequest("PATCH", `/api/tenant/cases/${caseId}`, { title });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
      setRenamingRequestId(null);
      setRenameValue("");
      toast({ title: "Request renamed" });
    },
    onError: () => {
      toast({ title: "Failed to rename request", variant: "destructive" });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await apiRequest("DELETE", `/api/tenant/cases/${caseId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
      setDeletingRequestId(null);
      if (selectedRequest?.id === deletingRequestId) {
        setSelectedRequest(null);
        setView("landing");
      }
      toast({ title: "Request deleted" });
    },
    onError: (error: any) => {
      let msg = "Failed to delete request";
      try {
        const raw = error?.message || "";
        const jsonPart = raw.substring(raw.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        if (parsed.error) msg = parsed.error;
      } catch {}
      toast({ title: msg, variant: "destructive" });
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
    if (view === "triage" || view === "chat" || view === "pastRequests" || view === "pickTime") {
      setView("landing");
      setTriageResult(null);
      setProblemDescription("");
      setSelectedCategories([]);
    }
  };

  const isUrgent = (urgency: string) => {
    const u = urgency?.toLowerCase();
    return u === "critical" || u === "emergency" || u === "high" || u === "urgent";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex">
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
              {myCases
                .filter((request) => {
                  if (!searchQuery.trim()) return true;
                  const query = searchQuery.toLowerCase();
                  const title = (request.title || "").toLowerCase();
                  const description = (request.description || "").toLowerCase();
                  return title.includes(query) || description.includes(query);
                })
                .slice(0, searchQuery ? 20 : 5)
                .map((request) => (
                <div key={request.id}>
                  {deletingRequestId === request.id ? (
                    <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                      <p className="text-xs text-destructive font-medium">Delete this request?</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={deleteCaseMutation.isPending}
                          onClick={() => deleteCaseMutation.mutate(request.id)}
                        >
                          {deleteCaseMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setDeletingRequestId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : renamingRequestId === request.id ? (
                    <div className="px-3 py-2 rounded-lg bg-muted space-y-2">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && renameValue.trim()) {
                            renameCaseMutation.mutate({ caseId: request.id, title: renameValue.trim() });
                          } else if (e.key === "Escape") {
                            setRenamingRequestId(null);
                            setRenameValue("");
                          }
                        }}
                        className="h-7 text-sm"
                        placeholder="New name..."
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!renameValue.trim() || renameCaseMutation.isPending}
                          onClick={() => renameCaseMutation.mutate({ caseId: request.id, title: renameValue.trim() })}
                        >
                          {renameCaseMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => { setRenamingRequestId(null); setRenameValue(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedRequest(request);
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
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setRenamingRequestId(request.id);
                            setRenameValue(request.title || "");
                          }}>
                            <Pencil className="h-3 w-3 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingRequestId(request.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              ))}
              {myCases.length === 0 && !searchQuery && (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  No requests yet
                </p>
              )}
              {searchQuery && myCases.filter((r) => {
                const q = searchQuery.toLowerCase();
                return (r.title || "").toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q);
              }).length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  No matching requests
                </p>
              )}
              {!searchQuery && myCases.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-sm text-muted-foreground"
                  onClick={() => setView("pastRequests")}
                >
                  View all {myCases.length} requests
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
                  description: "Profile settings coming soon - manage email and notifications",
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

      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? "ml-72" : "ml-0"}`}>
        <header className="fixed top-0 right-0 z-50 bg-background/80 backdrop-blur-sm transition-all duration-300" style={{ left: sidebarOpen ? "288px" : "0" }}>
          <div className="relative flex items-center justify-center px-6 py-4">
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

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <AnimatedPyramid size={56} />
                <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">AllAI</span>
              </div>
              <span className="text-xs text-muted-foreground italic mt-1">Maintenance made easy.</span>
            </div>
          </div>
        </header>

        <main className="pt-32 pb-8 px-6 max-w-4xl mx-auto min-h-screen flex flex-col">

        {view === "landing" && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-16">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-semibold mb-2">
                Hi, {firstName}
              </h1>
              <p className="text-muted-foreground">
                Tell me what needs fixing and I'll handle the rest.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full max-w-xl mb-8">
              <label htmlFor="problem-input" className="sr-only">
                What needs fixing?
              </label>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 rounded-full opacity-30 blur-lg group-hover:opacity-50 group-focus-within:opacity-60 transition-opacity duration-300" />
                <Input
                  id="problem-input"
                  ref={inputRef}
                  type="text"
                  placeholder="What needs fixing?"
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  className="relative h-14 pl-5 pr-24 text-lg rounded-full border-2 border-muted-foreground/20 focus:border-primary/50 shadow-lg bg-background"
                  disabled={isAnalyzing}
                  aria-label="What needs fixing?"
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

        {view === "triage" && triageResult && (
          <div className="flex-1 flex flex-col items-center pt-8">
            <div className="w-full max-w-xl">
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">You described:</p>
                <p className="text-lg">{problemDescription}</p>
              </div>

              <Card className="mb-6 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-5 py-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Maya's Analysis</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  {isUrgent(triageResult.urgency) && (
                    <div className="flex items-center gap-3">
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Urgent
                      </Badge>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      What's likely happening
                    </h4>
                    <p className="text-base">{triageResult.rootCause}</p>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Est. Time</p>
                      <p className="font-semibold">{triageResult.estimatedTime}</p>
                    </div>
                  </div>

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

              <Card className="mb-6">
                <CardContent className="p-4">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  {selectedPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {selectedPhotos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                          <img src={photo.preview} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removePhoto(idx)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ minWidth: 24, minHeight: 24 }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {selectedPhotos.length < 5 && (
                        <button
                          onClick={() => photoInputRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-gray-400 transition-colors"
                          style={{ minHeight: 44 }}
                        >
                          <ImagePlus className="h-5 w-5" />
                          <span className="text-[10px]">Add More</span>
                        </button>
                      )}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => photoInputRef.current?.click()}
                    style={{ minHeight: 44 }}
                  >
                    <Camera className="h-4 w-4" />
                    {selectedPhotos.length > 0 ? `${selectedPhotos.length} Photo${selectedPhotos.length > 1 ? 's' : ''} Added` : 'Add Photos'}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    {selectedPhotos.length > 0 ? `${5 - selectedPhotos.length} more allowed` : 'Photos help us understand your issue better'}
                  </p>
                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full h-14 text-lg rounded-full bg-blue-100/80 text-blue-600 hover:bg-blue-200/80 border border-blue-200/60 shadow-sm"
                disabled={createCaseMutation.isPending}
                onClick={() => {
                  const priority = isUrgent(triageResult.urgency) ? 'Urgent' : 'Normal';
                  createCaseMutation.mutate({
                    title: problemDescription.slice(0, 80),
                    description: problemDescription,
                    category: selectedCategories.length > 0 ? selectedCategories[0] : triageResult?.category || undefined,
                    aiTriageJson: triageResult,
                    priority,
                  });
                }}
              >
                {createCaseMutation.isPending ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : null}
                {createCaseMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>

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

        {view === "chat" && (
          <div className="flex-1 flex flex-col pt-8">
            <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
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
                      <li>• DIY tips before calling maintenance</li>
                      <li>• What to expect during the repair</li>
                      <li>• Safety precautions to take</li>
                    </ul>
                  </div>
                </div>
              </ScrollArea>

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

        {view === "pastRequests" && (
          <div className="flex-1 flex flex-col pt-8">
            <div className="max-w-xl mx-auto w-full">
              <h2 className="text-2xl font-semibold mb-6">Your Requests</h2>

              {myCases.length === 0 ? (
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
                  {myCases.map((request) => (
                    <Card
                      key={request.id}
                      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedRequest(request);
                        setView("requestDetail");
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{request.title}</h3>
                              {request.priority === "Urgent" && (
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Urgent
                                </Badge>
                              )}
                            </div>
                            {request.buildingName && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {request.buildingName}{request.roomNumber ? ` • Unit ${request.roomNumber}` : ''}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="secondary"
                            className={getStatusBadgeColor(request.status)}
                          >
                            {request.status || "New"}
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
                          {request.assignedContractorName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {request.assignedContractorName}
                            </span>
                          )}
                          {request.scheduledStartAt && (
                            <span className="flex items-center gap-1 text-purple-600">
                              <CalendarDays className="h-3 w-3" />
                              {(() => {
                                const iso = typeof request.scheduledStartAt === 'string' ? request.scheduledStartAt : new Date(request.scheduledStartAt).toISOString();
                                const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
                                return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                              })()}
                            </span>
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

        {view === "requestDetail" && selectedRequest && (
          <div className="flex-1 flex flex-col h-[calc(100vh-8rem)]">
            <div
              className="px-5 py-4 border-b rounded-t-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2))",
                backdropFilter: "blur(24px) saturate(180%) brightness(1.02)",
                WebkitBackdropFilter: "blur(24px) saturate(180%) brightness(1.02)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg">{selectedRequest.title || "Request Details"}</h2>
                    {selectedRequest.priority === "Urgent" && (
                      <Badge className="bg-red-100 text-red-700 border-0 gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Urgent
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedRequest.description?.slice(0, 100)}</p>
                </div>
                <Badge variant="secondary" className={getStatusBadgeColor(selectedRequest.status)}>
                  {selectedRequest.status || "New"}
                </Badge>
              </div>
              {selectedRequest.media && selectedRequest.media.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                  {selectedRequest.media.map((photo) => (
                    <img
                      key={photo.id}
                      src={photo.url}
                      alt="Request photo"
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200/60"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 pt-4 pb-2">
              <div
                className="rounded-2xl p-4 border border-blue-200/40"
                style={{
                  background: "radial-gradient(ellipse at 20% 20%, rgba(59, 130, 246, 0.04), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,255,0.92))",
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  boxShadow: "inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 16px rgba(59, 130, 246, 0.06)",
                }}
              >
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <CheckCircle className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    Status
                  </span>
                </div>

                <div className="relative flex items-center justify-between px-1">
                  {STATUS_STEPS.map((step, idx) => {
                    const activeStep = getStatusStep(selectedRequest.status);
                    const Icon = step.icon;
                    const isComplete = idx < activeStep;
                    const isCurrent = idx === activeStep;

                    return (
                      <div key={step.id} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                            isComplete
                              ? "bg-gradient-to-br from-green-500 to-green-600 shadow-md shadow-green-200"
                              : isCurrent
                              ? "bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg shadow-blue-200 ring-4 ring-blue-100"
                              : "bg-slate-100 border-2 border-slate-200"
                          }`}
                        >
                          <Icon
                            className={`h-3.5 w-3.5 ${
                              isComplete || isCurrent ? "text-white" : "text-slate-300"
                            }`}
                          />
                        </div>
                        <span
                          className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${
                            isComplete
                              ? "text-green-600"
                              : isCurrent
                              ? "text-blue-700 font-semibold"
                              : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}

                  <div className="absolute top-4 left-0 right-0 h-[3px] z-0 mx-8">
                    <div className="relative w-full h-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: (() => {
                            const step = getStatusStep(selectedRequest.status);
                            if (step === 0) return "0%";
                            if (step === 1) return "25%";
                            if (step === 2) return "50%";
                            if (step === 3) return "75%";
                            return "100%";
                          })(),
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <p className="text-xs text-slate-500">
                    {(() => {
                      const step = getStatusStep(selectedRequest.status);
                      if (step === 0) return "Your request has been submitted and is being reviewed";
                      if (step === 1) return selectedRequest.assignedContractorName
                        ? `${selectedRequest.assignedContractorName} has been assigned to your request`
                        : "A contractor is being assigned to your request";
                      if (step === 2) return selectedRequest.scheduledStartAt
                        ? `Work scheduled for ${(() => {
                            const iso = typeof selectedRequest.scheduledStartAt === 'string' ? selectedRequest.scheduledStartAt : new Date(selectedRequest.scheduledStartAt).toISOString();
                            const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
                            return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                          })()}`
                        : "Work has been scheduled";
                      if (step === 3) return "Work is underway";
                      return "Work complete";
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {selectedRequest.assignedContractorName && (
              <div className="px-4 py-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.12), transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,246,255,0.95))",
                      boxShadow: "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.03), 0 4px 12px rgba(139, 92, 246, 0.08)",
                    }}
                  >
                    <span className="text-sm font-bold text-violet-600">
                      {selectedRequest.assignedContractorName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedRequest.assignedContractorName}</p>
                    <p className="text-xs text-muted-foreground">Assigned contractor</p>
                  </div>
                </div>
              </div>
            )}

            {selectedRequest.scheduledStartAt && (
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-50/60 border border-purple-100/60">
                  <CalendarDays className="h-4 w-4 text-purple-500 shrink-0" />
                  <span className="text-sm text-purple-700 font-medium">
                    Scheduled for {(() => {
                      const iso = typeof selectedRequest.scheduledStartAt === 'string' ? selectedRequest.scheduledStartAt : new Date(selectedRequest.scheduledStartAt).toISOString();
                      const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
                    })()}
                  </span>
                </div>
              </div>
            )}

            <div className="px-4 py-3 border-b bg-gradient-to-r from-muted/20 to-transparent">
              <div className="flex items-center gap-4 overflow-x-auto pb-2">
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

                {selectedRequest.assignedContractorId && (
                  <>
                    <div className="relative flex items-center justify-center px-2">
                      <div
                        className="w-[2px] h-16 rounded-full"
                        style={{
                          background: "linear-gradient(180deg, transparent 0%, rgba(139, 92, 246, 0.3) 20%, rgba(139, 92, 246, 0.5) 50%, rgba(139, 92, 246, 0.3) 80%, transparent 100%)",
                          boxShadow: "0 0 8px rgba(139, 92, 246, 0.2)",
                        }}
                      />
                    </div>

                    <button
                      onClick={() => setShowMayaPanel(false)}
                      className="flex flex-col items-center min-w-[80px] group"
                    >
                      <div
                        className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                          !showMayaPanel ? "ring-2 ring-violet-300/60 scale-105" : "hover:scale-105"
                        }`}
                        style={{
                          background: !showMayaPanel
                            ? "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.15), transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(250,248,255,0.95))"
                            : "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.8), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                          backdropFilter: "blur(48px) saturate(180%) brightness(1.02)",
                          WebkitBackdropFilter: "blur(48px) saturate(180%) brightness(1.02)",
                          boxShadow: !showMayaPanel
                            ? "0 6px 20px rgba(139, 92, 246, 0.1), inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.03)"
                            : "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.06)",
                        }}
                      >
                        <span className={`text-sm font-bold transition-colors duration-300 ${!showMayaPanel ? "text-violet-600" : "text-gray-500"}`}>
                          {selectedRequest.assignedContractorName?.charAt(0).toUpperCase() || "C"}
                        </span>
                      </div>
                      <span className={`text-xs mt-2 font-medium truncate max-w-[70px] transition-colors duration-300 ${!showMayaPanel ? "text-violet-600" : "text-foreground"}`}>
                        {selectedRequest.assignedContractorName?.split(' ')[0] || "Contractor"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Message</span>
                    </button>
                  </>
                )}

                {!selectedRequest.assignedContractorId && (
                  <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Waiting for contractor assignment...
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              <div className="flex-1 flex flex-col w-full">
                <ScrollArea className="flex-1 p-4">
                  {showMayaPanel && (
                    <div className="space-y-4">
                      <div
                        className="rounded-2xl p-4 border border-violet-200/40"
                        style={{
                          background: "radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.06), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,248,255,0.9))",
                          backdropFilter: "blur(24px) saturate(180%)",
                          WebkitBackdropFilter: "blur(24px) saturate(180%)",
                          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 12px rgba(139, 92, 246, 0.06)",
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
                            <p className="text-xs text-muted-foreground">Your maintenance advisor</p>
                          </div>
                        </div>

                        {selectedRequest.media && selectedRequest.media.length > 0 && selectedRequest.aiTriageJson?.photoAnalysis && (
                          <MayaPhotoAnalysis
                            media={selectedRequest.media}
                            photoAnalysis={selectedRequest.aiTriageJson.photoAnalysis}
                            mode="tenant"
                          />
                        )}

                        <div className="mt-3 space-y-3">
                          <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 shadow-sm">
                            <h5 className="font-medium text-xs mb-2 text-violet-600">About Your Request</h5>
                            <p className="text-xs text-muted-foreground">
                              {selectedRequest.aiTriageJson?.rootCause ||
                               `Your ${selectedRequest.category || 'maintenance'} request has been submitted. ${
                                selectedRequest.assignedContractorName
                                  ? `${selectedRequest.assignedContractorName} is handling this.`
                                  : 'A contractor will be assigned soon.'
                              }`}
                            </p>
                          </div>

                          <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 shadow-sm">
                            <h5 className="font-medium text-xs mb-2 text-violet-600">What to Expect</h5>
                            <ul className="text-xs text-muted-foreground space-y-0.5">
                              <li>• Your property manager will review this</li>
                              <li>• A contractor will be assigned</li>
                              <li>• You'll be notified when work is scheduled</li>
                            </ul>
                          </div>

                          <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 shadow-sm">
                            <h5 className="font-medium text-xs mb-2 text-violet-600">Tips</h5>
                            <ul className="text-xs text-muted-foreground space-y-0.5">
                              <li>• Keep the area accessible for repairs</li>
                              <li>• Note any changes to the issue</li>
                              <li>• Message the contractor with questions</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {mayaChatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === "tenant" ? "justify-end" : "justify-start"}`}
                        >
                          {msg.sender !== "tenant" && (
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
                              msg.sender === "tenant"
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-violet-100 dark:bg-violet-900/30 rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm">{msg.message}</p>
                            <p className={`text-[10px] mt-1 ${msg.sender === "tenant" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
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

                  {!showMayaPanel && selectedRequest.assignedContractorId && (
                    <div className="space-y-4">
                      <div
                        className="rounded-2xl p-4 border border-violet-200/40"
                        style={{
                          background: "radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.06), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,248,255,0.9))",
                          backdropFilter: "blur(24px) saturate(180%)",
                          WebkitBackdropFilter: "blur(24px) saturate(180%)",
                          boxShadow: "inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 12px rgba(139, 92, 246, 0.06)",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center"
                            style={{
                              background: "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.12), transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,246,255,0.95))",
                              boxShadow: "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.03), 0 4px 12px rgba(139, 92, 246, 0.08)",
                            }}
                          >
                            <span className="text-sm font-bold text-violet-600">
                              {selectedRequest.assignedContractorName?.charAt(0).toUpperCase() || "C"}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{selectedRequest.assignedContractorName}</h4>
                            <p className="text-sm text-muted-foreground">Your assigned contractor</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!showMayaPanel && !selectedRequest.assignedContractorId && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Waiting for a contractor to be assigned</p>
                      <p className="text-xs mt-1">Your property manager is reviewing your request</p>
                    </div>
                  )}
                </ScrollArea>

                {!showMayaPanel && selectedRequest.assignedContractorId && selectedRequest && (
                  <div className="p-4 border-t">
                    <ThreadChat
                      caseId={selectedRequest.id}
                      orgId={selectedRequest.orgId}
                      subject={selectedRequest.title}
                      contractorUserId={selectedRequest.assignedContractorId}
                    />
                  </div>
                )}

                {showMayaPanel && (
                  <div className="p-4 border-t bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20">
                    <div className="relative">
                      <Input
                        value={mayaChatInput}
                        onChange={(e) => setMayaChatInput(e.target.value)}
                        placeholder="Ask Maya about your maintenance request..."
                        className="h-12 pl-4 pr-14 rounded-full border-violet-200 focus:ring-violet-400"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && mayaChatInput.trim() && !isMayaTyping) {
                            const userMessage = mayaChatInput.trim();
                            const newMessage: ChatMessage = {
                              id: `maya-msg-${Date.now()}`,
                              sender: "tenant",
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
                                quotes: [],
                                requestDescription: selectedRequest?.description || "",
                              });
                              const response = await res.json();

                              const mayaResponse: ChatMessage = {
                                id: `maya-resp-${Date.now()}`,
                                sender: "maya",
                                message: response.reply || "I'm here to help with your maintenance request. What would you like to know?",
                                timestamp: new Date(),
                              };
                              setMayaChatMessages(prev => [...prev, mayaResponse]);
                            } catch (error) {
                              const fallbackResponse: ChatMessage = {
                                id: `maya-resp-${Date.now()}`,
                                sender: "maya",
                                message: "I'd be happy to help! Let me know what questions you have about your maintenance request.",
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
                              sender: "tenant",
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
                                quotes: [],
                                requestDescription: selectedRequest?.description || "",
                              });
                              const response = await res.json();

                              const mayaResponse: ChatMessage = {
                                id: `maya-resp-${Date.now()}`,
                                sender: "maya",
                                message: response.reply || "I'm here to help with your maintenance request. What would you like to know?",
                                timestamp: new Date(),
                              };
                              setMayaChatMessages(prev => [...prev, mayaResponse]);
                            } catch (error) {
                              const fallbackResponse: ChatMessage = {
                                id: `maya-resp-${Date.now()}`,
                                sender: "maya",
                                message: "I'd be happy to help! Let me know what questions you have about your maintenance request.",
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

          </div>
        )}
      </main>
      </div>
    </div>
  );
}
