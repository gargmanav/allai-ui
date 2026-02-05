import { useState, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, CheckCircle, Calendar, DollarSign, Clock, ArrowRight, Send, MapPin, User, Phone, FileText, Search, X, LayoutGrid, List, MessageCircle, ChevronRight, Bot, Loader2 } from "lucide-react";

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
  lineItems?: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  expiresAt?: string;
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

interface MayaCarouselLayoutProps {
  title: string;
  subtitle: string;
  items: Item[];
  filterTabs?: { id: string; label: string; count: number }[];
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  onItemSelect: (item: Item) => void;
  onAccept?: (item: Item) => void;
  onSendQuote?: (item: Item) => void;
  onSchedule?: (item: Item) => void;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  itemType: "request" | "quote";
  showCategoryFilter?: boolean;
  showPriorityFilter?: boolean;
  showSearch?: boolean;
  showSort?: boolean;
  categories?: string[];
}

export function MayaCarouselLayout({
  title,
  subtitle,
  items,
  filterTabs,
  activeFilter: externalActiveFilter,
  onFilterChange,
  onItemSelect,
  onAccept,
  onSendQuote,
  onSchedule,
  emptyIcon,
  emptyMessage = "No items found",
  itemType,
  showCategoryFilter = false,
  showPriorityFilter = false,
  showSearch = false,
  showSort = false,
  categories = [],
}: MayaCarouselLayoutProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [internalFilter, setInternalFilter] = useState<string>(externalActiveFilter || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [mayaChatOpen, setMayaChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<MayaChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isMayaTyping, setIsMayaTyping] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  
  const activeFilter = externalActiveFilter ?? internalFilter;
  
  const handleFilterChange = (filterId: string) => {
    setInternalFilter(filterId);
    setSelectedItemId(null);
    onFilterChange?.(filterId);
  };
  
  const clearAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setInternalFilter("all");
    setSelectedItemId(null);
    onFilterChange?.("all");
  };
  
  const hasActiveFilters = searchQuery || categoryFilter !== "all" || priorityFilter !== "all" || activeFilter !== "all";
  
  const filteredItems = useMemo(() => {
    let result = [...items];
    
    if (activeFilter !== "all") {
      result = result.filter(item => item.status.toLowerCase() === activeFilter.toLowerCase());
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
        item.description?.toLowerCase().includes(query)
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
        default: return 0;
      }
    });
    
    return result;
  }, [items, activeFilter, categoryFilter, priorityFilter, searchQuery, sortBy]);
  
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
    
    return recommendations.slice(0, 3);
  }, [items, itemType]);

  const handleItemClick = (item: Item) => {
    setSelectedItemId(item.id);
    onItemSelect(item);
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
    
    if (q.includes("urgent") || q.includes("priority")) {
      const urgentCount = items.filter(i => i.priority === "Urgent" || i.priority === "High").length;
      return `You have ${urgentCount} high-priority ${type}s that need attention. I recommend focusing on these first to maintain customer satisfaction.`;
    }
    
    if (q.includes("value") || q.includes("money") || q.includes("revenue")) {
      const totalValue = items.reduce((sum, i) => sum + (i.estimatedValue || 0), 0);
      return `Your current ${type}s represent a total potential value of $${totalValue.toLocaleString()}. The highest value opportunity is worth $${Math.max(...items.map(i => i.estimatedValue || 0)).toLocaleString()}.`;
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
    
    return `Based on your ${items.length} current ${type}s, I recommend prioritizing high-value opportunities and urgent requests. Would you like specific recommendations for scheduling or pricing?`;
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "Urgent": return "bg-red-50 text-red-600 border-red-100";
      case "High": return "bg-amber-50 text-amber-600 border-amber-100";
      case "Normal": return "bg-slate-100 text-slate-600 border-slate-200";
      case "Low": return "bg-slate-50 text-slate-500 border-slate-100";
      default: return "bg-slate-50 text-slate-500 border-slate-100";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New": case "Submitted": return "bg-slate-100 text-slate-600";
      case "In Progress": case "Active": return "bg-slate-100 text-slate-700";
      case "Scheduled": return "bg-slate-100 text-slate-600";
      case "Draft": return "bg-slate-50 text-slate-500";
      case "Sent": return "bg-slate-100 text-slate-600";
      case "Approved": return "bg-green-50 text-green-600";
      case "Declined": case "Expired": return "bg-red-50 text-red-500";
      case "In Review": return "bg-slate-100 text-slate-600";
      default: return "bg-slate-50 text-slate-500";
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top Title Bar - Spans Full Width */}
      <div 
        className="px-4 sm:px-6 py-3 border-b flex items-center justify-between shrink-0"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)",
          backdropFilter: "blur(24px) saturate(180%)",
        }}
      >
        <div>
          <h2 className="font-semibold text-lg sm:text-xl">{title}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
        </div>
        
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
                        {rec.type === "followup" && <Clock className="h-4 w-4 text-orange-500" />}
                        {rec.type === "schedule" && <Calendar className="h-4 w-4 text-blue-500" />}
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
                    {rec.type === "followup" && <Clock className="h-4 w-4 text-orange-500" />}
                    {rec.type === "schedule" && <Calendar className="h-4 w-4 text-blue-500" />}
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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Unified Toolbar - Filter tabs + Search + Filters + View Toggle in one row */}
          <div className="shrink-0 px-3 sm:px-4 py-2 border-b bg-white overflow-x-auto">
            <div className="flex items-center gap-2 flex-nowrap min-w-max">
              {/* Filter Tabs */}
              {filterTabs && filterTabs.length > 0 && filterTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleFilterChange(tab.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap touch-manipulation ${
                    activeFilter === tab.id
                      ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full ${
                      activeFilter === tab.id ? "bg-violet-200" : "bg-muted"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}

              {/* Separator between tabs and filters */}
              {filterTabs && filterTabs.length > 0 && (showSearch || showCategoryFilter || showPriorityFilter || showSort) && (
                <div className="w-px h-5 bg-slate-200 mx-1" />
              )}

              {/* Search */}
              {showSearch && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 w-36 text-xs border-slate-200 bg-slate-50 focus:bg-white focus:w-48 transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded">
                      <X className="h-3 w-3 text-slate-400" />
                    </button>
                  )}
                </div>
              )}

              {/* Category Filter */}
              {showCategoryFilter && derivedCategories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {derivedCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}

              {/* Priority Filter */}
              {showPriorityFilter && (
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 cursor-pointer"
                >
                  <option value="all">All Priorities</option>
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Normal">Normal</option>
                  <option value="Low">Low</option>
                </select>
              )}

              {/* Sort */}
              {showSort && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Value</option>
                  <option value="lowest">Lowest Value</option>
                  <option value="priority">By Priority</option>
                </select>
              )}

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-0.5 whitespace-nowrap touch-manipulation"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}

              {/* Count + View Toggle - pushed to the right */}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {filteredItems.length} of {items.length}
                </span>
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
                </div>
              </div>
            </div>
          </div>

        {/* Content Area - scrollable with sticky headers above */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {viewMode === "cards" ? (
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
                        <span className={`text-sm font-bold ${isSelected ? item.color.text : "text-gray-500"}`}>
                          {item.customerInitials}
                        </span>
                        {item.priority === "Urgent" && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-[8px] text-white font-bold">!</span>
                          </div>
                        )}
                      </div>
                      <span className={`text-xs mt-2 font-medium truncate max-w-[65px] ${isSelected ? "text-violet-700" : "text-foreground"}`}>
                        {item.customerName.split(" ")[0]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{item.status}</span>
                      <span className={`text-xs font-medium ${isSelected ? "text-slate-700" : "text-slate-500"}`}>
                        ${(item.estimatedValue || 0).toLocaleString()}
                      </span>
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
              {selectedItem && (
                <Card className="mt-4 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-slate-600 font-bold"
                          style={{
                            background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                            boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                          }}
                        >
                          {selectedItem.customerInitials}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{selectedItem.title}</h3>
                          <p className="text-sm text-muted-foreground">{selectedItem.category || "General"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(selectedItem.priority)}>{selectedItem.priority || "Normal"}</Badge>
                        <Badge className={getStatusColor(selectedItem.status)}>{selectedItem.status}</Badge>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      {onAccept && (
                        <Button className="flex-1 bg-green-500 hover:bg-green-600 h-11 touch-manipulation" onClick={() => onAccept(selectedItem)}>
                          <CheckCircle className="h-4 w-4 mr-2" /> Accept
                        </Button>
                      )}
                      {onSendQuote && (
                        <Button variant="outline" className="flex-1 h-11 touch-manipulation" onClick={() => onSendQuote(selectedItem)}>
                          <Send className="h-4 w-4 mr-2" /> Quote
                        </Button>
                      )}
                      {onSchedule && (
                        <Button variant="outline" className="flex-1 h-11 touch-manipulation" onClick={() => onSchedule(selectedItem)}>
                          <Calendar className="h-4 w-4 mr-2" /> Schedule
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Customer:</span>
                        <p className="font-medium">{selectedItem.customerName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value:</span>
                        <p className="font-bold text-slate-800">${(selectedItem.estimatedValue || 0).toLocaleString()}</p>
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
                    </div>
                    
                    {selectedItem.description && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-600">{selectedItem.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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
                      <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Category</th>
                      <th className="text-center px-3 py-2.5 font-medium">Priority</th>
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
                              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 text-xs font-bold shrink-0"
                              style={{
                                background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                              }}
                            >
                              {item.customerInitials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{item.customerName}</p>
                              <p className="text-xs text-muted-foreground truncate sm:hidden">{item.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <span className="text-muted-foreground">{item.category || "General"}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge className={`${getPriorityColor(item.priority)} text-[10px] px-1.5 py-0.5`}>
                            {item.priority || "Normal"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-medium text-slate-700">${(item.estimatedValue || 0).toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-3 text-center hidden md:table-cell">
                          <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {onAccept && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-50 touch-manipulation"
                                onClick={(e) => { e.stopPropagation(); onAccept(item); }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {onSendQuote && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 touch-manipulation"
                                onClick={(e) => { e.stopPropagation(); onSendQuote(item); }}
                              >
                                <Send className="h-4 w-4" />
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
                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                          {emptyIcon}
                          <p className="mt-2">{emptyMessage}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Quick Detail Panel for List View */}
              {selectedItem && viewMode === "list" && (
                <Card className="mt-4 border-violet-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 font-bold"
                          style={{
                            background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                            boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                          }}
                        >
                          {selectedItem.customerInitials}
                        </div>
                        <div>
                          <h4 className="font-semibold">{selectedItem.title}</h4>
                          <p className="text-xs text-muted-foreground">{selectedItem.customerName}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedItemId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{selectedItem.description || "No description provided"}</p>
                    <div className="flex gap-2">
                      {onAccept && (
                        <Button size="sm" className="bg-green-500 hover:bg-green-600 h-9 touch-manipulation" onClick={() => onAccept(selectedItem)}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Accept
                        </Button>
                      )}
                      {onSendQuote && (
                        <Button size="sm" variant="outline" className="h-9 touch-manipulation" onClick={() => onSendQuote(selectedItem)}>
                          <Send className="h-3 w-3 mr-1" /> Quote
                        </Button>
                      )}
                      {onSchedule && (
                        <Button size="sm" variant="outline" className="h-9 touch-manipulation" onClick={() => onSchedule(selectedItem)}>
                          <Calendar className="h-3 w-3 mr-1" /> Schedule
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
