import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Sparkles, CheckCircle, Calendar, DollarSign, Clock, ArrowRight, Send, MapPin, User, Phone, FileText, Search, X } from "lucide-react";

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
  const [showMayaPanel, setShowMayaPanel] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [internalFilter, setInternalFilter] = useState<string>(externalActiveFilter || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  
  const activeFilter = externalActiveFilter ?? internalFilter;
  
  const handleFilterChange = (filterId: string) => {
    setInternalFilter(filterId);
    setSelectedItemId(null);
    setShowMayaPanel(true);
    onFilterChange?.(filterId);
  };
  
  const clearAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setInternalFilter("all");
    setSelectedItemId(null);
    setShowMayaPanel(true);
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
    setShowMayaPanel(false);
    onItemSelect(item);
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "Urgent": return "bg-red-100 text-red-700 border-red-200";
      case "High": return "bg-orange-100 text-orange-700 border-orange-200";
      case "Normal": return "bg-blue-100 text-blue-700 border-blue-200";
      case "Low": return "bg-gray-100 text-gray-600 border-gray-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New": case "Submitted": return "bg-blue-100 text-blue-700";
      case "In Progress": case "Active": return "bg-green-100 text-green-700";
      case "Scheduled": return "bg-purple-100 text-purple-700";
      case "Draft": return "bg-gray-100 text-gray-600";
      case "Sent": return "bg-amber-100 text-amber-700";
      case "Approved": return "bg-emerald-100 text-emerald-700";
      case "Declined": case "Expired": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div 
        className="px-4 sm:px-6 py-3 sm:py-4 border-b"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)",
          backdropFilter: "blur(24px) saturate(180%)",
        }}
      >
        <h2 className="font-semibold text-lg sm:text-xl">{title}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {filterTabs && filterTabs.length > 0 && (
        <div className="px-3 sm:px-6 py-2 sm:py-3 border-b bg-muted/20 overflow-x-auto">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap min-w-max sm:min-w-0">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-full transition-all whitespace-nowrap touch-manipulation ${
                  activeFilter === tab.id
                    ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 sm:ml-1.5 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full ${
                    activeFilter === tab.id ? "bg-violet-200" : "bg-muted"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {(showSearch || showCategoryFilter || showPriorityFilter || showSort) && (
        <div className="px-3 sm:px-6 py-2 border-b bg-muted/10 flex items-center gap-2 sm:gap-3 flex-wrap">
          {showSearch && (
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-48 h-9 sm:h-8 text-sm rounded-full"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-4 w-4 sm:h-3 sm:w-3" />
                </button>
              )}
            </div>
          )}
          
          {showCategoryFilter && derivedCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm rounded-full border bg-background touch-manipulation"
            >
              <option value="all">Category</option>
              {derivedCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
          
          {showPriorityFilter && (
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm rounded-full border bg-background touch-manipulation"
            >
              <option value="all">Priority</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          )}
          
          {showSort && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm rounded-full border bg-background touch-manipulation"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest $</option>
              <option value="lowest">Lowest $</option>
              <option value="priority">Priority</option>
            </select>
          )}
          
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs sm:text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1 p-1 touch-manipulation"
            >
              <X className="h-3 w-3" />
              <span className="hidden sm:inline">Clear filters</span>
              <span className="sm:hidden">Clear</span>
            </button>
          )}
          
          <div className="ml-auto text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            {filteredItems.length}/{items.length}
          </div>
        </div>
      )}

      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-muted/20 to-transparent">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          <button
            onClick={() => { setShowMayaPanel(true); setSelectedItemId(null); }}
            className="flex flex-col items-center min-w-[60px] sm:min-w-[80px] group touch-manipulation"
          >
            <div 
              className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                showMayaPanel 
                  ? "ring-2 ring-violet-400/70 scale-105" 
                  : "hover:scale-105 group-hover:ring-2 group-hover:ring-violet-300/50"
              }`}
              style={{
                background: showMayaPanel 
                  ? "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.35), rgba(167, 139, 250, 0.2) 50%, transparent 80%), linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))"
                  : "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.8), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(250,248,255,0.95))",
                backdropFilter: "blur(48px) saturate(180%)",
                boxShadow: showMayaPanel 
                  ? "0 8px 24px rgba(139, 92, 246, 0.25), inset 0 2px 4px rgba(255,255,255,0.6)"
                  : "inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.06)",
              }}
            >
              <Sparkles 
                className="h-5 w-5 sm:h-6 sm:w-6 text-violet-500" 
                style={{ animation: "spin 8s linear infinite" }}
              />
            </div>
            <span className={`text-[10px] sm:text-xs mt-1 sm:mt-2 font-medium ${showMayaPanel ? "text-violet-600" : "text-foreground"}`}>Maya</span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:block">AI Advisor</span>
          </button>

          <div className="relative flex items-center justify-center px-2">
            <div 
              className="w-[2px] h-16 rounded-full"
              style={{
                background: "linear-gradient(180deg, transparent 0%, rgba(139, 92, 246, 0.3) 20%, rgba(139, 92, 246, 0.5) 50%, rgba(139, 92, 246, 0.3) 80%, transparent 100%)",
                boxShadow: "0 0 8px rgba(139, 92, 246, 0.2)",
              }}
            />
          </div>

          {filteredItems.map((item, idx) => {
            const isSelected = selectedItemId === item.id && !showMayaPanel;
            return (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => handleItemClick(item)}
                className="flex flex-col items-center min-w-[60px] sm:min-w-[80px] group touch-manipulation"
              >
                <div 
                  className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isSelected ? "ring-2 ring-gray-300/60 scale-105" : "hover:scale-105"
                  }`}
                  style={{
                    background: isSelected 
                      ? `linear-gradient(180deg, rgba(255,255,255,0.95), rgba(240,240,245,0.9))`
                      : "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.8), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                    backdropFilter: "blur(48px) saturate(180%)",
                    boxShadow: isSelected 
                      ? "0 6px 20px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.8)"
                      : "inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.06)",
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
                <span className={`text-[10px] sm:text-xs mt-1 sm:mt-2 font-medium truncate max-w-[55px] sm:max-w-[70px] ${isSelected ? "text-gray-800" : "text-foreground"}`}>
                  {item.customerName.split(" ")[0]}
                </span>
                <span className={`text-[9px] sm:text-[10px] font-medium ${isSelected ? "text-green-600" : "text-muted-foreground"}`}>
                  ${(item.estimatedValue || 0).toLocaleString()}
                </span>
              </button>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="text-sm text-muted-foreground px-4">
              No {itemType}s {activeFilter !== "all" ? `with status "${activeFilter}"` : "available"}
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-3 sm:p-6">
        {showMayaPanel ? (
          <div className="space-y-4">
            <Card 
              className="border-violet-200/50 overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(245,243,255,0.95) 0%, rgba(237,233,254,0.9) 100%)",
              }}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Maya AI Advisor</h3>
                    <p className="text-xs text-muted-foreground">Personalized recommendations</p>
                  </div>
                </div>
                
                {mayaRecommendations.length > 0 ? (
                  <div className="space-y-3">
                    {mayaRecommendations.map((rec, idx) => (
                      <div 
                        key={idx}
                        className="p-3 rounded-lg bg-white/70 border border-violet-100"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {rec.type === "prioritize" && <DollarSign className="h-4 w-4 text-green-600" />}
                          {rec.type === "followup" && <Clock className="h-4 w-4 text-orange-500" />}
                          {rec.type === "schedule" && <Calendar className="h-4 w-4 text-blue-500" />}
                          {rec.type === "price" && <DollarSign className="h-4 w-4 text-violet-500" />}
                          <span className="text-sm font-medium text-gray-800">{rec.title}</span>
                        </div>
                        <p className="text-sm text-gray-600">{rec.message}</p>
                        {rec.itemId && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="mt-2 h-7 text-violet-600 hover:text-violet-700 hover:bg-violet-50 px-2"
                            onClick={() => {
                              const item = items.find(i => i.id === rec.itemId);
                              if (item) handleItemClick(item);
                            }}
                          >
                            View Details <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    {items.length === 0 
                      ? `No ${itemType}s to analyze yet. New ${itemType}s will appear here with personalized recommendations.`
                      : `Analyzing your ${itemType}s... I'll provide recommendations shortly.`
                    }
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground py-4">
              Select a {itemType} from above to view details
            </div>
          </div>
        ) : selectedItem ? (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div 
                className="px-4 py-3 border-b"
                style={{
                  background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${selectedItem.color.bg} flex items-center justify-center text-white font-bold text-lg`}>
                      {selectedItem.customerInitials}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{selectedItem.title}</h3>
                      <p className="text-sm text-muted-foreground">{selectedItem.category || "General Maintenance"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(selectedItem.priority)}>{selectedItem.priority || "Normal"}</Badge>
                    <Badge className={getStatusColor(selectedItem.status)}>{selectedItem.status}</Badge>
                  </div>
                </div>
              </div>

              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-6 py-3 px-4 rounded-lg bg-muted/30">
                  {onAccept && (
                    <Button 
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                      onClick={() => onAccept(selectedItem)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept Job
                    </Button>
                  )}
                  {onSendQuote && (
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => onSendQuote(selectedItem)}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Quote
                    </Button>
                  )}
                  {onSchedule && (
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => onSchedule(selectedItem)}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule
                    </Button>
                  )}
                </div>

                {itemType === "quote" ? (
                  <>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <User className="h-4 w-4" /> Customer
                      </h4>
                      <p className="text-sm font-medium">{selectedItem.customerName}</p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Quote Summary
                      </h4>
                      {selectedItem.lineItems && selectedItem.lineItems.length > 0 ? (
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium">Description</th>
                                <th className="text-right px-3 py-2 font-medium">Qty</th>
                                <th className="text-right px-3 py-2 font-medium">Rate</th>
                                <th className="text-right px-3 py-2 font-medium">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedItem.lineItems.map((item, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="px-3 py-2">{item.description}</td>
                                  <td className="text-right px-3 py-2">{item.quantity}</td>
                                  <td className="text-right px-3 py-2">${item.rate.toFixed(2)}</td>
                                  <td className="text-right px-3 py-2">${item.amount.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Click to view full quote details with line items
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-3 border-t">
                      <div className="w-48 space-y-1 text-sm">
                        {selectedItem.subtotal !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>${selectedItem.subtotal.toLocaleString()}</span>
                          </div>
                        )}
                        {selectedItem.taxAmount !== undefined && selectedItem.taxAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax:</span>
                            <span>${selectedItem.taxAmount.toLocaleString()}</span>
                          </div>
                        )}
                        {selectedItem.total !== undefined && (
                          <div className="flex justify-between font-bold text-base pt-1 border-t">
                            <span>Total:</span>
                            <span className="text-green-600">${selectedItem.total.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedItem.expiresAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Expires: {new Date(selectedItem.expiresAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <User className="h-4 w-4" /> Customer Details
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Name:</span>
                            <span className="font-medium">{selectedItem.customerName}</span>
                          </div>
                          {selectedItem.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span>{selectedItem.phone}</span>
                            </div>
                          )}
                          {selectedItem.address && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{selectedItem.address}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <FileText className="h-4 w-4" /> Job Details
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Estimated Value:</span>
                            <span className="font-bold text-green-600">${(selectedItem.estimatedValue || 0).toLocaleString()}</span>
                          </div>
                          {selectedItem.scheduledDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{selectedItem.scheduledDate}</span>
                            </div>
                          )}
                          {selectedItem.createdAt && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>Created: {selectedItem.createdAt}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedItem.description && (
                      <div className="pt-3 border-t">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                        <p className="text-sm text-gray-600">{selectedItem.description}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {emptyIcon}
            <p className="mt-4">{emptyMessage}</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
