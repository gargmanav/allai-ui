import { useState, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, Users, Calendar, Mail, Phone, Edit2, Trash2, UserPlus, Search, X,
  LayoutGrid, List, Send, Bot, Loader2, ChevronRight, Clock, Briefcase,
  TrendingUp, AlertTriangle, Star, User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TeamCalendar } from "./team-calendar";

interface TeamMember {
  id: string;
  memberId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  color: string;
  hasLogin: boolean;
}

interface TeamAppointment {
  id: string;
  title?: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status?: string;
  contractorId: string;
  address?: string;
  customerName?: string;
}

interface MayaChatMessage {
  role: "user" | "maya";
  content: string;
  timestamp: Date;
}

interface MayaRecommendation {
  type: "prioritize" | "followup" | "schedule" | "price";
  title: string;
  message: string;
  memberId?: string;
}

interface TeamViewProps {
  user: any;
  teamData: { allMembers: TeamMember[] } | undefined;
  teamAppointments: TeamAppointment[];
  activeJobs: any[];
}

const getInitials = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
};

const MUTED_COLORS = ['#64748B', '#78716C', '#6B7280', '#71717A', '#737373', '#64748B', '#6B7280', '#78716C'];

export function TeamView({ user, teamData, teamAppointments, activeJobs }: TeamViewProps) {
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [mayaChatOpen, setMayaChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<MayaChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isMayaTyping, setIsMayaTyping] = useState(false);
  const [activeTab, setActiveTab] = useState("members");
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const ownerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'You';

  const allMembers = useMemo(() => {
    const owner = {
      id: user?.id || 'owner',
      memberId: user?.id || 'owner',
      name: ownerName,
      email: user?.email || '',
      phone: '',
      role: 'Owner',
      color: MUTED_COLORS[0],
      hasLogin: true,
      isOwner: true,
    };
    const members = (teamData?.allMembers || []).map((m, i) => ({
      ...m,
      color: MUTED_COLORS[(i + 1) % MUTED_COLORS.length],
      isOwner: false,
    }));
    return [owner, ...members];
  }, [teamData, user, ownerName]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return allMembers;
    const q = searchQuery.toLowerCase();
    return allMembers.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.role || '').toLowerCase().includes(q)
    );
  }, [allMembers, searchQuery]);

  const todaysAppointments = useMemo(() => {
    const today = new Date().toDateString();
    return teamAppointments.filter(a => new Date(a.scheduledStartAt).toDateString() === today);
  }, [teamAppointments]);

  const mayaRecommendations = useMemo<MayaRecommendation[]>(() => {
    const recommendations: MayaRecommendation[] = [];
    const memberCount = allMembers.length;

    if (todaysAppointments.length > 0) {
      recommendations.push({
        type: "schedule",
        title: "Today's Workload",
        message: `${todaysAppointments.length} appointment${todaysAppointments.length > 1 ? 's' : ''} scheduled today across your team of ${memberCount}. ${todaysAppointments.length > memberCount ? 'Some team members may have multiple jobs — check scheduling.' : 'Workload looks balanced.'}`,
      });
    }

    if (activeJobs.length > 0 && memberCount > 1) {
      const avgJobsPerMember = (activeJobs.length / memberCount).toFixed(1);
      recommendations.push({
        type: "prioritize",
        title: "Team Capacity",
        message: `${activeJobs.length} active jobs across ${memberCount} team members (~${avgJobsPerMember} per person). ${parseFloat(avgJobsPerMember) > 3 ? 'Consider adding team members to handle the workload.' : 'Your team capacity looks healthy.'}`,
      });
    }

    const membersWithoutLogin = (teamData?.allMembers || []).filter(m => !m.hasLogin);
    if (membersWithoutLogin.length > 0) {
      recommendations.push({
        type: "followup",
        title: "Access Setup",
        message: `${membersWithoutLogin.length} team member${membersWithoutLogin.length > 1 ? 's don\'t' : ' doesn\'t'} have login access yet. Set them up so they can view their assignments and update job status.`,
        memberId: membersWithoutLogin[0]?.id,
      });
    }

    if (memberCount <= 1) {
      recommendations.push({
        type: "price",
        title: "Growing Your Team",
        message: `You're operating solo. Adding team members lets you take on more jobs, delegate tasks, and grow your business. Consider adding a technician or apprentice.`,
      });
    }

    return recommendations.slice(0, 3);
  }, [allMembers, todaysAppointments, activeJobs, teamData]);

  const generateMayaResponse = (question: string): string => {
    const q = question.toLowerCase();
    const memberCount = allMembers.length;

    if (q.includes("workload") || q.includes("busy") || q.includes("capacity")) {
      return `Your team of ${memberCount} has ${activeJobs.length} active jobs and ${todaysAppointments.length} appointments today. ${activeJobs.length > memberCount * 3 ? 'Workload is high — consider redistributing or bringing on help.' : 'Workload looks manageable.'}`;
    }

    if (q.includes("rating") || q.includes("review") || q.includes("performance") || q.includes("quality")) {
      return `Customer ratings for team members aren't tracked yet, but this feature is coming soon! In the meantime, you can gauge performance by tracking completion times and customer feedback on individual jobs.`;
    }

    if (q.includes("completion") || q.includes("time") || q.includes("speed") || q.includes("fast") || q.includes("slow")) {
      if (todaysAppointments.length > 0) {
        return `Your team has ${todaysAppointments.length} appointments scheduled today. Track completion by monitoring job status changes. Average completion tracking will be available soon to help identify your fastest team members.`;
      }
      return `No appointments today to measure. As your team completes more jobs, I'll be able to provide completion time analytics and identify top performers.`;
    }

    if (q.includes("schedule") || q.includes("today") || q.includes("appointment")) {
      return `${todaysAppointments.length} appointment${todaysAppointments.length !== 1 ? 's' : ''} scheduled for today. Switch to the Calendar tab to see the full team schedule and manage assignments.`;
    }

    if (q.includes("add") || q.includes("hire") || q.includes("new member") || q.includes("grow")) {
      return `To add a team member, click the "Add Team Member" button. Once added, they can be assigned to jobs and their schedule will appear on the team calendar. Consider their specialties when assigning work.`;
    }

    if (q.includes("login") || q.includes("access") || q.includes("permission")) {
      const noLogin = (teamData?.allMembers || []).filter(m => !m.hasLogin).length;
      return noLogin > 0
        ? `${noLogin} team member${noLogin > 1 ? 's' : ''} still need login access. Having them log in lets them view assignments, update job status, and communicate with customers directly.`
        : `All your team members have login access. They can view their assignments and update job progress.`;
    }

    return `Your team has ${memberCount} member${memberCount !== 1 ? 's' : ''}, ${activeJobs.length} active jobs, and ${todaysAppointments.length} appointments today. Ask me about workload, schedules, completion times, or team growth!`;
  };

  const handleMayaChat = async () => {
    if (!chatInput.trim()) return;
    const question = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", content: question, timestamp: new Date() }]);
    setChatInput("");
    setIsMayaTyping(true);
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: "maya", content: generateMayaResponse(question), timestamp: new Date() }]);
      setIsMayaTyping(false);
    }, 1200);
  };

  const MayaSidebar = () => (
    <>
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md">
          <Sparkles className="h-4 w-4 text-white maya-sparkle-spin" />
        </div>
        <div>
          <h3 className="font-medium text-gray-800 text-sm">Maya AI Advisor</h3>
          <p className="text-[10px] text-muted-foreground">Team insights</p>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Insights</h4>
          {mayaRecommendations.length > 0 ? (
            mayaRecommendations.map((rec, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-white border border-violet-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => { if (rec.memberId) { setSelectedMemberId(rec.memberId); setMayaChatOpen(false); } }}>
                <div className="flex items-center gap-2 mb-1">
                  {rec.type === "prioritize" && <TrendingUp className="h-4 w-4 text-slate-600" />}
                  {rec.type === "followup" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  {rec.type === "schedule" && <Calendar className="h-4 w-4 text-blue-500" />}
                  {rec.type === "price" && <Users className="h-4 w-4 text-slate-500" />}
                  <span className="text-sm font-medium text-gray-800">{rec.title}</span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{rec.message}</p>
                {rec.memberId && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-violet-600">
                    <span>View</span><ChevronRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">Add team members to get insights.</p>
          )}

          <div className="h-px bg-violet-100 my-4" />
          <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Quick Stats</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
              <p className="text-lg font-bold text-slate-700">{allMembers.length}</p>
              <p className="text-[10px] text-slate-500">Team Size</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
              <p className="text-lg font-bold text-slate-700">{todaysAppointments.length}</p>
              <p className="text-[10px] text-slate-500">Today's Jobs</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
              <p className="text-lg font-bold text-slate-700">{activeJobs.length}</p>
              <p className="text-[10px] text-slate-500">Active Jobs</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="h-3 w-3 text-amber-400" />
                <p className="text-lg font-bold text-slate-700">—</p>
              </div>
              <p className="text-[10px] text-slate-500">Avg Rating</p>
            </div>
          </div>

          {chatMessages.length > 0 && (
            <>
              <div className="h-px bg-violet-100 my-4" />
              <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Conversation</h4>
              <div className="space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`p-3 rounded-lg text-sm ${msg.role === "user" ? "bg-gray-100 ml-4" : "bg-violet-50 border border-violet-100"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === "maya" ? <Bot className="h-3 w-3 text-violet-500" /> : <User className="h-3 w-3 text-gray-500" />}
                      <span className="text-xs text-muted-foreground">{msg.role === "maya" ? "Maya" : "You"}</span>
                    </div>
                    <p className="text-gray-700">{msg.content}</p>
                  </div>
                ))}
                {isMayaTyping && (
                  <div className="flex items-center gap-2 text-sm text-violet-500 p-3">
                    <Loader2 className="h-4 w-4 animate-spin" /><span>Maya is thinking...</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input ref={chatInputRef} placeholder="Ask about your team..." value={chatInput}
            onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleMayaChat()}
            className="flex-1 h-10 text-sm" />
          <Button size="icon" className="h-10 w-10 bg-violet-500 hover:bg-violet-600"
            onClick={handleMayaChat} disabled={!chatInput.trim() || isMayaTyping}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between shrink-0"
        style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)", backdropFilter: "blur(24px) saturate(180%)" }}>
        <div>
          <h2 className="font-semibold text-lg sm:text-xl">Team</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage your team members and view schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <Sheet open={mayaChatOpen} onOpenChange={setMayaChatOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden h-9 gap-2 touch-manipulation">
                <Sparkles className="h-4 w-4 text-violet-500" /><span className="hidden sm:inline">Maya</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] p-0">
              <SheetHeader className="p-4 border-b bg-gradient-to-r from-violet-100/80 to-purple-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white maya-sparkle-spin" />
                  </div>
                  <SheetTitle>Maya AI Advisor</SheetTitle>
                </div>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-180px)] p-4">
                <div className="space-y-3">
                  {mayaRecommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-white border border-violet-100"
                      onClick={() => { if (rec.memberId) { setSelectedMemberId(rec.memberId); setMayaChatOpen(false); } }}>
                      <div className="flex items-center gap-2 mb-1">
                        {rec.type === "prioritize" && <TrendingUp className="h-4 w-4 text-slate-600" />}
                        {rec.type === "followup" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        {rec.type === "schedule" && <Calendar className="h-4 w-4 text-blue-500" />}
                        {rec.type === "price" && <Users className="h-4 w-4 text-slate-500" />}
                        <span className="text-sm font-medium">{rec.title}</span>
                      </div>
                      <p className="text-xs text-gray-600">{rec.message}</p>
                    </div>
                  ))}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`p-3 rounded-lg text-sm ${msg.role === "user" ? "bg-gray-100 ml-4" : "bg-violet-50"}`}>
                      <p>{msg.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
                <div className="flex gap-2">
                  <Input placeholder="Ask about your team..." value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMayaChat()} className="flex-1 h-10" />
                  <Button size="icon" className="h-10 w-10 bg-violet-500" onClick={handleMayaChat}><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-2 touch-manipulation">
                <UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Add Member</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label htmlFor="memberName">Name</Label><Input id="memberName" placeholder="Enter name" /></div>
                <div className="space-y-2"><Label htmlFor="memberEmail">Email</Label><Input id="memberEmail" type="email" placeholder="email@example.com" /></div>
                <div className="space-y-2"><Label htmlFor="memberPhone">Phone</Label><Input id="memberPhone" placeholder="(555) 123-4567" /></div>
                <div className="space-y-2"><Label htmlFor="memberRole">Role</Label><Input id="memberRole" placeholder="e.g. Technician, Apprentice" /></div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => toast({ title: "Coming Soon", description: "Team member management is being implemented" })}>Add Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="hidden lg:flex flex-col w-80 border-r bg-gradient-to-b from-violet-50/50 to-white shrink-0 overflow-hidden">
          <MayaSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="shrink-0 px-4 py-3 border-b bg-white">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center bg-muted rounded-md p-0.5">
                <button onClick={() => setActiveTab("members")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors touch-manipulation ${activeTab === "members" ? "bg-white shadow-sm" : "hover:bg-white/50"}`}>
                  <Users className="h-3.5 w-3.5 inline mr-1.5" />Members
                </button>
                <button onClick={() => setActiveTab("calendar")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors touch-manipulation ${activeTab === "calendar" ? "bg-white shadow-sm" : "hover:bg-white/50"}`}>
                  <Calendar className="h-3.5 w-3.5 inline mr-1.5" />Calendar
                </button>
              </div>

              {activeTab === "members" && (
                <>
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 w-32 text-xs border-slate-200 bg-slate-50 focus:bg-white focus:w-44 transition-all" />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded">
                          <X className="h-3 w-3 text-slate-400" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center bg-muted rounded-md p-0.5">
                      <button onClick={() => setViewMode("cards")}
                        className={`p-1.5 rounded transition-colors touch-manipulation ${viewMode === "cards" ? "bg-white shadow-sm" : "hover:bg-white/50"}`}
                        title="Card View"><LayoutGrid className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setViewMode("list")}
                        className={`p-1.5 rounded transition-colors touch-manipulation ${viewMode === "list" ? "bg-white shadow-sm" : "hover:bg-white/50"}`}
                        title="List View"><List className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {activeTab === "members" ? (
              viewMode === "cards" ? (
                <div className="p-4 sm:p-6">
                  <div className="flex items-start gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
                    {filteredMembers.map((member) => {
                      const isSelected = selectedMemberId === member.id;
                      return (
                        <button key={member.id} onClick={() => setSelectedMemberId(isSelected ? null : member.id)}
                          className="flex flex-col items-center min-w-[70px] sm:min-w-[90px] group touch-manipulation">
                          <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isSelected ? "ring-2 ring-violet-400 scale-105" : "hover:scale-105"
                          }`}
                            style={{
                              background: isSelected
                                ? "linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))"
                                : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                              boxShadow: isSelected ? "0 6px 20px rgba(139, 92, 246, 0.2)" : "0 4px 12px rgba(0,0,0,0.06)",
                            }}>
                            <span className={`text-sm font-bold ${isSelected ? 'text-violet-700' : 'text-slate-500'}`}>
                              {getInitials(member.name)}
                            </span>
                            {(member as any).isOwner && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-500 rounded-full flex items-center justify-center">
                                <Star className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <span className={`text-xs mt-2 font-medium truncate max-w-[65px] ${isSelected ? "text-violet-700" : "text-foreground"}`}>
                            {member.name.split(' ')[0]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{member.role || 'Team'}</span>
                        </button>
                      );
                    })}
                    {filteredMembers.length === 0 && (
                      <div className="text-sm text-muted-foreground px-4">No members found</div>
                    )}
                  </div>

                  {selectedMemberId && (() => {
                    const member = filteredMembers.find(m => m.id === selectedMemberId);
                    if (!member) return null;
                    const memberAppointments = teamAppointments.filter(a => a.contractorId === member.memberId);
                    return (
                      <Card className="mt-4 overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-white">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-slate-600 font-bold"
                              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))", boxShadow: "0 3px 10px rgba(0,0,0,0.08)" }}>
                              {getInitials(member.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{member.name}</h3>
                                <Badge className="bg-slate-100 text-slate-600">{member.role || 'Team Member'}</Badge>
                                {member.hasLogin && <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px]">Has Login</Badge>}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedMemberId(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {member.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /><span>{member.email}</span></div>}
                            {member.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" /><span>{member.phone}</span></div>}
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{memberAppointments.length} scheduled appointment{memberAppointments.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Star className="h-3 w-3 text-amber-400" />
                              <span className="text-muted-foreground">Rating: Coming soon</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {!selectedMemberId && filteredMembers.length > 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Select a team member to view details</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2 sm:p-4">
                  <div className="rounded-lg border bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-medium">Member</th>
                          <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Role</th>
                          <th className="text-center px-3 py-2.5 font-medium">Status</th>
                          <th className="text-center px-3 py-2.5 font-medium hidden md:table-cell">Rating</th>
                          <th className="text-right px-3 py-2.5 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMembers.map(member => (
                          <tr key={member.id}
                            className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${selectedMemberId === member.id ? "bg-violet-50" : ""}`}
                            onClick={() => setSelectedMemberId(selectedMemberId === member.id ? null : member.id)}>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 text-xs font-bold shrink-0 bg-slate-100">
                                  {getInitials(member.name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{member.name}</p>
                                  {member.email && <p className="text-xs text-muted-foreground truncate">{member.email}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell">
                              <span className="text-muted-foreground">{member.role || '—'}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              {member.hasLogin ? (
                                <Badge className="bg-slate-100 text-slate-600 text-[10px]">Active</Badge>
                              ) : (
                                <Badge className="bg-amber-50 text-amber-600 text-[10px]">No Login</Badge>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center hidden md:table-cell">
                              <div className="flex items-center justify-center gap-1">
                                <Star className="h-3 w-3 text-amber-400" />
                                <span className="text-xs text-muted-foreground">—</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-50 touch-manipulation"
                                  onClick={(e) => { e.stopPropagation(); toast({ title: "Edit Member", description: "Editing coming soon" }); }}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                {!(member as any).isOwner && (
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 touch-manipulation"
                                    onClick={(e) => { e.stopPropagation(); toast({ title: "Remove Member", description: "Removal coming soon" }); }}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredMembers.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" /><p>No team members found</p>
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : (
              <div className="p-4">
                <TeamCalendar
                  teamMembers={[
                    { id: user?.id || '', name: ownerName, role: 'Lead', color: MUTED_COLORS[0] },
                    ...(teamData?.allMembers || []).map((m, i) => ({
                      id: m.memberId, name: m.name, role: m.role || undefined, color: MUTED_COLORS[(i + 1) % MUTED_COLORS.length],
                    }))
                  ]}
                  appointments={teamAppointments}
                  onAppointmentClick={(apt) => {
                    toast({ title: apt.title || 'Appointment', description: apt.customerName || apt.address || '' });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
