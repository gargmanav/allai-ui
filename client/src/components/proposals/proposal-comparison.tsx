import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, ArrowLeftRight, Loader2, DollarSign, Calendar, Clock, TrendingDown, Zap, ChevronRight, FileText, User, Phone, Mail } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Quote {
  id: string;
  contractor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  title: string;
  status: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  depositRequired: number;
  availableStartDate: string | null;
  availableEndDate: string | null;
  estimatedDays: number;
  scopeOfWork: string | null;
  clientMessage: string | null;
  lineItems: Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  hasCounterProposal: boolean;
  counterProposalCount: number;
  latestCounterProposal: any;
  createdAt: string;
  expiresAt: string | null;
}

interface ProposalComparisonProps {
  caseId: string;
  caseTitle: string;
  onClose?: () => void;
}

export default function ProposalComparison({ caseId, caseTitle, onClose }: ProposalComparisonProps) {
  const { toast } = useToast();
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [counterDialogOpen, setCounterDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [counterForm, setCounterForm] = useState({
    proposedTotal: "",
    proposedStartDate: "",
    proposedEndDate: "",
    scopeChanges: "",
    message: "",
  });

  const { data, isLoading, error } = useQuery<{
    caseId: string;
    caseTitle: string;
    caseStatus: string;
    quotes: Quote[];
  }>({
    queryKey: ['/api/landlord/cases', caseId, 'quotes'],
    queryFn: () => fetch(`/api/landlord/cases/${caseId}/quotes`).then(res => res.json()),
    enabled: !!caseId,
  });

  const quotes = data?.quotes || [];

  const { bestPrice, earliestAvailable } = useMemo(() => {
    if (quotes.length === 0) return { bestPrice: null, earliestAvailable: null };
    
    const activeQuotes = quotes.filter(q => q.status !== 'declined' && q.status !== 'expired');
    
    const bestPrice = activeQuotes.reduce((min, q) => 
      q.total < min.total ? q : min, activeQuotes[0]);
    
    const quotesWithDates = activeQuotes.filter(q => q.availableStartDate);
    const earliestAvailable = quotesWithDates.length > 0 
      ? quotesWithDates.reduce((earliest, q) => 
          new Date(q.availableStartDate!) < new Date(earliest.availableStartDate!) ? q : earliest, 
          quotesWithDates[0])
      : null;
    
    return { bestPrice, earliestAvailable };
  }, [quotes]);

  const getDateRange = useMemo(() => {
    const quotesWithDates = quotes.filter(q => q.availableStartDate);
    if (quotesWithDates.length === 0) return null;
    
    const allDates = quotesWithDates.flatMap(q => [
      new Date(q.availableStartDate!),
      q.availableEndDate ? new Date(q.availableEndDate) : new Date(q.availableStartDate!)
    ]);
    
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const totalDays = differenceInDays(maxDate, minDate) || 1;
    
    return { minDate, maxDate, totalDays };
  }, [quotes]);

  const acceptMutation = useMutation({
    mutationFn: (quoteId: string) => 
      apiRequest('POST', `/api/landlord/quotes/${quoteId}/accept`),
    onSuccess: () => {
      toast({ title: "Quote Accepted", description: "The contractor has been notified." });
      queryClient.invalidateQueries({ queryKey: ['/api/landlord/cases', caseId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      setAcceptDialogOpen(false);
      setSelectedQuote(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to accept quote.", variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: ({ quoteId, reason }: { quoteId: string; reason?: string }) => 
      apiRequest('POST', `/api/landlord/quotes/${quoteId}/decline`, { reason }),
    onSuccess: () => {
      toast({ title: "Quote Declined", description: "The contractor has been notified." });
      queryClient.invalidateQueries({ queryKey: ['/api/landlord/cases', caseId, 'quotes'] });
      setDeclineDialogOpen(false);
      setSelectedQuote(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to decline quote.", variant: "destructive" });
    },
  });

  const counterMutation = useMutation({
    mutationFn: ({ quoteId, data }: { quoteId: string; data: any }) => 
      apiRequest('POST', `/api/landlord/quotes/${quoteId}/counter`, data),
    onSuccess: () => {
      toast({ title: "Counter-Proposal Sent", description: "The contractor will be notified of your counter-offer." });
      queryClient.invalidateQueries({ queryKey: ['/api/landlord/cases', caseId, 'quotes'] });
      setCounterDialogOpen(false);
      setSelectedQuote(null);
      setCounterForm({ proposedTotal: "", proposedStartDate: "", proposedEndDate: "", scopeChanges: "", message: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send counter-proposal.", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      sent: { variant: "default", label: "Pending" },
      awaiting_response: { variant: "outline", label: "Countered" },
      approved: { variant: "default", label: "Accepted" },
      declined: { variant: "destructive", label: "Declined" },
      expired: { variant: "secondary", label: "Expired" },
    };
    const config = variants[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getAvailabilityBar = (quote: Quote) => {
    if (!quote.availableStartDate || !getDateRange) return null;
    
    const { minDate, totalDays } = getDateRange;
    const startDate = new Date(quote.availableStartDate);
    const endDate = quote.availableEndDate ? new Date(quote.availableEndDate) : startDate;
    
    const startOffset = (differenceInDays(startDate, minDate) / totalDays) * 100;
    const width = ((differenceInDays(endDate, startDate) || 1) / totalDays) * 100;
    
    const isEarliest = earliestAvailable?.id === quote.id;
    const barColor = isEarliest ? 'bg-green-500' : 'bg-blue-400';
    
    return (
      <div className="relative h-3 bg-muted rounded-full overflow-hidden w-32">
        <div 
          className={`absolute h-full ${barColor} rounded-full`}
          style={{ left: `${startOffset}%`, width: `${Math.max(width, 8)}%` }}
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading proposals...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Failed to load proposals.</p>
        </CardContent>
      </Card>
    );
  }

  if (quotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contractor Proposals</CardTitle>
          <CardDescription>Compare quotes from different contractors</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No proposals received yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Contractors will submit proposals after viewing your work order.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Compare Proposals</h2>
          <p className="text-sm text-muted-foreground">
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''} for "{caseTitle}"
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {getDateRange && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-2">
          <span>Availability timeline:</span>
          <div className="flex items-center gap-2">
            <span>{format(getDateRange.minDate, 'MMM d')}</span>
            <div className="w-32 h-1 bg-muted rounded" />
            <span>{format(getDateRange.maxDate, 'MMM d')}</span>
          </div>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Contractor</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead className="text-center">ETA</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const isBestPrice = bestPrice?.id === quote.id;
              const isEarliestAvailable = earliestAvailable?.id === quote.id;
              const isActive = quote.status === 'sent';
              
              return (
                <TableRow 
                  key={quote.id} 
                  className={`cursor-pointer hover:bg-muted/50 ${quote.status === 'approved' ? 'bg-green-50 dark:bg-green-950/20' : ''} ${quote.status === 'declined' ? 'opacity-50' : ''}`}
                  onClick={() => { setSelectedQuote(quote); setDetailSheetOpen(true); }}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {quote.contractor?.firstName} {quote.contractor?.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {quote.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-lg font-bold">
                        ${quote.total.toLocaleString()}
                      </span>
                      {isBestPrice && quote.status !== 'declined' && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50 dark:bg-green-950">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Best Price
                        </Badge>
                      )}
                      {quote.depositRequired > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ${quote.depositRequired} deposit
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {quote.availableStartDate ? (
                        <>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(quote.availableStartDate), 'MMM d')}
                            {quote.availableEndDate && (
                              <span> - {format(new Date(quote.availableEndDate), 'MMM d')}</span>
                            )}
                          </div>
                          {getAvailabilityBar(quote)}
                          {isEarliestAvailable && quote.status !== 'declined' && (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950 w-fit">
                              <Zap className="h-3 w-3 mr-1" />
                              Earliest
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not specified</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {quote.estimatedDays > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{quote.estimatedDays}d</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(quote.status)}
                    {quote.hasCounterProposal && (
                      <div className="mt-1">
                        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                          <ArrowLeftRight className="h-3 w-3 mr-1" />
                          Counter pending
                        </Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {isActive && (
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          size="sm" 
                          variant="default"
                          className="h-7 px-2"
                          onClick={() => { setSelectedQuote(quote); setAcceptDialogOpen(true); }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Accept
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => { setSelectedQuote(quote); setCounterDialogOpen(true); }}
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => { setSelectedQuote(quote); setDeclineDialogOpen(true); }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {quote.status === 'awaiting_response' && (
                      <span className="text-xs text-muted-foreground">Waiting...</span>
                    )}
                    {quote.status === 'approved' && (
                      <Badge variant="default" className="bg-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Accepted
                      </Badge>
                    )}
                    {!isActive && quote.status !== 'awaiting_response' && quote.status !== 'approved' && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-7"
                        onClick={() => { setSelectedQuote(quote); setDetailSheetOpen(true); }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {selectedQuote?.contractor?.firstName} {selectedQuote?.contractor?.lastName}
            </SheetTitle>
            <SheetDescription>{selectedQuote?.title}</SheetDescription>
          </SheetHeader>
          {selectedQuote && (
            <ScrollArea className="h-[calc(100vh-180px)] mt-4">
              <div className="space-y-6 pr-4">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">${selectedQuote.total.toLocaleString()}</span>
                  {getStatusBadge(selectedQuote.status)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Availability</p>
                    <p className="font-medium">
                      {selectedQuote.availableStartDate 
                        ? format(new Date(selectedQuote.availableStartDate), 'MMM d, yyyy')
                        : 'Not specified'}
                      {selectedQuote.availableEndDate && (
                        <span> - {format(new Date(selectedQuote.availableEndDate), 'MMM d')}</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Estimated Duration</p>
                    <p className="font-medium">
                      {selectedQuote.estimatedDays > 0 ? `${selectedQuote.estimatedDays} days` : 'Not specified'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Deposit Required</p>
                    <p className="font-medium">
                      {selectedQuote.depositRequired > 0 ? `$${selectedQuote.depositRequired}` : 'None'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Subtotal / Tax</p>
                    <p className="font-medium">
                      ${selectedQuote.subtotal} + ${selectedQuote.taxAmount} tax
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Contact</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedQuote.contractor?.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedQuote.contractor?.phone || 'No phone'}</span>
                    </div>
                  </div>
                </div>

                {selectedQuote.scopeOfWork && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Scope of Work</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedQuote.scopeOfWork}
                      </p>
                    </div>
                  </>
                )}

                {selectedQuote.lineItems.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Line Items</h4>
                      <div className="space-y-2">
                        {selectedQuote.lineItems.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm py-2 border-b last:border-0">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} × ${item.unitPrice}
                              </p>
                            </div>
                            <span className="font-medium">${item.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedQuote.hasCounterProposal && selectedQuote.latestCounterProposal && (
                  <>
                    <Separator />
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4" />
                        Counter-Proposal History
                      </h4>
                      <div className="text-sm space-y-1">
                        <p>Proposed: ${selectedQuote.latestCounterProposal.proposedTotal}</p>
                        {selectedQuote.latestCounterProposal.message && (
                          <p className="text-muted-foreground">"{selectedQuote.latestCounterProposal.message}"</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {selectedQuote.status === 'sent' && (
                  <div className="flex gap-2 pt-4">
                    <Button 
                      className="flex-1"
                      onClick={() => { setDetailSheetOpen(false); setAcceptDialogOpen(true); }}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => { setDetailSheetOpen(false); setCounterDialogOpen(true); }}
                    >
                      <ArrowLeftRight className="h-4 w-4 mr-1" />
                      Counter
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => { setDetailSheetOpen(false); setDeclineDialogOpen(true); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to accept the proposal from {selectedQuote?.contractor?.firstName} {selectedQuote?.contractor?.lastName} for ${selectedQuote?.total.toLocaleString()}.
              This will automatically decline all other proposals for this work order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedQuote && acceptMutation.mutate(selectedQuote.id)}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? 'Accepting...' : 'Accept Proposal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline the proposal from {selectedQuote?.contractor?.firstName} {selectedQuote?.contractor?.lastName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedQuote && declineMutation.mutate({ quoteId: selectedQuote.id })}
              disabled={declineMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {declineMutation.isPending ? 'Declining...' : 'Decline Proposal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={counterDialogOpen} onOpenChange={setCounterDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Counter-Proposal</DialogTitle>
            <DialogDescription>
              Propose new terms to {selectedQuote?.contractor?.firstName} {selectedQuote?.contractor?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-medium">Original Quote</p>
              <p className="text-lg font-bold">${selectedQuote?.total.toLocaleString()}</p>
              {selectedQuote?.availableStartDate && (
                <p className="text-muted-foreground">
                  Available: {format(new Date(selectedQuote.availableStartDate), 'MMM d, yyyy')}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="proposedTotal">Your Proposed Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="proposedTotal"
                  type="number"
                  placeholder={selectedQuote?.total.toString()}
                  value={counterForm.proposedTotal}
                  onChange={(e) => setCounterForm({ ...counterForm, proposedTotal: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="proposedStartDate">Preferred Start</Label>
                <Input
                  id="proposedStartDate"
                  type="date"
                  value={counterForm.proposedStartDate}
                  onChange={(e) => setCounterForm({ ...counterForm, proposedStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposedEndDate">Preferred End</Label>
                <Input
                  id="proposedEndDate"
                  type="date"
                  value={counterForm.proposedEndDate}
                  onChange={(e) => setCounterForm({ ...counterForm, proposedEndDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message to Contractor</Label>
              <Textarea
                id="message"
                placeholder="Explain your counter-proposal..."
                value={counterForm.message}
                onChange={(e) => setCounterForm({ ...counterForm, message: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedQuote) {
                  counterMutation.mutate({
                    quoteId: selectedQuote.id,
                    data: {
                      proposedTotal: counterForm.proposedTotal ? parseFloat(counterForm.proposedTotal) : null,
                      proposedStartDate: counterForm.proposedStartDate || null,
                      proposedEndDate: counterForm.proposedEndDate || null,
                      scopeChanges: counterForm.scopeChanges || null,
                      message: counterForm.message || null,
                    },
                  });
                }
              }}
              disabled={counterMutation.isPending}
            >
              {counterMutation.isPending ? 'Sending...' : 'Send Counter-Proposal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
