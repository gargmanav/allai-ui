import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Check, X, MessageSquare, Calendar, DollarSign, Clock, User, FileText, ArrowLeftRight, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
      sent: { variant: "default", label: "Pending Review" },
      awaiting_response: { variant: "outline", label: "Counter Pending" },
      approved: { variant: "default", label: "Accepted" },
      declined: { variant: "destructive", label: "Declined" },
      expired: { variant: "secondary", label: "Expired" },
    };
    const config = variants[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  const quotes = data.quotes || [];

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
            Contractors will submit proposals after viewing your work order in the marketplace.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Compare Proposals</h2>
          <p className="text-sm text-muted-foreground">
            {quotes.length} proposal{quotes.length !== 1 ? 's' : ''} received for "{caseTitle}"
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quotes.map((quote, index) => (
          <Card key={quote.id} className={`relative ${quote.status === 'approved' ? 'ring-2 ring-green-500' : ''}`}>
            {quote.status === 'approved' && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                <Check className="h-4 w-4" />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {quote.contractor?.firstName} {quote.contractor?.lastName}
                </CardTitle>
                {getStatusBadge(quote.status)}
              </div>
              <CardDescription className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {quote.contractor?.email || 'No email'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-primary">
                  ${quote.total.toLocaleString()}
                </span>
                {quote.depositRequired > 0 && (
                  <Badge variant="outline" className="text-xs">
                    ${quote.depositRequired} deposit
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {quote.availableStartDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Available: {format(new Date(quote.availableStartDate), 'MMM d')}
                      {quote.availableEndDate && ` - ${format(new Date(quote.availableEndDate), 'MMM d')}`}
                    </span>
                  </div>
                )}
                {quote.estimatedDays > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{quote.estimatedDays} day{quote.estimatedDays !== 1 ? 's' : ''} estimated</span>
                  </div>
                )}
              </div>

              {quote.scopeOfWork && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Scope of Work:</p>
                  <p className="text-muted-foreground line-clamp-2">{quote.scopeOfWork}</p>
                </div>
              )}

              {quote.lineItems.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Line Items:</p>
                  <ul className="text-muted-foreground space-y-1">
                    {quote.lineItems.slice(0, 3).map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span className="truncate">{item.name}</span>
                        <span>${item.total}</span>
                      </li>
                    ))}
                    {quote.lineItems.length > 3 && (
                      <li className="text-xs">+ {quote.lineItems.length - 3} more items</li>
                    )}
                  </ul>
                </div>
              )}

              {quote.hasCounterProposal && quote.latestCounterProposal && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md text-sm">
                  <div className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400">
                    <ArrowLeftRight className="h-4 w-4" />
                    <span className="font-medium">Counter-proposal pending</span>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2 pt-4 border-t">
              {quote.status === 'sent' && (
                <>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => { setSelectedQuote(quote); setAcceptDialogOpen(true); }}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setSelectedQuote(quote); setCounterDialogOpen(true); }}
                  >
                    <ArrowLeftRight className="h-4 w-4 mr-1" />
                    Counter
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setSelectedQuote(quote); setDeclineDialogOpen(true); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
              {quote.status === 'awaiting_response' && (
                <p className="text-sm text-muted-foreground">Waiting for contractor response...</p>
              )}
              {quote.status === 'approved' && (
                <Badge variant="default" className="w-full justify-center py-2">
                  <Check className="h-4 w-4 mr-1" />
                  Accepted
                </Badge>
              )}
              {quote.status === 'declined' && (
                <Badge variant="secondary" className="w-full justify-center py-2">
                  Declined
                </Badge>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

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
