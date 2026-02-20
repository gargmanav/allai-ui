import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, ArrowLeftRight, DollarSign, Calendar, MessageSquare, Building, Loader2, Bell } from "lucide-react";
import { format } from "date-fns";

interface CounterProposal {
  id: string;
  proposedTotal: string | null;
  proposedStartDate: string | null;
  proposedEndDate: string | null;
  scopeChanges: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  proposer: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface QuoteWithCounterProposal {
  id: string;
  title: string;
  total: string;
  availableStartDate: string | null;
  availableEndDate: string | null;
  status: string;
  case: {
    id: string;
    title: string;
    description: string;
    property: {
      name: string;
      streetAddress: string;
    } | null;
  } | null;
  counterProposals: CounterProposal[];
}

export default function PendingCounterProposals() {
  const { toast } = useToast();
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithCounterProposal | null>(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [counterDialogOpen, setCounterDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [counterForm, setCounterForm] = useState({
    proposedTotal: "",
    proposedStartDate: "",
    proposedEndDate: "",
    message: "",
  });

  const { data: pendingQuotes = [], isLoading } = useQuery<QuoteWithCounterProposal[]>({
    queryKey: ['/api/contractor/counter-proposals/pending'],
  });

  const acceptMutation = useMutation({
    mutationFn: (counterProposalId: string) =>
      apiRequest('POST', `/api/contractor/counter-proposals/${counterProposalId}/accept`),
    onSuccess: () => {
      toast({ title: "Counter-Proposal Accepted", description: "Your quote has been updated with the new terms." });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/counter-proposals/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      setAcceptDialogOpen(false);
      setSelectedQuote(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to accept counter-proposal.", variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: ({ counterProposalId, reason }: { counterProposalId: string; reason?: string }) =>
      apiRequest('POST', `/api/contractor/counter-proposals/${counterProposalId}/decline`, { reason }),
    onSuccess: () => {
      toast({ title: "Counter-Proposal Declined", description: "The landlord will be notified." });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/counter-proposals/pending'] });
      setDeclineDialogOpen(false);
      setSelectedQuote(null);
      setDeclineReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to decline counter-proposal.", variant: "destructive" });
    },
  });

  const counterMutation = useMutation({
    mutationFn: ({ counterProposalId, data }: { counterProposalId: string; data: any }) =>
      apiRequest('POST', `/api/contractor/counter-proposals/${counterProposalId}/counter`, data),
    onSuccess: () => {
      toast({ title: "Counter-Proposal Sent", description: "The landlord will be notified of your new terms." });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/counter-proposals/pending'] });
      setCounterDialogOpen(false);
      setSelectedQuote(null);
      setCounterForm({ proposedTotal: "", proposedStartDate: "", proposedEndDate: "", message: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send counter-proposal.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  // Filter to only quotes that actually have pending counter-proposals
  const quotesWithPendingCounters = pendingQuotes.filter(
    q => q.counterProposals && q.counterProposals.length > 0
  );

  if (quotesWithPendingCounters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold">Pending Counter-Proposals</h3>
        <Badge variant="secondary">{quotesWithPendingCounters.length}</Badge>
      </div>
      
      <div className="grid gap-4">
        {quotesWithPendingCounters.map((quote) => {
          const latestCounter = quote.counterProposals[0];
          if (!latestCounter) return null;
          
          return (
            <Card key={quote.id} className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{quote.case?.title || quote.title}</CardTitle>
                  <Badge variant="outline" className="text-yellow-700 border-yellow-500">
                    Counter-Proposal
                  </Badge>
                </div>
                {quote.case?.property && (
                  <CardDescription className="flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    {quote.case.property.name || quote.case.property.streetAddress}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Your Original Quote</p>
                    <p className="font-semibold text-lg">${parseFloat(quote.total).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Landlord's Counter</p>
                    <p className="font-semibold text-lg text-primary">
                      {latestCounter.proposedTotal 
                        ? `$${parseFloat(latestCounter.proposedTotal).toLocaleString()}`
                        : 'No price change'}
                    </p>
                  </div>
                </div>
                
                {(latestCounter.proposedStartDate || latestCounter.proposedEndDate) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Proposed dates: {latestCounter.proposedStartDate && format(new Date(latestCounter.proposedStartDate), 'MMM d')}
                      {latestCounter.proposedEndDate && ` - ${format(new Date(latestCounter.proposedEndDate), 'MMM d')}`}
                    </span>
                  </div>
                )}
                
                {latestCounter.message && (
                  <div className="bg-white dark:bg-gray-800 rounded-md p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-xs text-muted-foreground mb-1">
                          Message from {latestCounter.proposer?.firstName} {latestCounter.proposer?.lastName}
                        </p>
                        <p>{latestCounter.message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-2 pt-4 border-t">
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => { setSelectedQuote(quote); setAcceptDialogOpen(true); }}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Accept Terms
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
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept Counter-Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to accept the landlord's counter-proposal. Your quote will be updated with the new terms:
              {selectedQuote?.counterProposals[0]?.proposedTotal && (
                <span className="block font-medium mt-2">
                  New price: ${parseFloat(selectedQuote.counterProposals[0].proposedTotal).toLocaleString()}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedQuote?.counterProposals[0] && acceptMutation.mutate(selectedQuote.counterProposals[0].id)}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? 'Accepting...' : 'Accept Terms'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Counter-Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              Your original quote terms will remain. Optionally provide a reason:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for declining (optional)"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedQuote?.counterProposals[0] && declineMutation.mutate({
                counterProposalId: selectedQuote.counterProposals[0].id,
                reason: declineReason,
              })}
              disabled={declineMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {declineMutation.isPending ? 'Declining...' : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={counterDialogOpen} onOpenChange={setCounterDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Counter Their Counter-Proposal</DialogTitle>
            <DialogDescription>
              Propose new terms back to the landlord
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedQuote?.counterProposals[0] && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium">Their Counter-Proposal</p>
                <p className="text-lg font-bold">
                  {selectedQuote.counterProposals[0].proposedTotal 
                    ? `$${parseFloat(selectedQuote.counterProposals[0].proposedTotal).toLocaleString()}`
                    : `$${parseFloat(selectedQuote.total).toLocaleString()} (no change)`}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="proposedTotal">Your Proposed Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="proposedTotal"
                  type="number"
                  placeholder={selectedQuote?.total}
                  value={counterForm.proposedTotal}
                  onChange={(e) => setCounterForm({ ...counterForm, proposedTotal: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="proposedStartDate">Available Start</Label>
                <Input
                  id="proposedStartDate"
                  type="date"
                  value={counterForm.proposedStartDate}
                  onChange={(e) => setCounterForm({ ...counterForm, proposedStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposedEndDate">Available End</Label>
                <Input
                  id="proposedEndDate"
                  type="date"
                  value={counterForm.proposedEndDate}
                  onChange={(e) => setCounterForm({ ...counterForm, proposedEndDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message to Landlord</Label>
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
                if (selectedQuote?.counterProposals[0]) {
                  counterMutation.mutate({
                    counterProposalId: selectedQuote.counterProposals[0].id,
                    data: {
                      proposedTotal: counterForm.proposedTotal ? parseFloat(counterForm.proposedTotal) : null,
                      proposedStartDate: counterForm.proposedStartDate || null,
                      proposedEndDate: counterForm.proposedEndDate || null,
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
