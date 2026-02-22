import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, CheckCircle, Calendar, DollarSign, Clock, ArrowRight, Send, MapPin, User, Phone, FileText, Search, X, LayoutGrid, List, MessageCircle, ChevronRight, Bot, Loader2, AlertTriangle, FileEdit, Plus, Trash2, Save, Archive, Home, Map } from "lucide-react";
import { ThreadChat } from "./thread-chat";
import { MayaPhotoAnalysis, PhotoAnalysisButton } from "./maya-photo-analysis";
import { JobMapView } from "./job-map-view";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InlineQuoteDetail } from "./inline-quote-detail";

interface AiTriageData {
  urgency?: string;
  rootCause?: string;
  estimatedCost?: string;
  estimatedTime?: string;
  suggestedActions?: string[];
  safetyNotes?: string;
  photoAnalysis?: {
    tenant?: { summary: string; advice: string; safetyLevel?: string };
    contractor?: { summary: string; technicalNotes: string; materialsNeeded?: string[]; codeCompliance?: string };
  };
}

interface CaseMediaItem {
  id: string;
  url: string;
  type?: string;
  caption?: string;
}

interface Item {
  id: string;
  title: string;
  customerName: string;
  customerInitials: string;
  description?: string;
  status: string;
  priority?: string;
  estimatedValue?: number;
  scheduledDate?: string;
  address?: string;
  phone?: string;
  category?: string;
  createdAt?: string;
  color: { bg: string; text: string };
  photoUrl?: string | null;
  city?: string | null;
  isExistingCustomer?: boolean;
  latitude?: string | number | null;
  longitude?: string | number | null;
  lineItems?: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  expiresAt?: string;
  reporterUserId?: string;
  orgId?: string;
  aiTriageJson?: AiTriageData | null;
  media?: CaseMediaItem[];
  caseId?: string;
  customerId?: string;
  clientMessage?: string;
  internalNotes?: string;
  discountAmount?: number;
  taxPercent?: number;
  depositType?: string;
  depositValue?: number;
  filterGroup?: string;
  caseStatus?: string;
  caseScheduledStartAt?: string;
  availableStartDate?: string;
  availableEndDate?: string;
  estimatedDays?: number;
}

interface MayaRecommendation {
  type: "prioritize" | "schedule" | "price" | "followup";
  title: string;
  message: string;
  itemId?: string;
}


interface MayaChatMessage {
  role: "user" | "maya";
  content: string;
  timestamp: Date;
}

interface QuoteLineItemLocal {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  displayOrder: number;
}

interface MayaCarouselLayoutProps {
  title: string;
  subtitle: string;
  items: Item[];
  filterTabs?: { id: string; label: string; count: number; secondary?: boolean; groupedWith?: string[] }[];
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  onItemSelect: (item: Item) => void;
  onAccept?: (item: Item) => void;
  onDecline?: (item: Item) => void;
  onSendQuote?: (item: Item) => void;
  onSchedule?: (item: Item) => void;
  onConfirmJob?: (item: Item, data: { confirmedStartDate: string; estimatedDays?: number; notes?: string }) => void;
  onStartJob?: (item: Item) => void;
  onCompleteJob?: (item: Item, data: { completionNotes?: string }) => void;
  acceptLabel?: string;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  itemType: "request" | "quote" | "job";
  showCategoryFilter?: boolean;
  showPriorityFilter?: boolean;
  showSearch?: boolean;
  showSort?: boolean;
  categories?: string[];
  lifecycleBar?: React.ReactNode;
}

export function MayaCarouselLayout({
  title,
  subtitle,
  items,
  filterTabs,
  activeFilter: initialActiveFilter,
  onFilterChange,
  onItemSelect,
  onAccept,
  onDecline,
  onSendQuote,
  onSchedule,
  onConfirmJob,
  onStartJob,
  onCompleteJob,
  acceptLabel = "Accept",
  emptyIcon,
  emptyMessage = "No items found",
  itemType,
  showCategoryFilter = false,
  showPriorityFilter = false,
  showSearch = false,
  showSort = false,
  categories = [],
  lifecycleBar,
}: MayaCarouselLayoutProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [internalFilter, setInternalFilter] = useState<string>(initialActiveFilter || "all");

  useEffect(() => {
    if (initialActiveFilter && initialActiveFilter !== internalFilter) {
      setInternalFilter(initialActiveFilter);
    }
  }, [initialActiveFilter]);

  const unreadQuery = useQuery<any[]>({
    queryKey: ["/api/messaging/conversations"],
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const unreadByCaseId = useMemo(() => {
    const map: Record<string, number> = {};
    if (unreadQuery.data && Array.isArray(unreadQuery.data)) {
      for (const conv of unreadQuery.data) {
        if (conv.caseId && conv.unreadCount > 0) {
          map[conv.caseId] = (map[conv.caseId] || 0) + conv.unreadCount;
        }
      }
    }
    return map;
  }, [unreadQuery.data]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [readStatusFilter, setReadStatusFilter] = useState<string>("new");
  const [viewMode, setViewMode] = useState<"cards" | "list" | "map">("cards");
  const [mayaChatOpen, setMayaChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<MayaChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isMayaTyping, setIsMayaTyping] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [confirmJobOpen, setConfirmJobOpen] = useState(false);
  const [confirmStartDate, setConfirmStartDate] = useState("");
  const [confirmEstDays, setConfirmEstDays] = useState("");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [jobActionLoading, setJobActionLoading] = useState(false);
  
  const activeFilter = internalFilter;
  
  useEffect(() => {
    setConfirmJobOpen(false);
    setConfirmStartDate("");
    setConfirmEstDays("");
    setConfirmNotes("");
    setCompletionNotes("");
  }, [selectedItemId]);

  const handleFilterChange = (filterId: string) => {
    setInternalFilter(filterId);
    setSelectedItemId(null);
    onFilterChange?.(filterId);
  };
  
  const defaultFilter = initialActiveFilter || "all";
  const clearAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setReadStatusFilter("new");
    setInternalFilter(defaultFilter);
    setSelectedItemId(null);
    onFilterChange?.(defaultFilter);
  };
  
  const isLifecycleActive = activeFilter !== "all" && activeFilter !== "none" && activeFilter !== defaultFilter;
  const hasActiveFilters = searchQuery || categoryFilter !== "all" || priorityFilter !== "all" || (!isLifecycleActive && readStatusFilter !== "new") || isLifecycleActive;
  
  const filteredItems = useMemo(() => {
    let result = [...items];
    
    if (activeFilter !== "all" && activeFilter !== "none") {
      if (activeFilter === "sent") {
        result = result.filter(item => item.status.toLowerCase() === "sent" || item.status.toLowerCase() === "awaiting_response");
      } else if (activeFilter === "completed") {
        result = result.filter(item => {
          const s = item.status.toLowerCase();
          return s === "completed" || s === "resolved";
        });
      } else {
        result = result.filter(item => {
          const group = item.filterGroup || item.status.toLowerCase();
          return group === activeFilter.toLowerCase();
        });
      }
    }
    
    const isLifecycleFiltered = activeFilter !== "all" && activeFilter !== "none";
    if (!isLifecycleFiltered && readStatusFilter === "new") {
      result = result.filter(item => {
        const s = item.status.toLowerCase();
        return s === "new" || s === "pending" || s === "open";
      });
    } else if (!isLifecycleFiltered && readStatusFilter === "read") {
      result = result.filter(item => {
        const s = item.status.toLowerCase();
        return s !== "new" && s !== "pending" && s !== "open";
      });
    }

    if (categoryFilter !== "all") {
      result = result.filter(item => item.category?.toLowerCase() === categoryFilter.toLowerCase());
    }
    
    if (priorityFilter !== "all") {
      result = result.filter(item => item.priority?.toLowerCase() === priorityFilter.toLowerCase());
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.customerName.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        (item.estimatedValue && item.estimatedValue.toString().includes(query)) ||
        (item.total && item.total.toString().includes(query))
      );
    }
    
    result.sort((a, b) => {
      switch (sortBy) {
        case "newest": return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "oldest": return (a.createdAt || "").localeCompare(b.createdAt || "");
        case "highest": return (b.estimatedValue || 0) - (a.estimatedValue || 0);
        case "lowest": return (a.estimatedValue || 0) - (b.estimatedValue || 0);
        case "priority": {
          const priorityOrder: Record<string, number> = { "Urgent": 0, "High": 1, "Normal": 2, "Low": 3 };
          return (priorityOrder[a.priority || "Normal"] || 2) - (priorityOrder[b.priority || "Normal"] || 2);
        }
        case "expiry": {
          const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
          const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
          return aExp - bExp;
        }
        case "customer": return (a.customerName || "").localeCompare(b.customerName || "");
        case "status": {
          const statusOrder: Record<string, number> = { "In Progress": 0, "Scheduled": 1, "Confirmed": 2, "New": 3, "Pending": 4, "Completed": 5 };
          return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
        }
        default: return 0;
      }
    });
    
    return result;
  }, [items, activeFilter, categoryFilter, priorityFilter, readStatusFilter, searchQuery, sortBy]);
  
  const derivedCategories = useMemo(() => {
    if (categories.length > 0) return categories;
    const cats = new Set<string>();
    items.forEach(item => { if (item.category) cats.add(item.category); });
    return Array.from(cats);
  }, [items, categories]);

  const selectedItem = useMemo(() => 
    filteredItems.find(item => item.id === selectedItemId), 
    [filteredItems, selectedItemId]
  );

  const mayaRecommendations = useMemo<MayaRecommendation[]>(() => {
    if (items.length === 0) return [];
    
    const recommendations: MayaRecommendation[] = [];
    
    if (itemType === "quote") {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const expiringSoon = items.filter(item => {
        if (!item.expiresAt || item.status === "Approved" || item.status === "Declined" || item.status === "Expired") return false;
        const exp = new Date(item.expiresAt);
        return exp <= weekFromNow && exp >= now;
      });
      if (expiringSoon.length > 0) {
        const soonest = expiringSoon.sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())[0];
        recommendations.push({
          type: "followup",
          title: "Expiring Soon",
          message: `${expiringSoon.length} quote${expiringSoon.length > 1 ? 's expire' : ' expires'} within 7 days. "${soonest.title}" expires first — consider following up with ${soonest.customerName}.`,
          itemId: soonest.id,
        });
      }

      const sentQuotes = items.filter(item => item.status === "Sent" || item.status === "Awaiting_response");
      const oldSent = sentQuotes.filter(item => {
        if (!item.createdAt) return false;
        const created = new Date(item.createdAt);
        const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince >= 3;
      });
      if (oldSent.length > 0) {
        recommendations.push({
          type: "followup",
          title: "Follow Up Needed",
          message: `${oldSent.length} sent quote${oldSent.length > 1 ? 's have' : ' has'} had no response for 3+ days. A quick follow-up can increase your approval rate.`,
          itemId: oldSent[0]?.id,
        });
      }

      const drafts = items.filter(item => item.status === "Draft");
      if (drafts.length > 0) {
        const highestDraft = drafts.reduce((max, d) => (d.estimatedValue || 0) > (max.estimatedValue || 0) ? d : max, drafts[0]);
        recommendations.push({
          type: "price",
          title: "Drafts Ready to Send",
          message: `You have ${drafts.length} draft quote${drafts.length > 1 ? 's' : ''} worth $${drafts.reduce((s, d) => s + (d.estimatedValue || 0), 0).toLocaleString()}. "${highestDraft.title}" ($${(highestDraft.estimatedValue || 0).toLocaleString()}) is your highest — ready to send?`,
          itemId: highestDraft.id,
        });
      }

      const approved = items.filter(item => item.status === "Approved");
      if (approved.length > 0) {
        const totalApproved = approved.reduce((s, a) => s + (a.estimatedValue || 0), 0);
        recommendations.push({
          type: "prioritize",
          title: "Revenue Ready",
          message: `${approved.length} approved quote${approved.length > 1 ? 's' : ''} worth $${totalApproved.toLocaleString()} — time to schedule the work and start earning.`,
        });
      }
    } else if (itemType === "job") {
      const inProgress = items.filter(item => item.status === "In Progress");
      const scheduled = items.filter(item => item.status === "Scheduled" || item.status === "Confirmed");
      const overdue = items.filter(item => {
        if (!item.scheduledDate || item.status === "Completed") return false;
        return new Date(item.scheduledDate) < new Date();
      });

      if (overdue.length > 0) {
        recommendations.push({
          type: "followup",
          title: "Overdue Jobs",
          message: `${overdue.length} job${overdue.length > 1 ? 's are' : ' is'} past the scheduled date. Review and update these to keep customers informed.`,
          itemId: overdue[0]?.id,
        });
      }

      const highestValue = items.reduce((max, item) =>
        (item.estimatedValue || 0) > (max.estimatedValue || 0) ? item : max, items[0]);
      if (highestValue && (highestValue.estimatedValue || 0) > 0) {
        recommendations.push({
          type: "prioritize",
          title: "Highest Value",
          message: `"${highestValue.title}" is worth $${highestValue.estimatedValue?.toLocaleString()}. Prioritize completion to maximize revenue.`,
          itemId: highestValue.id,
        });
      }

      if (inProgress.length > 0) {
        const totalValue = inProgress.reduce((s, j) => s + (j.estimatedValue || 0), 0);
        recommendations.push({
          type: "price",
          title: "Active Pipeline",
          message: `${inProgress.length} job${inProgress.length > 1 ? 's' : ''} in progress worth $${totalValue.toLocaleString()}. Complete these to invoice and collect payment.`,
        });
      }

      if (scheduled.length > 0) {
        recommendations.push({
          type: "schedule",
          title: "Coming Up",
          message: `${scheduled.length} job${scheduled.length > 1 ? 's' : ''} scheduled. Review your timeline to make sure you're prepared.`,
        });
      }
    } else {
      const highestValue = items.reduce((max, item) => 
        (item.estimatedValue || 0) > (max.estimatedValue || 0) ? item : max, items[0]);
      
      if (highestValue && (highestValue.estimatedValue || 0) > 0) {
        recommendations.push({
          type: "prioritize",
          title: "Highest Value",
          message: `"${highestValue.title}" has the highest potential value at $${highestValue.estimatedValue?.toLocaleString()}. Consider prioritizing this ${itemType}.`,
          itemId: highestValue.id,
        });
      }
      
      const urgentItems = items.filter(item => item.priority === "Urgent" || item.priority === "High");
      if (urgentItems.length > 0) {
        recommendations.push({
          type: "followup",
          title: "Urgent Attention",
          message: `You have ${urgentItems.length} urgent ${itemType}${urgentItems.length > 1 ? 's' : ''} that need immediate attention.`,
        });
      }
      
      const unscheduled = items.filter(item => !item.scheduledDate && item.status !== "Completed");
      if (unscheduled.length > 0) {
        recommendations.push({
          type: "schedule",
          title: "Schedule Suggestion",
          message: `${unscheduled.length} ${itemType}${unscheduled.length > 1 ? 's are' : ' is'} not yet scheduled. Would you like me to suggest optimal times?`,
        });
      }
    }
    
    const totalUnread = Object.values(unreadByCaseId).reduce((s, c) => s + c, 0);
    const unreadCaseCount = Object.keys(unreadByCaseId).length;
    if (totalUnread > 0) {
      recommendations.unshift({
        type: "followup",
        title: "Messages Waiting",
        message: `${unreadCaseCount} homeowner${unreadCaseCount > 1 ? 's are' : ' is'} waiting for your reply (${totalUnread} unread message${totalUnread > 1 ? 's' : ''}). Quick responses improve your ratings.`,
      });
    }

    return recommendations.slice(0, 3);
  }, [items, itemType, unreadByCaseId]);

  const handleItemClick = (item: Item) => {
    setSelectedItemId(item.id);
    if (itemType !== "quote") {
      onItemSelect(item);
    }
  };

  const handleMayaChat = async () => {
    if (!chatInput.trim()) return;
    
    const question = chatInput.trim();
    
    const userMessage: MayaChatMessage = {
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsMayaTyping(true);
    
    setTimeout(() => {
      const mayaResponse: MayaChatMessage = {
        role: "maya",
        content: generateMayaResponse(question, filteredItems, itemType),
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, mayaResponse]);
      setIsMayaTyping(false);
    }, 1200);
  };

  const generateMayaResponse = (question: string, items: Item[], type: string): string => {
    const q = question.toLowerCase();
    
    if (type === "quote") {
      if (q.includes("expir") || q.includes("deadline") || q.includes("due")) {
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const expiring = items.filter(i => i.expiresAt && new Date(i.expiresAt) <= weekFromNow && new Date(i.expiresAt) >= now);
        if (expiring.length > 0) {
          return `${expiring.length} quote${expiring.length > 1 ? 's are' : ' is'} expiring within the next week. I'd suggest reaching out to those customers soon to keep the deals moving forward.`;
        }
        return `None of your current quotes are expiring soon. You're in good shape!`;
      }

      if (q.includes("draft") || q.includes("finish") || q.includes("incomplete")) {
        const drafts = items.filter(i => i.status === "Draft");
        if (drafts.length > 0) {
          const totalDraftValue = drafts.reduce((s, d) => s + (d.estimatedValue || 0), 0);
          return `You have ${drafts.length} draft quote${drafts.length > 1 ? 's' : ''} worth $${totalDraftValue.toLocaleString()} total. Finishing and sending these could bring in significant revenue. Want me to help you prioritize which ones to complete first?`;
        }
        return `All your quotes have been sent — no drafts remaining. Great job staying on top of things!`;
      }

      if (q.includes("follow") || q.includes("response") || q.includes("waiting") || q.includes("pending")) {
        const sent = items.filter(i => i.status === "Sent" || i.status === "Awaiting_response");
        if (sent.length > 0) {
          return `You have ${sent.length} quote${sent.length > 1 ? 's' : ''} awaiting customer response. A friendly follow-up after 3-5 days can significantly improve your close rate. Consider calling rather than emailing for higher-value quotes.`;
        }
        return `All your sent quotes have received responses. Check your approved quotes to schedule the work!`;
      }

      if (q.includes("approved") || q.includes("won") || q.includes("accepted")) {
        const approved = items.filter(i => i.status === "Approved");
        const total = approved.reduce((s, a) => s + (a.estimatedValue || 0), 0);
        return `You have ${approved.length} approved quote${approved.length > 1 ? 's' : ''} worth $${total.toLocaleString()}. These are ready to be scheduled and converted into active jobs. The sooner you start, the happier your customers will be.`;
      }

      if (q.includes("declined") || q.includes("lost") || q.includes("rejected")) {
        const declined = items.filter(i => i.status === "Declined");
        if (declined.length > 0) {
          return `${declined.length} quote${declined.length > 1 ? 's were' : ' was'} declined. Common reasons include pricing, timing, or scope. Consider creating revised quotes with adjusted pricing or phased approaches for these customers.`;
        }
        return `No declined quotes — that's a great approval rate! Keep up the excellent work.`;
      }
    }

    if (type === "job") {
      if (q.includes("overdue") || q.includes("late") || q.includes("behind")) {
        const overdue = items.filter(i => i.scheduledDate && new Date(i.scheduledDate) < new Date() && i.status !== "Completed");
        return overdue.length > 0
          ? `You have ${overdue.length} overdue job${overdue.length > 1 ? 's' : ''}. I'd suggest contacting those customers to reschedule or provide an update.`
          : `No overdue jobs — you're on track! Keep up the great work.`;
      }
      if (q.includes("complete") || q.includes("finish") || q.includes("done")) {
        const completed = items.filter(i => i.status === "Completed");
        const totalCompleted = completed.reduce((s, j) => s + (j.estimatedValue || 0), 0);
        return `${completed.length} completed job${completed.length > 1 ? 's' : ''} worth $${totalCompleted.toLocaleString()}. Make sure invoices are sent for any completed work to keep cash flowing.`;
      }
      if (q.includes("active") || q.includes("progress") || q.includes("current")) {
        const active = items.filter(i => i.status === "In Progress");
        const totalActive = active.reduce((s, j) => s + (j.estimatedValue || 0), 0);
        return `${active.length} job${active.length > 1 ? 's' : ''} currently in progress worth $${totalActive.toLocaleString()}. Focus on completing the highest-value ones first.`;
      }
      const inProgress = items.filter(i => i.status === "In Progress").length;
      const scheduled = items.filter(i => i.status === "Scheduled" || i.status === "Confirmed").length;
      const completed = items.filter(i => i.status === "Completed").length;
      return `You have ${items.length} jobs: ${inProgress} in progress, ${scheduled} scheduled, and ${completed} completed. Ask me about overdue jobs, active work, or your revenue.`;
    }

    if (q.includes("urgent") || q.includes("priority")) {
      const urgentCount = items.filter(i => i.priority === "Urgent" || i.priority === "High").length;
      return `You have ${urgentCount} high-priority ${type}s that need attention. I recommend focusing on these first to maintain customer satisfaction.`;
    }
    
    if (q.includes("value") || q.includes("money") || q.includes("revenue") || q.includes("total") || q.includes("worth")) {
      const totalValue = items.reduce((sum, i) => sum + (i.estimatedValue || 0), 0);
      const highest = Math.max(...items.map(i => i.estimatedValue || 0));
      if (type === "quote") {
        const byStatus: Record<string, number> = {};
        items.forEach(i => { byStatus[i.status] = (byStatus[i.status] || 0) + (i.estimatedValue || 0); });
        const breakdown = Object.entries(byStatus).map(([s, v]) => `${s}: $${v.toLocaleString()}`).join(", ");
        return `Your quotes total $${totalValue.toLocaleString()}. Breakdown by status — ${breakdown}. Focus on getting drafts sent and following up on pending quotes to maximize revenue.`;
      }
      return `Your current ${type}s represent a total potential value of $${totalValue.toLocaleString()}. The highest value opportunity is worth $${highest.toLocaleString()}.`;
    }
    
    if (q.includes("schedule") || q.includes("time") || q.includes("when")) {
      const unscheduled = items.filter(i => !i.scheduledDate).length;
      return `You have ${unscheduled} unscheduled ${type}s. I suggest scheduling them during your typical availability windows to optimize your workflow.`;
    }
    
    if (q.includes("category") || q.includes("type")) {
      const catCounts: Record<string, number> = {};
      items.forEach(i => { catCounts[i.category || "General"] = (catCounts[i.category || "General"] || 0) + 1; });
      const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
      return `Your most common category is "${topCat?.[0]}" with ${topCat?.[1]} ${type}s. Consider specializing in this area or hiring help for it.`;
    }

    if (type === "quote") {
      const drafts = items.filter(i => i.status === "Draft").length;
      const sent = items.filter(i => i.status === "Sent" || i.status === "Awaiting_response").length;
      const approved = items.filter(i => i.status === "Approved").length;
      return `You have ${items.length} quotes: ${drafts} drafts, ${sent} sent and awaiting response, and ${approved} approved. Try asking me about expiring quotes, follow-ups, drafts, or your revenue breakdown.`;
    }
    
    return `Based on your ${items.length} current ${type}s, I recommend prioritizing high-value opportunities and urgent requests. Would you like specific recommendations for scheduling or pricing?`;
  };

  const isUrgentPriority = (priority?: string) => {
    const p = priority?.toLowerCase();
    return p === "urgent" || p === "critical" || p === "emergency" || p === "emergent";
  };

  const getPriorityColor = (priority?: string) => {
    return isUrgentPriority(priority) ? "bg-red-50 text-red-600 border-red-100" : "bg-slate-50 text-slate-500 border-slate-100";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "New": case "Submitted": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
      case "In Progress": case "Active": return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
      case "Scheduled": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
      case "Draft": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
      case "Sent": case "Awaiting_response": return "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400";
      case "Approved": return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400";
      case "Cancelled": return "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400";
      case "Declined": return "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400";
      case "Passed": return "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400";
      case "Expired": return "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400";
      case "In Review": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
      default: return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top Title Bar - Spans Full Width (hidden when lifecycle bar is present) */}
      <div 
        className={`px-4 sm:px-6 ${lifecycleBar ? "py-1.5" : "py-3"} border-b flex items-center justify-between shrink-0`}
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)",
          backdropFilter: "blur(24px) saturate(180%)",
        }}
      >
        {!lifecycleBar && (
          <div>
            <h2 className="font-semibold text-lg sm:text-xl">{title}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          {/* Mobile Maya Button */}
          <Sheet open={mayaChatOpen} onOpenChange={setMayaChatOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden h-9 gap-2 touch-manipulation">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="hidden sm:inline">Maya</span>
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
                    <div 
                      key={idx}
                      className="p-3 rounded-lg bg-white border border-violet-100"
                      onClick={() => {
                        if (rec.itemId) handleItemClick(items.find(i => i.id === rec.itemId)!);
                        setMayaChatOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {rec.type === "prioritize" && <DollarSign className="h-4 w-4 text-green-600" />}
                        {rec.type === "followup" && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                        {rec.type === "schedule" && <Calendar className="h-4 w-4 text-blue-500" />}
                        {rec.type === "price" && <FileEdit className="h-4 w-4 text-violet-500" />}
                        <span className="text-sm font-medium">{rec.title}</span>
                      </div>
                      <p className="text-xs text-gray-600">{rec.message}</p>
                    </div>
                  ))}
                  {chatMessages.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg text-sm ${msg.role === "user" ? "bg-gray-100 ml-4" : "bg-violet-50"}`}
                    >
                      <p>{msg.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
                <div className="flex gap-2">
                  <Input
                    placeholder={`Ask about ${itemType}s...`}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMayaChat()}
                    className="flex-1 h-10"
                  />
                  <Button size="icon" className="h-10 w-10 bg-violet-500" onClick={handleMayaChat}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

        </div>
      </div>
      
      {/* Main Content Area with Maya Sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Fixed Maya Sidebar - Desktop (doesn't scroll with content) */}
        <div className="hidden lg:flex flex-col w-80 border-r bg-gradient-to-b from-violet-50/50 to-white shrink-0 overflow-hidden">
          {/* Maya Advisor Label - Aligned with content */}
          <div className="px-4 py-3 border-b flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md">
              <Sparkles className="h-4 w-4 text-white maya-sparkle-spin" />
            </div>
            <div>
              <h3 className="font-medium text-gray-800 text-sm">Maya AI Advisor</h3>
              <p className="text-[10px] text-muted-foreground">Your intelligent assistant</p>
            </div>
          </div>
        
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Recommendations</h4>
            {mayaRecommendations.length > 0 ? (
              mayaRecommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg bg-white border border-violet-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => rec.itemId && handleItemClick(items.find(i => i.id === rec.itemId)!)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {rec.type === "prioritize" && <DollarSign className="h-4 w-4 text-green-600" />}
                    {rec.type === "followup" && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                    {rec.type === "schedule" && <Calendar className="h-4 w-4 text-blue-500" />}
                    {rec.type === "price" && <FileEdit className="h-4 w-4 text-violet-500" />}
                    <span className="text-sm font-medium text-gray-800">{rec.title}</span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{rec.message}</p>
                  {rec.itemId && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-violet-600">
                      <span>View</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">
                No recommendations yet. Add some {itemType}s to get started.
              </p>
            )}
            
            {/* Chat Messages */}
            {chatMessages.length > 0 && (
              <>
                <div className="h-px bg-violet-100 my-4" />
                <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Conversation</h4>
                <div className="space-y-3">
                  {chatMessages.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg text-sm ${
                        msg.role === "user" 
                          ? "bg-gray-100 ml-4" 
                          : "bg-violet-50 border border-violet-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.role === "maya" ? (
                          <Bot className="h-3 w-3 text-violet-500" />
                        ) : (
                          <User className="h-3 w-3 text-gray-500" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {msg.role === "maya" ? "Maya" : "You"}
                        </span>
                      </div>
                      <p className="text-gray-700">{msg.content}</p>
                    </div>
                  ))}
                  {isMayaTyping && (
                    <div className="flex items-center gap-2 text-sm text-violet-500 p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Maya is thinking...</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
        
        {/* Chat Input */}
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <Input
              ref={chatInputRef}
              placeholder={`Ask Maya about ${itemType}s...`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleMayaChat()}
              className="flex-1 h-10 text-sm"
            />
            <Button 
              size="icon" 
              className="h-10 w-10 bg-violet-500 hover:bg-violet-600"
              onClick={handleMayaChat}
              disabled={!chatInput.trim() || isMayaTyping}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        </div>

        {/* Main Content Column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Unified Toolbar - View dropdown + Search + Category + Sort + Cards/List toggle */}
          <div className={`shrink-0 px-4 ${lifecycleBar ? "py-2" : "py-3"} border-b bg-white`}>
            {lifecycleBar && (
              <div className="mb-2">
                {lifecycleBar}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Lifecycle Pipeline Bar */}
              {filterTabs && filterTabs.length > 0 && (() => {
                const groupedTab = filterTabs.find(t => t.groupedWith && t.groupedWith.length > 0);
                const groupedChildIds = new Set(groupedTab?.groupedWith || []);
                const primaryTabs = filterTabs.filter(t => !t.secondary && !t.groupedWith && !groupedChildIds.has(t.id));
                const secondaryTabs = filterTabs.filter(t => t.secondary);
                const groupedChildren = groupedTab ? filterTabs.filter(t => groupedTab.groupedWith!.includes(t.id)) : [];
                const allGroupedIds = groupedTab ? [groupedTab.id, ...groupedTab.groupedWith!] : [];
                const isGroupActive = allGroupedIds.includes(activeFilter);
                const activeGroupLabel = isGroupActive
                  ? [...(groupedTab ? [groupedTab] : []), ...groupedChildren].find(t => t.id === activeFilter)?.label || groupedTab?.label
                  : groupedTab?.label;
                const totalGroupCount = groupedTab
                  ? (groupedTab.count || 0) + groupedChildren.reduce((sum, c) => sum + (c.count || 0), 0)
                  : 0;

                return (
                  <div className="flex items-center gap-0 shrink-0">
                    {primaryTabs.map((tab, idx) => {
                      const isActive = activeFilter === tab.id;
                      return (
                        <div key={tab.id} className="flex items-center">
                          {idx > 0 && (
                            <div className="w-4 h-[1.5px] bg-slate-200" />
                          )}
                          <button
                            onClick={() => handleFilterChange(tab.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                              isActive
                                ? "bg-violet-100/80 text-violet-700 border border-violet-300/60 shadow-sm"
                                : "bg-slate-50/60 text-slate-500 border border-slate-200/60 hover:bg-slate-100/80 hover:text-slate-600"
                            }`}
                          >
                            {tab.label}
                            {tab.count > 0 && (
                              <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold ${
                                isActive ? "bg-violet-200/80 text-violet-800" : "bg-slate-200/80 text-slate-600"
                              }`}>
                                {tab.count}
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}

                    
                  </div>
                );
              })()}

              {/* Category Filter */}
              {showCategoryFilter && derivedCategories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 cursor-pointer shrink-0"
                >
                  <option value="all">All Categories</option>
                  {derivedCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}

              {/* Read Status Filter */}
              <select
                value={readStatusFilter}
                onChange={(e) => setReadStatusFilter(e.target.value)}
                className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 cursor-pointer shrink-0 font-medium"
              >
                <option value="new">New Only</option>
                <option value="read">Read</option>
                <option value="all">All</option>
              </select>

              {/* Sort */}
              {showSort && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 cursor-pointer shrink-0"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="highest">Highest Value</option>
                  <option value="lowest">Lowest Value</option>
                  {itemType === "quote" && <option value="expiry">Expiring Soon</option>}
                  {(itemType === "quote" || itemType === "job") && <option value="customer">By Customer</option>}
                  {itemType !== "quote" && <option value="priority">Priority</option>}
                  {itemType === "job" && <option value="status">By Status</option>}
                </select>
              )}

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-0.5 whitespace-nowrap touch-manipulation shrink-0"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}

              {/* Right side: Secondary filters + Search + Cards/List Toggle */}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                {filterTabs && filterTabs.length > 0 && (() => {
                  const groupedTab = filterTabs.find(t => t.groupedWith && t.groupedWith.length > 0);
                  const groupedChildIds = new Set(groupedTab?.groupedWith || []);
                  const secondaryTabs = filterTabs.filter(t => t.secondary);
                  const groupedChildren = groupedTab ? filterTabs.filter(t => groupedTab.groupedWith!.includes(t.id)) : [];
                  const allGroupedIds = groupedTab ? [groupedTab.id, ...groupedTab.groupedWith!] : [];
                  const isGroupActive = allGroupedIds.includes(activeFilter);
                  const activeGroupLabel = isGroupActive
                    ? [...(groupedTab ? [groupedTab] : []), ...groupedChildren].find(t => t.id === activeFilter)?.label || groupedTab?.label
                    : groupedTab?.label;
                  const totalGroupCount = groupedTab
                    ? (groupedTab.count || 0) + groupedChildren.reduce((sum, c) => sum + (c.count || 0), 0)
                    : 0;

                  if (secondaryTabs.length === 0 && !groupedTab) return null;

                  return (
                    <div className="flex items-center gap-1.5">
                      {secondaryTabs.map((tab) => {
                        const isActive = activeFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => handleFilterChange(tab.id)}
                            className={`flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                              isActive
                                ? "bg-slate-200/80 text-slate-700 border border-slate-300/60 shadow-sm"
                                : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-600"
                            }`}
                          >
                            {tab.label}
                            {tab.count > 0 && (
                              <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold ${
                                isActive ? "bg-slate-300/80 text-slate-700" : "bg-slate-200/80 text-slate-600"
                              }`}>
                                {tab.count}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {groupedTab && (
                        <div className="relative group">
                          <button
                            className={`flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                              isGroupActive
                                ? "bg-slate-200/80 text-slate-700 border border-slate-300/60 shadow-sm"
                                : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-600"
                            }`}
                          >
                            {isGroupActive ? activeGroupLabel : "Other"}
                            {totalGroupCount > 0 && (
                              <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold ${
                                isGroupActive ? "bg-slate-300/80 text-slate-700" : "bg-slate-200/80 text-slate-600"
                              }`}>
                                {totalGroupCount}
                              </span>
                            )}
                            <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block min-w-[130px]">
                            <div className="bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                              {[groupedTab, ...groupedChildren].map((child) => (
                                <button
                                  key={child.id}
                                  onClick={() => handleFilterChange(child.id)}
                                  className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                                    activeFilter === child.id
                                      ? "bg-violet-50 text-violet-700"
                                      : "text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {child.label}
                                  {child.count > 0 && (
                                    <span className="ml-1.5 text-[10px] text-slate-400">({child.count})</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Search */}
                {showSearch && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 w-32 text-xs border-slate-200 bg-slate-50 focus:bg-white focus:w-44 transition-all"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded">
                        <X className="h-3 w-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center bg-muted rounded-md p-0.5">
                  <button
                    onClick={() => setViewMode("cards")}
                    className={`p-1.5 rounded transition-colors touch-manipulation ${
                      viewMode === "cards" ? "bg-white shadow-sm" : "hover:bg-white/50"
                    }`}
                    title="Card View"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded transition-colors touch-manipulation ${
                      viewMode === "list" ? "bg-white shadow-sm" : "hover:bg-white/50"
                    }`}
                    title="List View"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("map")}
                    className={`p-1.5 rounded transition-colors touch-manipulation ${
                      viewMode === "map" ? "bg-white shadow-sm" : "hover:bg-white/50"
                    }`}
                    title="Map View"
                  >
                    <Map className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Subtle count line below toolbar */}
          {(filteredItems.length !== items.length || hasActiveFilters) && (
            <div className="px-4 py-1 bg-slate-50/80 border-b">
              <span className="text-[11px] text-slate-400">
                Showing {filteredItems.length} of {items.length} {itemType}s
              </span>
            </div>
          )}

        {/* Content Area - scrollable with sticky headers above */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {viewMode === "map" ? (
            /* Map View */
            <div className="p-4">
              <JobMapView
                items={filteredItems}
                itemType={itemType}
                selectedItemId={selectedItemId}
                onSelectItem={(id) => {
                  setSelectedItemId(id);
                  const item = filteredItems.find(i => i.id === id);
                  if (item) onItemSelect(item);
                }}
                onAccept={onAccept ? (item) => onAccept(item as any) : undefined}
                onSendQuote={onSendQuote ? (item) => onSendQuote(item as any) : undefined}
              />
            </div>
          ) : viewMode === "cards" ? (
            /* Cards View - Horizontal Carousel */
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-4 overflow-x-auto pb-4 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
                {filteredItems.map((item, idx) => {
                  const isSelected = selectedItemId === item.id;
                  return (
                    <button
                      key={`${item.id}-${idx}`}
                      onClick={() => handleItemClick(item)}
                      className="flex flex-col items-center min-w-[70px] sm:min-w-[90px] group touch-manipulation"
                    >
                      <div 
                        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isSelected ? "ring-2 ring-violet-400 scale-105" : "hover:scale-105"
                        }`}
                        style={{
                          background: isSelected 
                            ? `linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))`
                            : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                          boxShadow: isSelected 
                            ? "0 6px 20px rgba(139, 92, 246, 0.2)"
                            : "0 4px 12px rgba(0,0,0,0.06)",
                        }}
                      >
                        {item.photoUrl ? (
                          <img src={item.photoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <Home className={`h-5 w-5 ${isSelected ? item.color.text : "text-gray-400"}`} />
                        )}
                        {isUrgentPriority(item.priority) && !unreadByCaseId[item.id] && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-[8px] text-white font-bold">!</span>
                          </div>
                        )}
                        {unreadByCaseId[item.id] > 0 && (
                          <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-violet-500 rounded-full flex items-center justify-center px-1 border-2 border-white">
                            <span className="text-[9px] text-white font-bold">{unreadByCaseId[item.id]}</span>
                          </div>
                        )}
                      </div>
                      <span className={`text-sm mt-1 font-bold ${isSelected ? "text-slate-800" : "text-slate-700"}`}>
                        ${(item.estimatedValue || 0).toLocaleString()}
                      </span>
                      <span className={`text-[10px] font-medium ${item.isExistingCustomer ? 'text-blue-500' : 'text-emerald-500'}`}>
                        {item.isExistingCustomer ? 'Existing Customer' : 'New Customer'}
                      </span>
                      {item.status.toLowerCase() !== "new" && item.status.toLowerCase() !== "pending" && item.status.toLowerCase() !== "open" && (
                        itemType === "quote" ? (
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${getStatusBadge(item.status)}`}>{item.status}</span>
                        ) : (
                          <span className={`text-[10px] ${item.status === "In Review" ? "text-amber-600 font-medium" : item.status === "Resolved" ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                            {item.status === "In Review" ? "Awaiting Scheduling" : item.status === "Resolved" ? "Completed" : item.status}
                          </span>
                        )
                      )}
                      {item.city && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[65px]">{item.city}</span>
                      )}
                    </button>
                  );
                })}
                {filteredItems.length === 0 && (
                  <div className="text-sm text-muted-foreground px-4">
                    No {itemType}s found
                  </div>
                )}
              </div>

              {/* Selected Item Detail */}
              {selectedItem && itemType === "quote" ? (
                <InlineQuoteDetail
                  quoteId={selectedItem.id}
                  customerId={selectedItem.customerId}
                  customerName={selectedItem.customerName}
                  customerInitials={selectedItem.customerInitials}
                  status={selectedItem.status}
                  caseId={selectedItem.caseId}
                  reporterUserId={selectedItem.reporterUserId}
                  initialTitle={selectedItem.title}
                  initialSubtotal={selectedItem.subtotal}
                  initialTaxAmount={selectedItem.taxAmount}
                  initialTotal={selectedItem.total}
                  initialExpiresAt={selectedItem.expiresAt}
                  initialClientMessage={selectedItem.clientMessage}
                  initialInternalNotes={selectedItem.internalNotes}
                  initialDiscountAmount={selectedItem.discountAmount}
                  initialTaxPercent={selectedItem.taxPercent}
                  initialDepositType={selectedItem.depositType}
                  initialDepositValue={selectedItem.depositValue}
                  onClose={() => setSelectedItemId(null)}
                />
              ) : selectedItem ? (
                <>
                <Card className="mt-4 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-slate-600 font-bold overflow-hidden"
                          style={{
                            background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                            boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                          }}
                        >
                          {selectedItem.photoUrl ? (
                            <img src={selectedItem.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Home className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">${(selectedItem.estimatedValue || 0).toLocaleString()}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${selectedItem.isExistingCustomer ? 'text-blue-500' : 'text-emerald-500'}`}>
                              {selectedItem.isExistingCustomer ? 'Existing Customer' : 'New Customer'}
                            </span>
                            <span className="text-sm text-muted-foreground">{selectedItem.category || "General"}</span>
                          </div>
                          {selectedItem.city && (
                            <p className="text-xs text-muted-foreground">{selectedItem.city}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isUrgentPriority(selectedItem.priority) ? (
                          <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Urgent</Badge>
                        ) : null}
                        <Badge className={`${getStatusBadge(selectedItem.status)} border-0`}>{selectedItem.status}</Badge>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      {onSendQuote && !onAccept && (
                        <Button className="flex-1 h-11 touch-manipulation bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200/60" onClick={() => onSendQuote(selectedItem)}>
                          <Send className="h-4 w-4 mr-2" /> Quote
                        </Button>
                      )}
                      {onAccept && (
                        <Button className={`flex-1 h-11 touch-manipulation ${acceptLabel === "Restore" ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60" : "bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200/60"}`} onClick={() => onAccept(selectedItem)}>
                          {acceptLabel === "Restore" ? <CheckCircle className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />} {acceptLabel}
                        </Button>
                      )}
                      {onDecline && (
                        <Button variant="outline" className="flex-1 h-11 touch-manipulation border-red-200 text-red-600 hover:bg-red-50" onClick={() => onDecline(selectedItem)}>
                          <X className="h-4 w-4 mr-2" /> Pass
                        </Button>
                      )}
                    </div>

                    {itemType === "job" && (
                      <div className="mb-4">
                        {(selectedItem.status === "In Review" || selectedItem.status === "Scheduled") && onConfirmJob && !confirmJobOpen && (
                          <Button
                            className="w-full h-11 touch-manipulation bg-emerald-100/60 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 backdrop-blur-sm"
                            onClick={() => setConfirmJobOpen(true)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" /> {selectedItem.status === "Scheduled" ? "Add Schedule" : "Confirm Job"}
                          </Button>
                        )}
                        {(selectedItem.status === "In Review" || selectedItem.status === "Scheduled") && onConfirmJob && confirmJobOpen && (
                          <div className="space-y-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                            <p className="text-sm font-medium text-emerald-800">Confirm & Schedule</p>
                            <div>
                              <Label className="text-xs text-slate-600">Start Date</Label>
                              <Input
                                type="date"
                                value={confirmStartDate}
                                onChange={(e) => setConfirmStartDate(e.target.value)}
                                className="mt-1 h-9"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-600">Estimated Days</Label>
                              <Input
                                type="number"
                                min="1"
                                placeholder="e.g. 3"
                                value={confirmEstDays}
                                onChange={(e) => setConfirmEstDays(e.target.value)}
                                className="mt-1 h-9"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-600">Notes (optional)</Label>
                              <Textarea
                                placeholder="Any notes for the homeowner..."
                                value={confirmNotes}
                                onChange={(e) => setConfirmNotes(e.target.value)}
                                className="mt-1 min-h-[60px]"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                                disabled={!confirmStartDate || jobActionLoading}
                                onClick={async () => {
                                  setJobActionLoading(true);
                                  await onConfirmJob(selectedItem, {
                                    confirmedStartDate: confirmStartDate,
                                    estimatedDays: confirmEstDays ? parseInt(confirmEstDays) : undefined,
                                    notes: confirmNotes || undefined,
                                  });
                                  setJobActionLoading(false);
                                  setConfirmJobOpen(false);
                                  setConfirmStartDate("");
                                  setConfirmEstDays("");
                                  setConfirmNotes("");
                                }}
                              >
                                {jobActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                              </Button>
                              <Button
                                variant="outline"
                                className="h-9 text-sm"
                                onClick={() => {
                                  setConfirmJobOpen(false);
                                  setConfirmStartDate("");
                                  setConfirmEstDays("");
                                  setConfirmNotes("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                        {selectedItem.status === "Scheduled" && onStartJob && (
                          <Button
                            className="w-full h-11 touch-manipulation bg-blue-100/60 hover:bg-blue-100/80 text-blue-700 border border-blue-200/60 backdrop-blur-sm"
                            disabled={jobActionLoading}
                            onClick={async () => {
                              setJobActionLoading(true);
                              await onStartJob(selectedItem);
                              setJobActionLoading(false);
                            }}
                          >
                            {jobActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowRight className="h-4 w-4 mr-2" /> Start Work</>}
                          </Button>
                        )}
                        {selectedItem.status === "In Progress" && onCompleteJob && (
                          <div className="space-y-3">
                            <Textarea
                              placeholder="Completion notes (optional)..."
                              value={completionNotes}
                              onChange={(e) => setCompletionNotes(e.target.value)}
                              className="min-h-[60px]"
                            />
                            <Button
                              className="w-full h-11 touch-manipulation bg-emerald-100/60 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 backdrop-blur-sm"
                              disabled={jobActionLoading}
                              onClick={async () => {
                                setJobActionLoading(true);
                                await onCompleteJob(selectedItem, {
                                  completionNotes: completionNotes || undefined,
                                });
                                setJobActionLoading(false);
                                setCompletionNotes("");
                              }}
                            >
                              {jobActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-2" /> Mark Complete</>}
                            </Button>
                          </div>
                        )}
                        {(selectedItem.status === "Completed" || selectedItem.status === "Resolved") && (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/50">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <span className="text-sm font-medium text-emerald-600">Job Completed</span>
                          </div>
                        )}
                        {selectedItem.caseScheduledStartAt && (selectedItem.status === "Scheduled" || selectedItem.status === "In Progress") && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                            <Calendar className="h-3.5 w-3.5 text-violet-400" />
                            <span>Scheduled: {new Date(selectedItem.caseScheduledStartAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Customer:</span>
                        <p className="font-medium">{selectedItem.customerName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value:</span>
                        <p className="font-bold text-slate-800">
                          {selectedItem.aiTriageJson?.estimatedCost && (selectedItem.estimatedValue || 0) > 0 && !selectedItem.total
                            ? selectedItem.aiTriageJson.estimatedCost
                            : `$${(selectedItem.estimatedValue || 0).toLocaleString()}`
                          }
                        </p>
                      </div>
                      {selectedItem.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{selectedItem.phone}</span>
                        </div>
                      )}
                      {selectedItem.address && (
                        <div className="flex items-center gap-2 col-span-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{selectedItem.address}</span>
                        </div>
                      )}
                      {selectedItem.availableStartDate && (
                        <div className="flex items-center gap-2 col-span-2">
                          <Calendar className="h-3 w-3 text-violet-400" />
                          <span className="text-sm text-violet-600">
                            Available {new Date(selectedItem.availableStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {selectedItem.availableEndDate && new Date(selectedItem.availableEndDate).getTime() !== new Date(selectedItem.availableStartDate).getTime()
                              ? ` – ${new Date(selectedItem.availableEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                              : ''}
                            {selectedItem.estimatedDays ? ` (${selectedItem.estimatedDays} day${selectedItem.estimatedDays > 1 ? 's' : ''})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {selectedItem.description && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-600">{selectedItem.description}</p>
                      </div>
                    )}

                    {selectedItem.media && selectedItem.media.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Attached Photos</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {selectedItem.media.map((m) => (
                            <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              {m.type?.startsWith("video") ? (
                                <video src={m.url} className="w-24 h-24 rounded-lg object-cover border" />
                              ) : (
                                <img src={m.url} alt={m.caption || "Attachment"} className="w-24 h-24 rounded-lg object-cover border" />
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedItem.aiTriageJson && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                              <Sparkles className="h-3 w-3 text-white" />
                            </div>
                            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Maya AI Assessment</p>
                          </div>
                          <PhotoAnalysisButton
                            media={selectedItem.media || []}
                            photoAnalysis={selectedItem.aiTriageJson?.photoAnalysis}
                          />
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Urgency</span>
                            {isUrgentPriority(selectedItem.aiTriageJson.urgency) ? (
                              <Badge variant="destructive">Urgent</Badge>
                            ) : null}
                          </div>
                          {selectedItem.aiTriageJson.rootCause && (
                            <div>
                              <span className="text-xs text-slate-500 block mb-0.5">Likely Cause</span>
                              <p className="text-sm text-slate-700">{selectedItem.aiTriageJson.rootCause}</p>
                            </div>
                          )}
                          <div className="flex gap-4">
                            {selectedItem.aiTriageJson.estimatedCost && (
                              <div>
                                <span className="text-xs text-slate-500 block">Est. Cost</span>
                                <p className="text-sm font-medium text-slate-700">{selectedItem.aiTriageJson.estimatedCost}</p>
                              </div>
                            )}
                            {selectedItem.aiTriageJson.estimatedTime && (
                              <div>
                                <span className="text-xs text-slate-500 block">Est. Time</span>
                                <p className="text-sm font-medium text-slate-700">{selectedItem.aiTriageJson.estimatedTime}</p>
                              </div>
                            )}
                          </div>
                          {selectedItem.aiTriageJson.suggestedActions && selectedItem.aiTriageJson.suggestedActions.length > 0 && (
                            <div>
                              <span className="text-xs text-slate-500 block mb-1">Suggested Steps</span>
                              <ul className="space-y-1">
                                {selectedItem.aiTriageJson.suggestedActions.map((action, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                    <CheckCircle className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
                                    <span>{action}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {selectedItem.aiTriageJson.safetyNotes && (
                            <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 border border-amber-200">
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-amber-700">{selectedItem.aiTriageJson.safetyNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedItem.reporterUserId && (
                  <div className="mt-3">
                    <ThreadChat
                      caseId={selectedItem.id}
                      homeownerUserId={selectedItem.reporterUserId}
                      orgId={selectedItem.orgId}
                      subject={selectedItem.title}
                      compact
                    />
                  </div>
                )}
                </>
              ) : null}

              {!selectedItem && filteredItems.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Select a {itemType} to view details</p>
                </div>
              )}
            </div>
          ) : (
            /* List View - Compact Table */
            <div className="p-2 sm:p-4">
              <div className="rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium">Customer</th>
                      {itemType !== "quote" && (
                        <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Category</th>
                      )}
                      {itemType === "quote" ? (
                        <th className="text-center px-3 py-2.5 font-medium hidden sm:table-cell">Expires</th>
                      ) : (
                        <th className="text-center px-3 py-2.5 font-medium">Priority</th>
                      )}
                      <th className="text-right px-3 py-2.5 font-medium">Value</th>
                      <th className="text-center px-3 py-2.5 font-medium hidden md:table-cell">Status</th>
                      <th className="text-right px-3 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => (
                      <tr 
                        key={`${item.id}-${idx}`}
                        className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                          selectedItemId === item.id ? "bg-violet-50" : ""
                        }`}
                        onClick={() => handleItemClick(item)}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 text-xs font-bold shrink-0 overflow-hidden"
                              style={{
                                background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                              }}
                            >
                              {item.photoUrl ? (
                                <img src={item.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Home className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold truncate">${(item.estimatedValue || 0).toLocaleString()}</p>
                                <span className={`text-[10px] font-medium ${item.isExistingCustomer ? 'text-blue-500' : 'text-emerald-500'}`}>
                                  {item.isExistingCustomer ? 'Existing Customer' : 'New Customer'}
                                </span>
                                {unreadByCaseId[item.id] > 0 && (
                                  <span className="shrink-0 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-violet-500 text-white text-[10px] font-bold rounded-full">
                                    {unreadByCaseId[item.id]}
                                  </span>
                                )}
                              </div>
                              {itemType !== "quote" && (
                                <p className="text-xs text-muted-foreground truncate sm:hidden">{item.category}</p>
                              )}
                              {itemType === "quote" && item.expiresAt && (
                                <p className={`text-xs truncate sm:hidden ${
                                  new Date(item.expiresAt) < new Date() ? "text-red-500" :
                                  new Date(item.expiresAt) < new Date(Date.now() + 7 * 86400000) ? "text-amber-600" :
                                  "text-muted-foreground"
                                }`}>
                                  Exp: {new Date(item.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        {itemType !== "quote" && (
                          <td className="px-3 py-3 hidden sm:table-cell">
                            <span className="text-muted-foreground">{item.category || "General"}</span>
                          </td>
                        )}
                        {itemType === "quote" ? (
                          <td className="px-3 py-3 text-center hidden sm:table-cell">
                            {item.expiresAt ? (
                              <span className={`text-xs ${
                                new Date(item.expiresAt) < new Date() ? "text-red-500 font-medium" :
                                new Date(item.expiresAt) < new Date(Date.now() + 7 * 86400000) ? "text-amber-600 font-medium" :
                                "text-muted-foreground"
                              }`}>
                                {new Date(item.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : (
                          <td className="px-3 py-3 text-center">
                            {isUrgentPriority(item.priority) ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">Urgent</Badge>
                            ) : null}
                          </td>
                        )}
                        <td className="px-3 py-3 text-right">
                          <span className="font-medium text-slate-700">${(item.estimatedValue || 0).toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-3 text-center hidden md:table-cell">
                          <Badge className={`${getStatusBadge(item.status)} border-0`}>{item.status}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {onSendQuote && !onAccept && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-violet-600 hover:bg-violet-50 touch-manipulation"
                                onClick={(e) => { e.stopPropagation(); onSendQuote(item); }}
                                title="Send Quote"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {onAccept && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className={`h-8 w-8 p-0 touch-manipulation ${acceptLabel === "Restore" ? "text-blue-600 hover:bg-blue-50" : "text-violet-600 hover:bg-violet-50"}`}
                                onClick={(e) => { e.stopPropagation(); onAccept(item); }}
                                title={acceptLabel}
                              >
                                {acceptLabel === "Restore" ? <CheckCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                              </Button>
                            )}
                            {onDecline && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 touch-manipulation"
                                onClick={(e) => { e.stopPropagation(); onDecline(item); }}
                                title="Pass on this request"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 touch-manipulation"
                              onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={itemType === "quote" ? 5 : 6} className="px-3 py-8 text-center text-muted-foreground">
                          {emptyIcon}
                          <p className="mt-2">{emptyMessage}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Quick Detail Panel for List View */}
              {selectedItem && viewMode === "list" && itemType === "quote" ? (
                <InlineQuoteDetail
                  quoteId={selectedItem.id}
                  customerId={selectedItem.customerId}
                  customerName={selectedItem.customerName}
                  customerInitials={selectedItem.customerInitials}
                  status={selectedItem.status}
                  caseId={selectedItem.caseId}
                  reporterUserId={selectedItem.reporterUserId}
                  initialTitle={selectedItem.title}
                  initialSubtotal={selectedItem.subtotal}
                  initialTaxAmount={selectedItem.taxAmount}
                  initialTotal={selectedItem.total}
                  initialExpiresAt={selectedItem.expiresAt}
                  initialClientMessage={selectedItem.clientMessage}
                  initialInternalNotes={selectedItem.internalNotes}
                  initialDiscountAmount={selectedItem.discountAmount}
                  initialTaxPercent={selectedItem.taxPercent}
                  initialDepositType={selectedItem.depositType}
                  initialDepositValue={selectedItem.depositValue}
                  onClose={() => setSelectedItemId(null)}
                />
              ) : selectedItem && viewMode === "list" ? (
                <Card className="mt-4 border-violet-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 font-bold overflow-hidden"
                          style={{
                            background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                            boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                          }}
                        >
                          {selectedItem.photoUrl ? (
                            <img src={selectedItem.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Home className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold">${(selectedItem.estimatedValue || 0).toLocaleString()}</h4>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-medium ${selectedItem.isExistingCustomer ? 'text-blue-500' : 'text-emerald-500'}`}>
                              {selectedItem.isExistingCustomer ? 'Existing Customer' : 'New Customer'}
                            </span>
                            {selectedItem.city && <span className="text-xs text-muted-foreground">{selectedItem.city}</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedItemId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{selectedItem.description || "No description provided"}</p>
                    <div className="flex gap-2">
                      {onSendQuote && !onAccept && (
                        <Button size="sm" className="h-9 touch-manipulation bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200/60" onClick={() => onSendQuote(selectedItem)}>
                          <Send className="h-3 w-3 mr-1" /> Quote
                        </Button>
                      )}
                      {onAccept && (
                        <Button size="sm" className={`h-9 touch-manipulation ${acceptLabel === "Restore" ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60" : "bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200/60"}`} onClick={() => onAccept(selectedItem)}>
                          {acceptLabel === "Restore" ? <CheckCircle className="h-3 w-3 mr-1" /> : <Send className="h-3 w-3 mr-1" />} {acceptLabel}
                        </Button>
                      )}
                    </div>
                    {itemType === "job" && (
                      <div className="mt-3">
                        {(selectedItem.status === "In Review" || selectedItem.status === "Scheduled") && onConfirmJob && (
                          <Button size="sm" className="w-full h-9 touch-manipulation bg-emerald-100/60 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 backdrop-blur-sm"
                            onClick={() => { setConfirmJobOpen(true); }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" /> {selectedItem.status === "Scheduled" ? "Add Schedule" : "Confirm Job"}
                          </Button>
                        )}
                        {selectedItem.status === "Scheduled" && onStartJob && (
                          <Button size="sm" className="w-full h-9 touch-manipulation bg-blue-100/60 hover:bg-blue-100/80 text-blue-700 border border-blue-200/60 backdrop-blur-sm"
                            disabled={jobActionLoading}
                            onClick={async () => { setJobActionLoading(true); await onStartJob(selectedItem); setJobActionLoading(false); }}
                          >
                            {jobActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ArrowRight className="h-3 w-3 mr-1" /> Start Work</>}
                          </Button>
                        )}
                        {selectedItem.status === "In Progress" && onCompleteJob && (
                          <Button size="sm" className="w-full h-9 touch-manipulation bg-emerald-100/60 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 backdrop-blur-sm"
                            disabled={jobActionLoading}
                            onClick={async () => { setJobActionLoading(true); await onCompleteJob(selectedItem, {}); setJobActionLoading(false); }}
                          >
                            {jobActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle className="h-3 w-3 mr-1" /> Complete</>}
                          </Button>
                        )}
                        {(selectedItem.status === "Completed" || selectedItem.status === "Resolved") && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/50">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-600">Completed</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
