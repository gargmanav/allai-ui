import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, Send, Archive, Sparkles, CheckCircle, AlertTriangle, FileText, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThreadChat } from "./thread-chat";

interface LineItem {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  displayOrder: number;
}

interface Customer {
  id: string;
  name?: string;
  company?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

interface InlineQuoteDetailProps {
  quoteId: string;
  customerId?: string;
  customerName: string;
  customerInitials: string;
  status: string;
  caseId?: string;
  reporterUserId?: string;
  initialTitle?: string;
  initialSubtotal?: number;
  initialTaxAmount?: number;
  initialTotal?: number;
  initialExpiresAt?: string;
  initialClientMessage?: string;
  initialInternalNotes?: string;
  initialDiscountAmount?: number;
  initialTaxPercent?: number;
  initialDepositType?: string;
  initialDepositValue?: number;
  onClose?: () => void;
}

export function InlineQuoteDetail({
  quoteId,
  customerId,
  customerName,
  customerInitials,
  status: initialStatus,
  caseId,
  reporterUserId: propReporterUserId,
  initialTitle,
  initialSubtotal,
  initialTaxAmount,
  initialTotal,
  initialExpiresAt,
  initialClientMessage,
  initialInternalNotes,
  initialDiscountAmount,
  initialTaxPercent,
  initialDepositType,
  initialDepositValue,
  onClose,
}: InlineQuoteDetailProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState(initialTitle || "");
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt ? new Date(initialExpiresAt).toISOString().split("T")[0] : "");
  const [clientMessage, setClientMessage] = useState(initialClientMessage || "");
  const [internalNotes, setInternalNotes] = useState(initialInternalNotes || "");
  const [discountAmount, setDiscountAmount] = useState(initialDiscountAmount || 0);
  const [taxPercent, setTaxPercent] = useState(initialTaxPercent || 0);
  const [depositType, setDepositType] = useState<"none" | "percent" | "fixed">((initialDepositType as any) || "none");
  const [depositValue, setDepositValue] = useState(initialDepositValue || 0);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { name: "", description: "", quantity: 1, unitPrice: 0, total: 0, displayOrder: 0 },
  ]);
  const [isEditing, setIsEditing] = useState(false);

  const { data: quoteData, isLoading } = useQuery({
    queryKey: ["/api/contractor/quotes", quoteId],
    enabled: !!quoteId,
  });

  const { data: caseData } = useQuery<any>({
    queryKey: ["/api/contractor/cases", caseId],
    enabled: !!caseId,
  });

  useEffect(() => {
    if (quoteData) {
      const { quote, lineItems: existingLineItems } = quoteData as any;
      setTitle(quote.title || "");
      setExpiresAt(quote.expiresAt ? new Date(quote.expiresAt).toISOString().split("T")[0] : "");
      setClientMessage(quote.clientMessage || "");
      setInternalNotes(quote.internalNotes || "");
      setDiscountAmount(parseFloat(quote.discountAmount) || 0);
      setTaxPercent(parseFloat(quote.taxPercent) || 0);
      setDepositType(quote.depositType || "none");
      setDepositValue(quote.depositValue != null ? parseFloat(String(quote.depositValue)) || 0 : 0);

      const mapped: LineItem[] = (existingLineItems || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || "",
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        total: parseFloat(item.total),
        displayOrder: item.displayOrder,
      }));

      if (mapped.length === 0) {
        setLineItems([{ name: "", description: "", quantity: 1, unitPrice: 0, total: 0, displayOrder: 0 }]);
      } else {
        setLineItems(mapped);
      }
    }
  }, [quoteData]);

  const lineItemSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const hasRealLineItems = lineItems.some(item => item.name || item.unitPrice > 0);
  const subtotal = hasRealLineItems ? lineItemSubtotal : (initialTotal || lineItemSubtotal);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const total = afterDiscount + taxAmount;

  let requiredDepositAmount = 0;
  if (depositType === "fixed") {
    requiredDepositAmount = depositValue;
  } else if (depositType === "percent") {
    requiredDepositAmount = (total * depositValue) / 100;
  }

  const currentStatus = (quoteData as any)?.quote?.status || initialStatus;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId,
        title: title || `Quote #${quoteId.slice(0, 8)}`,
        status: "draft",
        subtotal: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        taxPercent: taxPercent.toString(),
        taxAmount: taxAmount.toString(),
        total: total.toString(),
        depositType,
        depositValue: depositType !== "none" ? depositValue.toString() : null,
        requiredDepositAmount: depositType !== "none" ? requiredDepositAmount.toString() : "0",
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        clientMessage: clientMessage || null,
        internalNotes: internalNotes || null,
        lineItems: lineItems.map((item, index) => ({
          name: item.name,
          description: item.description || null,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          total: item.total.toString(),
          displayOrder: index,
        })),
      };
      return await apiRequest("PATCH", `/api/contractor/quotes/${quoteId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/quotes", quoteId] });
      setIsEditing(false);
      toast({ title: "Quote saved", description: "Your changes have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save quote.", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId,
        title: title || `Quote #${quoteId.slice(0, 8)}`,
        status: "sent",
        subtotal: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        taxPercent: taxPercent.toString(),
        taxAmount: taxAmount.toString(),
        total: total.toString(),
        depositType,
        depositValue: depositType !== "none" ? depositValue.toString() : null,
        requiredDepositAmount: depositType !== "none" ? requiredDepositAmount.toString() : "0",
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        clientMessage: clientMessage || null,
        internalNotes: internalNotes || null,
        lineItems: lineItems.map((item, index) => ({
          name: item.name,
          description: item.description || null,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          total: item.total.toString(),
          displayOrder: index,
        })),
      };
      return await apiRequest("PATCH", `/api/contractor/quotes/${quoteId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/quotes", quoteId] });
      setIsEditing(false);
      toast({ title: "Quote sent", description: "Quote has been sent to the customer." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send quote.", variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/contractor/quotes/${quoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/quotes"] });
      toast({ title: "Quote archived", description: "Quote has been archived." });
      onClose?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to archive quote.", variant: "destructive" });
    },
  });

  const addLineItem = () => {
    setLineItems([...lineItems, { name: "", description: "", quantity: 1, unitPrice: 0, total: 0, displayOrder: lineItems.length }]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
    }
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const getStatusBadge = (s: string) => {
    const statusMap: Record<string, string> = {
      draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
      sent: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
      awaiting_response: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
      approved: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
      declined: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
      expired: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    };
    return statusMap[s.toLowerCase()] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  };

  const aiTriage = caseData?.aiTriageJson || (caseData as any)?.aiTriageJson;

  if (isLoading) {
    return (
      <Card className="mt-4 overflow-hidden">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400 mr-2" />
          <span className="text-sm text-slate-500">Loading quote...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                  boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                }}
              >
                {customerInitials}
              </div>
              <div>
                <h3 className="font-semibold text-base">{title || `Quote #${quoteId.slice(0, 8)}`}</h3>
                <p className="text-xs text-muted-foreground">{customerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${getStatusBadge(currentStatus)} border-0`}>
                {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
              </Badge>
              {!isEditing ? (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-500" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          {caseId && caseData && (
            <div className="mb-4 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Original Request</p>
              <p className="text-sm font-medium text-slate-700">{caseData.title}</p>
              {caseData.description && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{caseData.description}</p>
              )}
              {aiTriage && (
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  {aiTriage.estimatedCost && <span>Est. {aiTriage.estimatedCost}</span>}
                  {aiTriage.estimatedTime && <span>~{aiTriage.estimatedTime}</span>}
                  {aiTriage.urgency && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-slate-100 border-slate-200 text-slate-600">
                      {aiTriage.urgency}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px] font-medium text-slate-500 mb-1 block">Quote Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Auto-generated if empty" className="h-8 text-sm bg-white" />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-slate-500 mb-1 block">Valid Until</Label>
                  <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-8 text-sm bg-white" />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-medium text-slate-500 mb-2 block">Line Items</Label>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 bg-slate-50/50">
                        <TableHead className="text-[11px] text-slate-500 py-2" style={{ width: "40%" }}>Service</TableHead>
                        <TableHead className="text-center text-[11px] text-slate-500 py-2" style={{ width: "12%" }}>Qty</TableHead>
                        <TableHead className="text-center text-[11px] text-slate-500 py-2" style={{ width: "18%" }}>Price</TableHead>
                        <TableHead className="text-right text-[11px] text-slate-500 py-2" style={{ width: "18%" }}>Total</TableHead>
                        <TableHead style={{ width: "12%" }}></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-slate-100">
                          <TableCell className="py-1.5">
                            <Input
                              value={item.name}
                              onChange={(e) => updateLineItem(index, "name", e.target.value)}
                              placeholder="Item name"
                              className="h-8 text-sm bg-white border-0 shadow-none px-1 focus-visible:ring-1"
                            />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input
                              type="number"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                              onFocus={(e) => { try { e.target.select(); } catch {} }}
                              className="h-8 text-sm text-center bg-white border-0 shadow-none px-1 focus-visible:ring-1"
                            />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                              onFocus={(e) => { try { e.target.select(); } catch {} }}
                              className="h-8 text-sm text-center bg-white border-0 shadow-none px-1 focus-visible:ring-1"
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-slate-700 py-1.5">
                            ${item.total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-red-50"
                              onClick={() => removeLineItem(index)}
                              disabled={lineItems.length <= 1}
                            >
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={addLineItem} className="mt-2 gap-1 text-xs text-slate-600 hover:text-slate-800">
                  <Plus className="h-3 w-3" /> Add Line Item
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px] font-medium text-slate-500 mb-1 block">Client Message</Label>
                  <Textarea
                    value={clientMessage}
                    onChange={(e) => setClientMessage(e.target.value)}
                    placeholder="Message for the customer..."
                    rows={3}
                    className="text-sm bg-white resize-none"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-slate-500 mb-1 block">Internal Notes</Label>
                  <Textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Private notes for your team..."
                    rows={3}
                    className="text-sm bg-white resize-none"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-800">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 flex-1">Discount</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => { try { e.target.select(); } catch {} }}
                    className="w-24 text-right h-7 text-sm bg-white"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 flex-1">Tax (%)</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => { try { e.target.select(); } catch {} }}
                    className="w-24 text-right h-7 text-sm bg-white"
                  />
                </div>
                <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Total</span>
                  <span className="text-lg font-bold text-slate-900">${total.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-100 pt-2.5">
                  <Label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Deposit</Label>
                  <div className="flex items-center gap-2">
                    <Select value={depositType} onValueChange={(v: any) => setDepositType(v)}>
                      <SelectTrigger className="flex-1 h-7 text-sm bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Deposit</SelectItem>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    {depositType !== "none" && (
                      <Input
                        type="number"
                        step="0.01"
                        value={depositValue}
                        onChange={(e) => setDepositValue(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => { try { e.target.select(); } catch {} }}
                        className="w-20 h-7 text-sm bg-white"
                      />
                    )}
                  </div>
                  {depositType !== "none" && requiredDepositAmount > 0 && (
                    <p className="text-[11px] text-slate-400 mt-1">Deposit: ${requiredDepositAmount.toFixed(2)}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-9 text-xs"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || sendMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 h-9 text-xs bg-slate-800 hover:bg-slate-900 text-white"
                  onClick={() => sendMutation.mutate()}
                  disabled={saveMutation.isPending || sendMutation.isPending || lineItems.every(li => !li.name)}
                >
                  {sendMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Send to Customer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-9 text-xs text-slate-400 hover:text-slate-600 ml-auto"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  <Archive className="h-3 w-3" />
                  Archive
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {lineItems.length > 0 && lineItems[0].name && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Line Items</p>
                  <div className="rounded-lg border border-slate-100 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-100 bg-slate-50/30">
                          <TableHead className="text-[11px] text-slate-500 py-1.5">Service</TableHead>
                          <TableHead className="text-center text-[11px] text-slate-500 py-1.5 w-16">Qty</TableHead>
                          <TableHead className="text-right text-[11px] text-slate-500 py-1.5 w-20">Price</TableHead>
                          <TableHead className="text-right text-[11px] text-slate-500 py-1.5 w-20">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.filter(li => li.name).map((item, idx) => (
                          <TableRow key={idx} className="border-slate-100">
                            <TableCell className="py-1.5 text-sm text-slate-700">{item.name}</TableCell>
                            <TableCell className="py-1.5 text-sm text-center text-slate-600">{item.quantity}</TableCell>
                            <TableCell className="py-1.5 text-sm text-right text-slate-600">${item.unitPrice.toFixed(2)}</TableCell>
                            <TableCell className="py-1.5 text-sm text-right font-medium text-slate-700">${item.total.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-100 bg-white p-3 space-y-1.5">
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Discount</span>
                    <span className="text-slate-600">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxPercent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax ({taxPercent}%)</span>
                    <span className="text-slate-600">${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                  <span className="font-semibold text-slate-700">Total</span>
                  <span className="text-lg font-bold text-slate-900">${total.toFixed(2)}</span>
                </div>
                {depositType !== "none" && requiredDepositAmount > 0 && (
                  <div className="flex justify-between text-xs text-slate-500 pt-1">
                    <span>Required Deposit</span>
                    <span>${requiredDepositAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {clientMessage && (
                <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/30">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Client Message</p>
                  <p className="text-sm text-slate-600">{clientMessage}</p>
                </div>
              )}

              {internalNotes && (
                <div className="p-3 rounded-lg border border-slate-100 bg-amber-50/30">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Internal Notes</p>
                  <p className="text-sm text-slate-600">{internalNotes}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-9 text-xs"
                  onClick={() => setIsEditing(true)}
                >
                  <FileText className="h-3 w-3" /> Edit Quote
                </Button>
                {(currentStatus === "draft") && (
                  <Button
                    size="sm"
                    className="gap-1.5 h-9 text-xs bg-slate-800 hover:bg-slate-900 text-white"
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending || lineItems.every(li => !li.name)}
                  >
                    {sendMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Send to Customer
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-9 text-xs text-slate-400 hover:text-slate-600 ml-auto"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  <Archive className="h-3 w-3" />
                  Archive
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {caseId && aiTriage && (
        <div className="rounded-lg border border-slate-100 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-2.5 w-2.5 text-white" />
            </div>
            <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Maya AI Assessment</p>
          </div>
          <div className="space-y-2">
            {aiTriage.rootCause && (
              <div>
                <span className="text-[11px] text-slate-400">Likely Cause</span>
                <p className="text-sm text-slate-700">{aiTriage.rootCause}</p>
              </div>
            )}
            {aiTriage.suggestedActions && aiTriage.suggestedActions.length > 0 && (
              <div>
                <span className="text-[11px] text-slate-400">Suggested Steps</span>
                <ul className="mt-1 space-y-0.5">
                  {aiTriage.suggestedActions.slice(0, 3).map((action: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <CheckCircle className="h-3 w-3 text-violet-400 mt-0.5 shrink-0" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiTriage.safetyNotes && (
              <div className="flex items-start gap-1.5 p-2 rounded bg-amber-50 border border-amber-100">
                <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-700">{aiTriage.safetyNotes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {caseId && (
        <ThreadChat
          caseId={caseId}
          homeownerUserId={(caseData as any)?.reporterUserId || propReporterUserId}
          orgId={(caseData as any)?.orgId}
          subject={title || `Quote #${quoteId.slice(0, 8)}`}
          compact
        />
      )}
    </div>
  );
}
