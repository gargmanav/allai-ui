import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, AlertTriangle, CheckCircle, Wrench, Bot, Send, Home, Building, Camera, Loader2, MessageSquare, Bell, Plus, ChevronLeft, ChevronRight, User, LogOut, Settings } from "lucide-react";
import { MayaPhotoAnalysis } from "@/components/contractor/maya-photo-analysis";
import { LiveNotification } from "@/components/ui/live-notification";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import { ObjectUploader } from "@/components/ObjectUploader";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog as ProfileDialog, DialogContent as ProfileDialogContent, DialogHeader as ProfileDialogHeader, DialogTitle as ProfileDialogTitle } from "@/components/ui/dialog";
import UserProfileForm from "@/components/forms/user-profile-form";
import { format, addDays, startOfWeek, isSameDay, parseISO, isToday } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import type { MessageThread, ChatMessage, User as UserType } from "@shared/schema";

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
  aiTriageJson?: {
    photoAnalysis?: {
      tenant?: { summary: string; advice: string; safetyLevel?: string };
    };
  };
  media?: Array<{ id: string; url: string; type: string; caption?: string }>;
}

interface TenantAppointment {
  id: string;
  caseId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  notes?: string;
  requiresTenantAccess: boolean;
  tenantApproved: boolean;
}

interface ScheduledJob {
  id: string;
  title: string;
  description: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  status: string;
  urgency: string;
  caseId: string | null;
  contractorId: string | null;
  address: string | null;
  notes: string | null;
  orgId: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  data?: any;
}

interface PropertyMatch {
  id: string;
  name: string;
  address: string;
  unitId?: string;
  unitNumber?: string;
  matchScore: number;
  matchReason: string;
}

interface Reminder {
  id: string;
  title: string;
  description?: string | null;
  dueAt: string | null;
  type: string;
  status: string;
}

const TIMEZONE = 'America/New_York';

const PRIORITY_COLORS: Record<string, string> = {
  Low: "text-green-700 border-green-300 bg-green-50",
  Medium: "text-amber-700 border-amber-300 bg-amber-50",
  High: "text-orange-600 border-orange-300 bg-orange-50",
  Urgent: "text-red-700 border-red-300 bg-red-50"
};

const STATUS_COLORS: Record<string, string> = {
  New: "text-blue-700 border-blue-300 bg-blue-50",
  "In Review": "text-amber-700 border-amber-300 bg-amber-50",
  Scheduled: "text-purple-700 border-purple-300 bg-purple-50",
  "In Progress": "text-orange-600 border-orange-300 bg-orange-50",
  "On Hold": "text-gray-700 border-gray-300 bg-gray-50",
  Resolved: "text-green-700 border-green-300 bg-green-50",
  Closed: "text-gray-600 border-gray-300 bg-gray-50"
};

export default function TenantDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm Maya 👋 Tell me about your maintenance issue and I'll help you submit a request.",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<"initial" | "property_matching" | "confirming" | "creating" | "tenant_confirming">("initial");
  const [propertyMatches, setPropertyMatches] = useState<PropertyMatch[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyMatch | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [triageData, setTriageData] = useState<any>(null);
  const [uploadedMedia, setUploadedMedia] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCase, setSelectedCase] = useState<TenantCase | null>(null);
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const nowInTz = toZonedTime(new Date(), TIMEZONE);
    return startOfWeek(nowInTz, { weekStartsOn: 1 });
  });

  useEffect(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [messages, isProcessing]);

  const { data: myCases = [], isLoading: casesLoading } = useQuery<TenantCase[]>({
    queryKey: ['/api/tenant/cases'],
    enabled: !!user
  });

  const { data: appointments = [] } = useQuery<TenantAppointment[]>({
    queryKey: ['/api/tenant/appointments'],
    enabled: !!user
  });

  const { data: scheduledJobs = [] } = useQuery<ScheduledJob[]>({
    queryKey: ['/api/scheduled-jobs'],
    enabled: !!user
  });

  const { data: reminders = [] } = useQuery<Reminder[]>({
    queryKey: ['/api/reminders'],
    enabled: !!user
  });

  const { data: messageThreads = [] } = useQuery<MessageThread[]>({
    queryKey: ['/api/messages/threads'],
    enabled: !!user
  });

  const { data: contacts = [] } = useQuery<UserType[]>({
    queryKey: ['/api/tenant/contacts'],
    enabled: !!user
  });

  const myCaseIds = new Set(myCases.map(c => c.id));
  const pendingJobApprovals = scheduledJobs.filter(job => 
    job.status === 'Pending Approval' && job.caseId && myCaseIds.has(job.caseId)
  );

  const activeCases = myCases.filter(c => !['Resolved', 'Closed'].includes(c.status));
  const inProgressCases = myCases.filter(c => ['In Progress', 'Scheduled'].includes(c.status));
  const pendingApproval = appointments.filter(a => a.requiresTenantAccess && !a.tenantApproved);
  const upcomingAppointments = appointments.filter(a => 
    new Date(a.scheduledStartAt) > new Date() && a.status !== 'Cancelled'
  );

  const myJobs = scheduledJobs.filter(job => 
    job.scheduledStartAt && job.caseId && myCaseIds.has(job.caseId)
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const upcomingReminders = reminders
    .filter(r => r.status !== 'completed' && r.dueAt)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
    .slice(0, 5);

  const sendMayaMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsProcessing(true);

    try {
      if (conversationState === "initial") {
        setIssueDescription(content);
        
        const res = await apiRequest('POST', '/api/triage/chat', {
          message: content,
          step: "analyze_issue"
        });
        const data = await res.json();

        setTriageData(data.triage);
        setPropertyMatches(data.propertyMatches || []);

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          data: {
            triage: data.triage,
            properties: data.propertyMatches,
            tenantUnitInfo: data.tenantUnitInfo
          }
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        if (data.tenantUnitInfo) {
          setConversationState("tenant_confirming");
        } else {
          setConversationState("property_matching");
        }

      } else if (conversationState === "confirming" || conversationState === "tenant_confirming") {
        if (content.toLowerCase().includes("yes") || content.toLowerCase().includes("confirm")) {
          setConversationState("creating");
          const caseRes = await apiRequest('POST', '/api/tenant/cases', {
            title: triageData?.suggestedTitle || "Maintenance Request",
            description: issueDescription,
            priority: triageData?.urgency || "Normal",
            category: triageData?.category || "general",
            aiTriageJson: triageData,
            mediaUrls: uploadedMedia,
          });

          if (caseRes.ok) {
            const successMessage: Message = {
              id: (Date.now() + 2).toString(),
              role: "assistant",
              content: `✅ Your maintenance request has been submitted successfully${uploadedMedia.length > 0 ? ` with ${uploadedMedia.length} photo(s)` : ''}! Check "My Requests" below to track its progress.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, successMessage]);
            queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
            setTimeout(() => {
              setConversationState("initial");
              setUploadedMedia([]);
              setMessages([{
                id: "welcome",
                role: "assistant",
                content: "Hi! I'm Maya 👋 Tell me about your maintenance issue and I'll help you submit a request.",
                timestamp: new Date(),
              }]);
            }, 3000);
          }
        }
      }
    } catch (error) {
      console.error("Maya error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process your request. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePropertySelect = (property: PropertyMatch) => {
    setSelectedProperty(property);
    
    const confirmMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: `Perfect! I'll create a maintenance request for:\n\n📍 **${property.name}**${property.unitNumber ? `\n🏠 Unit ${property.unitNumber}` : ''}\n\n**Issue**: ${triageData?.category || 'Maintenance'}\n**Priority**: ${triageData?.urgency || 'Medium'}\n\nType "yes" to confirm and submit this request.`,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, confirmMessage]);
    setConversationState("confirming");
  };

  const handleTenantConfirm = async () => {
    setIsProcessing(true);
    try {
      const caseRes = await apiRequest('POST', '/api/tenant/cases', {
        title: triageData?.suggestedTitle || "Maintenance Request",
        description: issueDescription,
        priority: triageData?.urgency || "Normal",
        category: triageData?.category || "general",
        aiTriageJson: triageData,
        mediaUrls: uploadedMedia,
      });

      if (caseRes.ok) {
        const successMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: `✅ Your maintenance request has been submitted successfully${uploadedMedia.length > 0 ? ` with ${uploadedMedia.length} photo(s)` : ''}! Check "My Requests" below to track its progress.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, successMessage]);
        queryClient.invalidateQueries({ queryKey: ['/api/tenant/cases'] });
        setTimeout(() => {
          setConversationState("initial");
          setUploadedMedia([]);
          setMessages([{
            id: "welcome",
            role: "assistant",
            content: "Hi! I'm Maya 👋 Tell me about your maintenance issue and I'll help you submit a request.",
            timestamp: new Date(),
          }]);
        }, 3000);
      }
    } catch (error) {
      console.error("Create case error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create maintenance request. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'In Progress':
        return <Wrench className="h-5 w-5 text-orange-600" />;
      case 'Scheduled':
        return <Calendar className="h-5 w-5 text-purple-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getUserInitials = (u: UserType) => {
    return `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || u.email[0].toUpperCase();
  };

  const getJobsForDay = (day: Date) => {
    return myJobs.filter(job => {
      if (!job.scheduledStartAt) return false;
      const jobStart = toZonedTime(parseISO(job.scheduledStartAt), TIMEZONE);
      return isSameDay(jobStart, day);
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Simplified Header for Tenant */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Building className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">AllAI Property</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                <Bell className="h-5 w-5" />
                {upcomingAppointments.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {upcomingAppointments.length}
                  </span>
                )}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2" data-testid="button-user-menu">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                      {user?.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          {user?.firstName?.charAt(0) || user?.email?.charAt(0) || "U"}
                        </span>
                      )}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium">
                      {user?.firstName || user?.email?.split('@')[0] || "User"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setShowProfileModal(true)} data-testid="menu-edit-profile">
                    <User className="h-4 w-4 mr-2" />
                    Edit Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild data-testid="menu-sign-out">
                    <a href="/api/logout" className="flex items-center">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Welcome Section */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-tenant-dashboard-title">
                Welcome back{user?.firstName ? `, ${user.firstName}` : ''}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your maintenance requests and stay connected with your landlord
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("requests")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Requests</p>
                    <p className="text-2xl font-bold text-orange-600" data-testid="text-active-cases">{activeCases.length}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("calendar")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Upcoming Visits</p>
                    <p className="text-2xl font-bold text-purple-600" data-testid="text-upcoming-appointments">{upcomingAppointments.length}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("messages")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Messages</p>
                    <p className="text-2xl font-bold text-blue-600" data-testid="text-message-count">{messageThreads.length}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("requests")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-in-progress">
                      {inProgressCases.length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Maya AI Assistant */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle>Maya AI Assistant</CardTitle>
                  <CardDescription>Describe your maintenance issue - feel free to add photos to help clarify</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {messages.length > 1 && (
                <div ref={chatContainerRef} className="max-h-[300px] overflow-auto space-y-4 pb-4 border-b">
                  {messages.slice(1).map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <Avatar className="h-8 w-8 mt-1">
                          <AvatarFallback className="bg-primary/10">
                            <Bot className="h-4 w-4 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={`flex flex-col gap-2 max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        
                        {message.data?.tenantUnitInfo ? (
                          <div className="w-full mt-2">
                            <Button
                              variant="default"
                              className="w-full"
                              onClick={handleTenantConfirm}
                              disabled={isProcessing}
                              data-testid="button-confirm-tenant-unit"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Yes, that's correct
                            </Button>
                          </div>
                        ) : message.data?.properties && message.data.properties.length > 0 ? (
                          <div className="w-full space-y-2 mt-2">
                            {message.data.properties.map((property: PropertyMatch) => (
                              <Button
                                key={property.id}
                                variant="outline"
                                className="w-full justify-start text-left h-auto py-3"
                                onClick={() => handlePropertySelect(property)}
                                disabled={isProcessing}
                              >
                                <div className="flex items-start gap-3 w-full">
                                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    {property.unitNumber ? (
                                      <Home className="h-5 w-5 text-primary" />
                                    ) : (
                                      <Building className="h-5 w-5 text-primary" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm">
                                      {property.name}
                                      {property.unitNumber && <span className="ml-2 text-muted-foreground">Unit {property.unitNumber}</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">{property.matchReason}</div>
                                  </div>
                                </div>
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  
                  {isProcessing && (
                    <div className="flex gap-3" data-testid="indicator-processing">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10">
                          <Bot className="h-4 w-4 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}

              <div className="space-y-2">
                {uploadedMedia.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    📎 {uploadedMedia.length} photo{uploadedMedia.length > 1 ? 's' : ''} attached
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Describe your maintenance issue..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMayaMessage(inputValue);
                      }
                    }}
                    disabled={isProcessing}
                    className="flex-1"
                    data-testid="input-maya-message"
                  />
                  <ObjectUploader
                    maxNumberOfFiles={5}
                    maxFileSize={10485760}
                    allowedFileTypes={['image/*', 'video/*']}
                    note="Upload photos (optional)"
                    onGetUploadParameters={async () => {
                      const res = await apiRequest('POST', '/api/object-storage/url', {});
                      const data = await res.json();
                      return {
                        method: "PUT" as const,
                        url: data.url,
                      };
                    }}
                    onComplete={(result) => {
                      const urls = result.successful.map((file: any) => file.uploadURL.split('?')[0]);
                      setUploadedMedia(prev => [...prev, ...urls]);
                      toast({
                        title: "Photos uploaded",
                        description: `${urls.length} photo(s) attached`,
                      });
                    }}
                    buttonClassName="shrink-0"
                  >
                    <Camera className="h-4 w-4" />
                  </ObjectUploader>
                  <Button
                    onClick={() => sendMayaMessage(inputValue)}
                    disabled={isProcessing || !inputValue.trim()}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabbed Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="requests" data-testid="tab-requests">My Requests</TabsTrigger>
              <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
              <TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Requests */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Requests</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab("requests")}>
                      View All
                    </Button>
                  </CardHeader>
                  <CardContent className="max-h-[300px] overflow-y-auto">
                    {casesLoading ? (
                      <div className="py-8 text-center text-muted-foreground">Loading...</div>
                    ) : myCases.length === 0 ? (
                      <div className="py-8 text-center">
                        <Wrench className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No maintenance requests yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Use Maya above to submit your first request</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {myCases.slice(0, 5).map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedCase(c);
                              setActiveTab("requests");
                            }}
                            data-testid={`case-preview-${c.id}`}
                          >
                            {getStatusIcon(c.status)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{c.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(c.createdAt), 'MMM d, yyyy')}
                              </p>
                            </div>
                            <Badge variant="outline" className={STATUS_COLORS[c.status] || ''}>
                              {c.status === "In Review" ? "Reviewing" : c.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Upcoming Reminders */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Reminders</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[300px] overflow-y-auto">
                    {upcomingReminders.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No upcoming reminders</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {upcomingReminders.map((reminder) => (
                          <div
                            key={reminder.id}
                            className="flex items-center gap-3 p-3 rounded-lg border"
                            data-testid={`reminder-${reminder.id}`}
                          >
                            <Clock className="h-5 w-5 text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{reminder.title}</p>
                              {reminder.dueAt && (
                                <p className="text-xs text-muted-foreground">
                                  Due: {format(new Date(reminder.dueAt), 'MMM d, yyyy')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Messages Preview */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Recent Messages</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("messages")}>
                    View All
                  </Button>
                </CardHeader>
                <CardContent className="max-h-[300px] overflow-y-auto">
                  {messageThreads.length === 0 ? (
                    <div className="py-8 text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No messages yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Start a conversation with your landlord</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messageThreads.slice(0, 5).map((thread) => (
                        <div
                          key={thread.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => setActiveTab("messages")}
                          data-testid={`thread-preview-${thread.id}`}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              <MessageSquare className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{thread.subject || 'Conversation'}</p>
                            {thread.lastMessageAt && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(thread.lastMessageAt), 'MMM d, h:mm a')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Requests Tab */}
            <TabsContent value="requests" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>My Maintenance Requests</CardTitle>
                  <CardDescription>Track the status of all your submitted requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {casesLoading ? (
                    <div className="py-12 text-center text-muted-foreground">Loading requests...</div>
                  ) : myCases.length === 0 ? (
                    <div className="py-12 text-center">
                      <Wrench className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg text-muted-foreground">No maintenance requests yet</p>
                      <p className="text-sm text-muted-foreground mt-2">Use Maya above to submit your first request</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myCases.map((c) => (
                        <Card key={c.id} className="border" data-testid={`case-card-${c.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              {getStatusIcon(c.status)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold">{c.title}</h4>
                                  <Badge variant="outline" className={STATUS_COLORS[c.status] || ''}>
                                    {c.status === "In Review" ? "Reviewing" : c.status}
                                  </Badge>
                                  <Badge variant="outline" className={PRIORITY_COLORS[c.priority] || ''}>
                                    {c.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>Case #{c.caseNumber}</span>
                                  <span>Submitted: {format(new Date(c.createdAt), 'MMM d, yyyy')}</span>
                                  {c.buildingName && <span>📍 {c.buildingName}</span>}
                                </div>

                                {c.media && c.media.length > 0 && (
                                  <div className="mt-2">
                                    <MayaPhotoAnalysis
                                      media={c.media}
                                      photoAnalysis={c.aiTriageJson?.photoAnalysis}
                                      mode="tenant"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Calendar Tab */}
            <TabsContent value="calendar" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Scheduled Visits</CardTitle>
                      <CardDescription>View your upcoming maintenance appointments</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(prev => addDays(prev, -7))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium min-w-[140px] text-center">
                        {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                      </span>
                      <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(prev => addDays(prev, 7))}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day) => {
                      const dayJobs = getJobsForDay(day);
                      const dayIsToday = isToday(day);
                      
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "min-h-[120px] p-2 rounded-lg border",
                            dayIsToday && "bg-primary/5 border-primary"
                          )}
                        >
                          <div className={cn(
                            "text-sm font-medium mb-2",
                            dayIsToday && "text-primary"
                          )}>
                            <div>{format(day, 'EEE')}</div>
                            <div className="text-lg">{format(day, 'd')}</div>
                          </div>
                          
                          <div className="space-y-1">
                            {dayJobs.map((job) => {
                              const linkedCase = myCases.find(c => c.id === job.caseId);
                              return (
                                <div
                                  key={job.id}
                                  className="text-xs p-1.5 rounded bg-purple-100 text-purple-800 truncate"
                                  title={job.title}
                                  data-testid={`calendar-job-${job.id}`}
                                >
                                  {job.scheduledStartAt && (
                                    <span className="font-medium">
                                      {formatInTimeZone(parseISO(job.scheduledStartAt), TIMEZONE, 'h:mm a')}
                                    </span>
                                  )}
                                  <div className="truncate">{linkedCase?.title || job.title}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {myJobs.length === 0 && (
                    <div className="py-8 text-center mt-4">
                      <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No scheduled visits</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Messages</CardTitle>
                      <CardDescription>Communicate with your landlord</CardDescription>
                    </div>
                    {contacts.length > 0 && (
                      <Button size="sm" data-testid="button-new-message">
                        <Plus className="h-4 w-4 mr-2" />
                        New Message
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {messageThreads.length === 0 ? (
                    <div className="py-12 text-center">
                      <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg text-muted-foreground">No messages yet</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {contacts.length > 0 
                          ? "Start a conversation with your landlord"
                          : "Your landlord contact information is not available yet"
                        }
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {messageThreads.map((thread) => (
                          <div
                            key={thread.id}
                            className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                            data-testid={`message-thread-${thread.id}`}
                          >
                            <Avatar className="h-12 w-12">
                              <AvatarFallback>
                                <MessageSquare className="h-6 w-6" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{thread.subject || 'Direct Message'}</p>
                              {thread.lastMessageAt && (
                                <p className="text-sm text-muted-foreground">
                                  Last message: {format(new Date(thread.lastMessageAt), 'MMM d, h:mm a')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Profile Edit Modal */}
      <ProfileDialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <ProfileDialogContent className="max-w-md">
          <ProfileDialogHeader>
            <ProfileDialogTitle>Edit Profile</ProfileDialogTitle>
          </ProfileDialogHeader>
          {user && (
            <UserProfileForm
              user={user}
              onSuccess={() => setShowProfileModal(false)}
              onCancel={() => setShowProfileModal(false)}
            />
          )}
        </ProfileDialogContent>
      </ProfileDialog>

      {user?.id && (
        <LiveNotification
          userRole="tenant"
          userId={user.id}
        />
      )}
    </div>
  );
}
