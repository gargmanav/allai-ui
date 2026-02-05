import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Plus, FileText, DollarSign, Calendar, Send, Copy, Check, Trash2, Sparkles, ArrowRight, Clock, Search, SlidersHorizontal, TrendingUp, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type QuoteStatus = 'draft' | 'sent' | 'awaiting_response' | 'approved' | 'declined' | 'expired';

type Quote = {
  id: string;
  title: string;
  status: QuoteStatus;
  total: string;
  requiredDepositAmount: string;
  expiresAt: string | null;
  createdAt: string;
  customerId?: string;
  customer?: { name?: string; company?: string };
};

interface MayaRecommendation {
  type: "prioritize" | "followup" | "price" | "expiring";
  title: string;
  message: string;
  quoteId?: string;
}

export default function QuotesPage() {
  const [_, setLocation] = useLocation();
  const [filterStatus, setFilterStatus] = useState<'all' | QuoteStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [showMayaPanel, setShowMayaPanel] = useState(true);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
  const [approvalLink, setApprovalLink] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const { toast } = useToast();

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ['/api/contractor/quotes'],
  });

  const sendMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest('POST', `/api/contractor/quotes/${quoteId}/send`, {
        method: 'link',
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      setApprovalLink(data.approvalLink);
      setSendDialogOpen(true);
      toast({
        title: "Quote sent",
        description: "Quote status updated to awaiting response",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send quote",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest('DELETE', `/api/contractor/quotes/${quoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
      toast({
        title: "Quote deleted",
        description: "Quote has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete quote",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: QuoteStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'awaiting_response': return 'bg-amber-100 text-amber-700';
      case 'approved': return 'bg-emerald-100 text-emerald-700';
      case 'declined': return 'bg-red-100 text-red-700';
      case 'expired': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: QuoteStatus) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const filteredQuotes = useMemo(() => {
    let result = [...quotes];
    
    if (filterStatus !== 'all') {
      result = result.filter(q => q.status === filterStatus);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(q => 
        q.title.toLowerCase().includes(query) ||
        q.customer?.name?.toLowerCase().includes(query) ||
        q.customer?.company?.toLowerCase().includes(query)
      );
    }
    
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'highest': return parseFloat(b.total) - parseFloat(a.total);
        case 'lowest': return parseFloat(a.total) - parseFloat(b.total);
        default: return 0;
      }
    });
    
    return result;
  }, [quotes, filterStatus, searchQuery, sortBy]);

  const selectedQuote = useMemo(() => 
    filteredQuotes.find(q => q.id === selectedQuoteId),
    [filteredQuotes, selectedQuoteId]
  );

  const mayaRecommendations = useMemo<MayaRecommendation[]>(() => {
    if (quotes.length === 0) return [];
    
    const recommendations: MayaRecommendation[] = [];
    
    const highestValue = quotes.reduce((max, q) => 
      parseFloat(q.total) > parseFloat(max.total) ? q : max, quotes[0]);
    
    if (highestValue && parseFloat(highestValue.total) > 0) {
      recommendations.push({
        type: "prioritize",
        title: "Highest Value Quote",
        message: `"${highestValue.title}" is worth $${parseFloat(highestValue.total).toLocaleString()}. ${highestValue.status === 'draft' ? 'Consider sending it to the customer.' : ''}`,
        quoteId: highestValue.id,
      });
    }
    
    const drafts = quotes.filter(q => q.status === 'draft');
    if (drafts.length > 0) {
      recommendations.push({
        type: "followup",
        title: "Unsent Drafts",
        message: `You have ${drafts.length} draft quote${drafts.length > 1 ? 's' : ''} ready to send. Sending quotes promptly improves conversion rates.`,
      });
    }
    
    const expiringSoon = quotes.filter(q => {
      if (!q.expiresAt) return false;
      const expiryDate = new Date(q.expiresAt);
      const daysUntil = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntil > 0 && daysUntil <= 7 && q.status !== 'approved' && q.status !== 'declined';
    });
    
    if (expiringSoon.length > 0) {
      recommendations.push({
        type: "expiring",
        title: "Expiring Soon",
        message: `${expiringSoon.length} quote${expiringSoon.length > 1 ? 's expire' : ' expires'} within 7 days. Follow up with customers to increase approval chances.`,
      });
    }
    
    return recommendations.slice(0, 3);
  }, [quotes]);

  const handleFilterChange = (status: 'all' | QuoteStatus) => {
    setFilterStatus(status);
    setSelectedQuoteId(null);
    setShowMayaPanel(true);
  };

  const handleQuoteClick = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setShowMayaPanel(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(approvalLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Approval link copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleSendQuote = (quoteId: string) => {
    sendMutation.mutate(quoteId);
  };

  const handleDeleteClick = (quoteId: string) => {
    setQuoteToDelete(quoteId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (quoteToDelete) {
      deleteMutation.mutate(quoteToDelete);
    }
  };

  const colors = [
    { bg: "bg-blue-500", text: "text-blue-600" },
    { bg: "bg-emerald-500", text: "text-emerald-600" },
    { bg: "bg-violet-500", text: "text-violet-600" },
    { bg: "bg-orange-500", text: "text-orange-600" },
  ];

  const filterTabs = [
    { id: 'all' as const, label: 'All', count: quotes.length },
    { id: 'draft' as const, label: 'Draft', count: quotes.filter(q => q.status === 'draft').length },
    { id: 'sent' as const, label: 'Sent', count: quotes.filter(q => q.status === 'sent').length },
    { id: 'awaiting_response' as const, label: 'Awaiting', count: quotes.filter(q => q.status === 'awaiting_response').length },
    { id: 'approved' as const, label: 'Approved', count: quotes.filter(q => q.status === 'approved').length },
    { id: 'declined' as const, label: 'Declined', count: quotes.filter(q => q.status === 'declined').length },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Quotes" />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div 
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)",
            }}
          >
            <div>
              <h2 className="font-semibold text-xl">Quotes</h2>
              <p className="text-sm text-muted-foreground">Create and manage quotes for your customers</p>
            </div>
            <Button 
              onClick={() => setLocation('/quotes/new')} 
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full px-6"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          </div>

          <div className="px-6 py-3 border-b bg-muted/20 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {filterTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleFilterChange(tab.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                    filterStatus === tab.id
                      ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                      filterStatus === tab.id ? "bg-violet-200" : "bg-muted"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search quotes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48 h-9 rounded-full"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-3 text-sm rounded-full border bg-background"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Value</option>
                <option value="lowest">Lowest Value</option>
              </select>
            </div>
          </div>

          <div className="px-6 py-4 border-b bg-gradient-to-r from-muted/20 to-transparent">
            <div className="flex items-center gap-4 overflow-x-auto pb-2">
              <button
                onClick={() => { setShowMayaPanel(true); setSelectedQuoteId(null); }}
                className="flex flex-col items-center min-w-[80px] group"
              >
                <div 
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                    showMayaPanel ? "ring-2 ring-violet-400/70 scale-105" : "hover:scale-105"
                  }`}
                  style={{
                    background: showMayaPanel 
                      ? "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.35), rgba(167, 139, 250, 0.2) 50%, transparent 80%), linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(250,248,255,0.95))",
                    boxShadow: showMayaPanel 
                      ? "0 8px 24px rgba(139, 92, 246, 0.25), inset 0 2px 4px rgba(255,255,255,0.6)"
                      : "inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.06)",
                  }}
                >
                  <Sparkles className="h-6 w-6 text-violet-500" />
                </div>
                <span className={`text-xs mt-2 font-medium ${showMayaPanel ? "text-violet-600" : "text-foreground"}`}>Maya</span>
                <span className="text-[10px] text-muted-foreground">AI Advisor</span>
              </button>

              <div className="w-[2px] h-16 rounded-full" style={{
                background: "linear-gradient(180deg, transparent 0%, rgba(139, 92, 246, 0.3) 20%, rgba(139, 92, 246, 0.5) 50%, rgba(139, 92, 246, 0.3) 80%, transparent 100%)",
              }} />

              {filteredQuotes.map((quote, idx) => {
                const isSelected = selectedQuoteId === quote.id && !showMayaPanel;
                const color = colors[idx % colors.length];
                const customerName = quote.customer?.name || quote.customer?.company || quote.title;
                const initials = customerName.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
                
                return (
                  <button
                    key={`${quote.id}-${idx}`}
                    onClick={() => handleQuoteClick(quote.id)}
                    className="flex flex-col items-center min-w-[80px] group"
                  >
                    <div 
                      className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isSelected ? "ring-2 ring-gray-300/60 scale-105" : "hover:scale-105"
                      }`}
                      style={{
                        background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                        boxShadow: isSelected 
                          ? "0 6px 20px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.8)"
                          : "inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.06)",
                      }}
                    >
                      <span className={`text-sm font-bold ${isSelected ? color.text : "text-gray-500"}`}>
                        {initials}
                      </span>
                      {quote.status === 'draft' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center">
                          <span className="text-[8px] text-white font-bold">D</span>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs mt-2 font-medium truncate max-w-[70px] ${isSelected ? "text-gray-800" : "text-foreground"}`}>
                      {quote.title.split(" ")[0]}
                    </span>
                    <span className={`text-[10px] font-medium ${isSelected ? "text-green-600" : "text-muted-foreground"}`}>
                      ${parseFloat(quote.total).toLocaleString()}
                    </span>
                  </button>
                );
              })}

              {filteredQuotes.length === 0 && (
                <div className="text-sm text-muted-foreground px-4">
                  No quotes {filterStatus !== 'all' ? `with status "${getStatusLabel(filterStatus)}"` : "found"}
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 p-6">
            {showMayaPanel ? (
              <div className="space-y-4 max-w-2xl mx-auto">
                <Card className="border-violet-200/50 overflow-hidden" style={{
                  background: "linear-gradient(145deg, rgba(245,243,255,0.95) 0%, rgba(237,233,254,0.9) 100%)",
                }}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Maya AI Advisor</h3>
                        <p className="text-xs text-muted-foreground">Quote insights & recommendations</p>
                      </div>
                    </div>
                    
                    {mayaRecommendations.length > 0 ? (
                      <div className="space-y-3">
                        {mayaRecommendations.map((rec, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-white/70 border border-violet-100">
                            <div className="flex items-center gap-2 mb-1">
                              {rec.type === "prioritize" && <TrendingUp className="h-4 w-4 text-green-600" />}
                              {rec.type === "followup" && <AlertCircle className="h-4 w-4 text-orange-500" />}
                              {rec.type === "expiring" && <Clock className="h-4 w-4 text-red-500" />}
                              {rec.type === "price" && <DollarSign className="h-4 w-4 text-violet-500" />}
                              <span className="text-sm font-medium text-gray-800">{rec.title}</span>
                            </div>
                            <p className="text-sm text-gray-600">{rec.message}</p>
                            {rec.quoteId && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="mt-2 h-7 text-violet-600 hover:text-violet-700 hover:bg-violet-50 px-2"
                                onClick={() => handleQuoteClick(rec.quoteId!)}
                              >
                                View Quote <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">
                        {quotes.length === 0 
                          ? "No quotes to analyze yet. Create your first quote to get personalized recommendations."
                          : "Analyzing your quotes... I'll provide recommendations shortly."
                        }
                      </p>
                    )}
                  </CardContent>
                </Card>

                <div className="text-center text-sm text-muted-foreground py-4">
                  Select a quote from above to view details, or{" "}
                  <button 
                    onClick={() => setLocation('/quotes/new')}
                    className="text-violet-600 hover:underline font-medium"
                  >
                    create a new quote
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-gray-900">{quotes.filter(q => q.status === 'draft').length}</div>
                    <div className="text-sm text-muted-foreground">Drafts</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-green-600">${quotes.filter(q => q.status === 'approved').reduce((sum, q) => sum + parseFloat(q.total), 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Approved Value</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-amber-600">{quotes.filter(q => q.status === 'awaiting_response').length}</div>
                    <div className="text-sm text-muted-foreground">Awaiting Response</div>
                  </Card>
                </div>
              </div>
            ) : selectedQuote ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <Card className="overflow-hidden">
                  <div className="px-4 py-3 border-b" style={{
                    background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)",
                  }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{selectedQuote.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Created {format(new Date(selectedQuote.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge className={getStatusColor(selectedQuote.status)}>
                        {getStatusLabel(selectedQuote.status)}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-4 py-3 px-4 rounded-lg bg-muted/30">
                      {selectedQuote.status === 'draft' && (
                        <>
                          <Button 
                            className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600"
                            onClick={() => handleSendQuote(selectedQuote.id)}
                            disabled={sendMutation.isPending}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Quote
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => setLocation(`/quotes/${selectedQuote.id}`)}
                          >
                            Edit Quote
                          </Button>
                          <Button 
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteClick(selectedQuote.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {selectedQuote.status !== 'draft' && (
                        <Button 
                          className="flex-1"
                          variant="outline"
                          onClick={() => setLocation(`/quotes/${selectedQuote.id}`)}
                        >
                          View Full Details
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" /> Quote Summary
                      </h4>
                      <div className="rounded-lg bg-gradient-to-r from-emerald-50 to-green-50 p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Amount</span>
                          <span className="text-2xl font-bold text-gray-900">
                            ${parseFloat(selectedQuote.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {parseFloat(selectedQuote.requiredDepositAmount) > 0 && (
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-emerald-200">
                            <span className="text-sm text-gray-500">Required Deposit</span>
                            <span className="text-sm font-medium text-gray-700">
                              ${parseFloat(selectedQuote.requiredDepositAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedQuote.expiresAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Expires: {format(new Date(selectedQuote.expiresAt), 'MMMM d, yyyy')}</span>
                      </div>
                    )}

                    <div className="pt-3 border-t">
                      <Button 
                        variant="link" 
                        className="px-0 text-violet-600"
                        onClick={() => setLocation(`/quotes/${selectedQuote.id}`)}
                      >
                        View full quote with line items <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto opacity-50 mb-4" />
                <p>No quotes found</p>
              </div>
            )}
          </ScrollArea>
        </main>
      </div>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quote Sent Successfully!</DialogTitle>
            <DialogDescription>
              Copy the approval link below and share it with your customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={approvalLink}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-muted rounded border"
              />
              <Button size="sm" onClick={handleCopyLink}>
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Your customer can approve or decline the quote using this link.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setSendDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quote</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
