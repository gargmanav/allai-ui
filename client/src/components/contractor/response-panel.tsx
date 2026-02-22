import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, Stethoscope, HelpCircle, X, Loader2, ArrowLeft, Send, Clock } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ResponsePanelProps {
  caseId: string;
  caseTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: ResponseMode;
}

type ResponseMode = null | "quote" | "diagnostic" | "need_info" | "pass";

export function ContractorResponsePanel({ caseId, caseTitle, onClose, onSuccess, initialMode = null }: ResponsePanelProps) {
  const [mode, setMode] = useState<ResponseMode>(initialMode);
  const { toast } = useToast();

  const quoteMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contractor/respond/quote", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.autoApproved ? "Quote Auto-Approved" : "Quote Submitted",
        description: data.autoApproved 
          ? "Your quote was auto-approved. The job is confirmed!"
          : "Your quote has been sent to the landlord for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor"] });
      onSuccess?.();
      onClose();
    },
    onError: () => { toast({ title: "Error", description: "Failed to submit quote", variant: "destructive" }); },
  });

  const diagnosticMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contractor/respond/diagnostic", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Diagnostic Visit Requested", description: "The landlord will review and approve your visit request." });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor"] });
      onSuccess?.();
      onClose();
    },
    onError: () => { toast({ title: "Error", description: "Failed to submit request", variant: "destructive" }); },
  });

  const needInfoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contractor/respond/need-info", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Questions Sent", description: "Your questions have been sent to the property owner." });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor"] });
      onSuccess?.();
      onClose();
    },
    onError: () => { toast({ title: "Error", description: "Failed to send questions", variant: "destructive" }); },
  });

  const passMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contractor/respond/pass", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Request Declined", description: data.needsReassignment ? "Multiple contractors have passed. The landlord will be notified." : "You've passed on this request." });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor"] });
      onSuccess?.();
      onClose();
    },
    onError: () => { toast({ title: "Error", description: "Failed to decline", variant: "destructive" }); },
  });

  const isSubmitting = quoteMutation.isPending || diagnosticMutation.isPending || needInfoMutation.isPending || passMutation.isPending;

  if (!mode) {
    return (
      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50/50 to-white">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">How would you like to respond?</h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">{caseTitle}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-1.5 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all"
              onClick={() => setMode("quote")}
            >
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">Send Quote</span>
              <span className="text-[10px] text-muted-foreground">Price + Availability</span>
            </Button>
            <Button 
              variant="outline"
              className="h-20 flex flex-col gap-1.5 border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all"
              onClick={() => setMode("diagnostic")}
            >
              <Stethoscope className="h-5 w-5 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Diagnostic Visit</span>
              <span className="text-[10px] text-muted-foreground">Site visit + Fee</span>
            </Button>
            <Button 
              variant="outline"
              className="h-20 flex flex-col gap-1.5 border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition-all"
              onClick={() => setMode("need_info")}
            >
              <HelpCircle className="h-5 w-5 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">Need More Info</span>
              <span className="text-[10px] text-muted-foreground">Ask questions first</span>
            </Button>
            <Button 
              variant="outline"
              className="h-20 flex flex-col gap-1.5 border-red-200 hover:bg-red-50 hover:border-red-300 transition-all"
              onClick={() => setMode("pass")}
            >
              <X className="h-5 w-5 text-red-500" />
              <span className="text-xs font-medium text-red-600">Pass</span>
              <span className="text-[10px] text-muted-foreground">Decline this job</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50/50 to-white">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMode(null)} disabled={isSubmitting}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold text-sm flex-1">
            {mode === "quote" && "Send Quote + Availability"}
            {mode === "diagnostic" && "Request Diagnostic Visit"}
            {mode === "need_info" && "Ask for More Information"}
            {mode === "pass" && "Decline This Request"}
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} disabled={isSubmitting}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {mode === "quote" && (
          <QuoteForm 
            caseId={caseId}
            onSubmit={(data) => quoteMutation.mutate(data)} 
            isPending={quoteMutation.isPending} 
          />
        )}
        {mode === "diagnostic" && (
          <DiagnosticForm 
            caseId={caseId}
            onSubmit={(data) => diagnosticMutation.mutate(data)} 
            isPending={diagnosticMutation.isPending} 
          />
        )}
        {mode === "need_info" && (
          <NeedInfoForm 
            caseId={caseId}
            onSubmit={(data) => needInfoMutation.mutate(data)} 
            isPending={needInfoMutation.isPending} 
          />
        )}
        {mode === "pass" && (
          <PassForm 
            caseId={caseId}
            onSubmit={(data) => passMutation.mutate(data)} 
            isPending={passMutation.isPending} 
          />
        )}
      </CardContent>
    </Card>
  );
}

function QuoteForm({ caseId, onSubmit, isPending }: { caseId: string; onSubmit: (data: any) => void; isPending: boolean }) {
  const [price, setPrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Quoted Price *</Label>
        <div className="relative mt-1">
          <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="pl-8 h-9"
            step="0.01"
            min="0"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs font-medium">Available From</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 mt-1 text-xs" />
        </div>
        <div>
          <Label className="text-xs font-medium">Available Until</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 mt-1 text-xs" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium">Estimated Days to Complete</Label>
        <Input type="number" placeholder="1" value={days} onChange={(e) => setDays(e.target.value)} className="h-9 mt-1" min="1" />
      </div>
      <div>
        <Label className="text-xs font-medium">Notes (optional)</Label>
        <Textarea placeholder="Any additional details..." value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-[60px] text-xs" />
      </div>
      <Button 
        className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={() => onSubmit({ caseId, quotedPrice: parseFloat(price), availableStartDate: startDate || undefined, availableEndDate: endDate || undefined, estimatedDays: days ? parseInt(days) : undefined, notes: notes || undefined })}
        disabled={!price || isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        Submit Quote
      </Button>
    </div>
  );
}

function DiagnosticForm({ caseId, onSubmit, isPending }: { caseId: string; onSubmit: (data: any) => void; isPending: boolean }) {
  const [fee, setFee] = useState("");
  const [noFee, setNoFee] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [turnaround, setTurnaround] = useState("3");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Diagnostic Visit Fee</Label>
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant={noFee ? "default" : "outline"}
            size="sm"
            className={`h-8 text-xs ${noFee ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
            onClick={() => { setNoFee(true); setFee(""); }}
          >
            No Fee
          </Button>
          <Button
            variant={!noFee ? "default" : "outline"}
            size="sm"
            className={`h-8 text-xs ${!noFee ? "bg-blue-600 hover:bg-blue-700" : ""}`}
            onClick={() => setNoFee(false)}
          >
            Flat Fee
          </Button>
        </div>
        {!noFee && (
          <div className="relative mt-2">
            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              placeholder="75.00"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="pl-8 h-9"
              step="0.01"
              min="0"
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs font-medium">Available From *</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 mt-1 text-xs" />
        </div>
        <div>
          <Label className="text-xs font-medium">Available Until</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 mt-1 text-xs" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Quote Turnaround After Visit
        </Label>
        <Select value={turnaround} onValueChange={setTurnaround}>
          <SelectTrigger className="h-9 mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 business days (standard)</SelectItem>
            <SelectItem value="5">5 business days</SelectItem>
            <SelectItem value="10">10 business days (complex job)</SelectItem>
            <SelectItem value="15">15 business days</SelectItem>
            <SelectItem value="20">20 business days</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground mt-1">How long after the visit you'll need to prepare the repair quote</p>
      </div>
      <div>
        <Label className="text-xs font-medium">Notes (optional)</Label>
        <Textarea placeholder="What you need to assess, tools needed, etc." value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-[60px] text-xs" />
      </div>
      <Button
        className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => onSubmit({ caseId, diagnosticFee: noFee ? "0" : fee, availableStartDate: startDate || undefined, availableEndDate: endDate || undefined, quoteTurnaroundDays: parseInt(turnaround), notes: notes || undefined })}
        disabled={(!noFee && !fee) || !startDate || isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Stethoscope className="h-4 w-4 mr-2" />}
        Request Diagnostic Visit
      </Button>
    </div>
  );
}

function NeedInfoForm({ caseId, onSubmit, isPending }: { caseId: string; onSubmit: (data: any) => void; isPending: boolean }) {
  const [questions, setQuestions] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");

  const addQuestion = () => {
    if (questions.length < 3) {
      setQuestions([...questions, ""]);
    }
  };

  const updateQuestion = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const validQuestions = questions.filter(q => q.trim().length > 0);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Questions (up to 3)</Label>
        <div className="space-y-2 mt-1">
          {questions.map((q, i) => (
            <div key={i} className="flex gap-1.5">
              <Badge variant="outline" className="h-9 w-7 flex items-center justify-center shrink-0 text-xs">
                {i + 1}
              </Badge>
              <Input
                placeholder={i === 0 ? "e.g., Can you share a closer photo of the leak?" : "Another question..."}
                value={q}
                onChange={(e) => updateQuestion(i, e.target.value)}
                className="h-9 text-xs flex-1"
              />
              {questions.length > 1 && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-red-400 hover:text-red-600" onClick={() => removeQuestion(i)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {questions.length < 3 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs mt-1 text-amber-600 hover:text-amber-700" onClick={addQuestion}>
            + Add another question
          </Button>
        )}
      </div>
      <div>
        <Label className="text-xs font-medium">Additional Notes (optional)</Label>
        <Textarea placeholder="Any context or media requests..." value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-[50px] text-xs" />
      </div>
      <p className="text-[10px] text-muted-foreground bg-amber-50 rounded p-2">
        Your questions will be sent to the property owner/landlord. They can answer directly or forward to the tenant.
      </p>
      <Button
        className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white"
        onClick={() => onSubmit({ caseId, questions: validQuestions, notes: notes || undefined })}
        disabled={validQuestions.length === 0 || isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HelpCircle className="h-4 w-4 mr-2" />}
        Send Questions
      </Button>
    </div>
  );
}

function PassForm({ caseId, onSubmit, isPending }: { caseId: string; onSubmit: (data: any) => void; isPending: boolean }) {
  const [reason, setReason] = useState("");
  const [selectedReason, setSelectedReason] = useState("");

  const quickReasons = [
    "Not in my service area",
    "Schedule is fully booked",
    "Outside my specialty",
    "Job is too small",
    "Job is too complex",
  ];

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Why are you passing? (optional)</Label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {quickReasons.map((r) => (
            <Badge
              key={r}
              variant={selectedReason === r ? "default" : "outline"}
              className={`cursor-pointer text-[10px] transition-all ${selectedReason === r ? "bg-red-100 text-red-700 border-red-300" : "hover:bg-red-50"}`}
              onClick={() => { setSelectedReason(selectedReason === r ? "" : r); setReason(selectedReason === r ? "" : r); }}
            >
              {r}
            </Badge>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium">Or add a custom reason</Label>
        <Textarea 
          placeholder="Tell the landlord why you're declining..." 
          value={selectedReason ? "" : reason} 
          onChange={(e) => { setReason(e.target.value); setSelectedReason(""); }}
          className="mt-1 min-h-[50px] text-xs" 
          disabled={!!selectedReason}
        />
      </div>
      <Button
        variant="destructive"
        className="w-full h-10"
        onClick={() => onSubmit({ caseId, reason: selectedReason || reason || undefined })}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
        Decline This Request
      </Button>
    </div>
  );
}

export function SlaExtensionButton({ caseId, currentDeadline }: { caseId: string; currentDeadline?: string }) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const { toast } = useToast();

  const extensionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contractor/sla-extension", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.autoGranted ? "Extension Granted" : "Extension Requested",
        description: data.autoGranted
          ? `Your deadline has been extended to ${new Date(newDeadline).toLocaleDateString()}`
          : "Your extension request has been sent to the landlord for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor"] });
      setShowForm(false);
    },
    onError: () => { toast({ title: "Error", description: "Failed to request extension", variant: "destructive" }); },
  });

  const quickReasons = [
    "Waiting for parts pricing",
    "Complex issue needs specialist input",
    "Need subcontractor quotes",
    "Permit research required",
  ];

  if (!showForm) {
    return (
      <Button variant="outline" size="sm" className="h-8 text-xs border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => setShowForm(true)}>
        <Clock className="h-3.5 w-3.5 mr-1" />
        Request Extension
      </Button>
    );
  }

  return (
    <Card className="border border-orange-200 bg-orange-50/50">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold">Request Quote Extension</h4>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowForm(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {currentDeadline && (
          <p className="text-[10px] text-muted-foreground">Current deadline: {new Date(currentDeadline).toLocaleDateString()}</p>
        )}
        <div>
          <Label className="text-[10px] font-medium">Reason</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {quickReasons.map((r) => (
              <Badge
                key={r}
                variant={reason === r ? "default" : "outline"}
                className={`cursor-pointer text-[10px] ${reason === r ? "bg-orange-200 text-orange-800" : ""}`}
                onClick={() => setReason(r)}
              >
                {r}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[10px] font-medium">New Deadline</Label>
          <Input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className="h-8 mt-1 text-xs" />
        </div>
        <Button
          size="sm"
          className="w-full h-8 bg-orange-600 hover:bg-orange-700 text-white text-xs"
          onClick={() => extensionMutation.mutate({ caseId, reason, requestedDeadline: newDeadline })}
          disabled={!reason || !newDeadline || extensionMutation.isPending}
        >
          {extensionMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Submit Extension Request
        </Button>
      </CardContent>
    </Card>
  );
}
