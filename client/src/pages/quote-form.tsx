import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, ArrowLeft, FileText } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Customer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
};

type LineItem = {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  displayOrder: number;
};

export default function QuoteFormPage() {
  const [_, setLocation] = useLocation();
  const params = useParams();
  const { id: quoteId } = params as { id?: string };
  const isEditMode = !!quoteId && quoteId !== 'new';
  const { toast } = useToast();

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [depositType, setDepositType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [depositValue, setDepositValue] = useState(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { name: "", description: "", quantity: 1, unitPrice: 0, total: 0, displayOrder: 0 },
  ]);

  // Removed separate form state - editing happens directly in the table

  // Fetch customers
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/contractor/customers'],
  });

  // Fetch existing quote when in edit mode
  const { data: existingQuoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: ['/api/contractor/quotes', quoteId],
    enabled: isEditMode,
  });

  // Populate form when editing existing quote
  useEffect(() => {
    if (isEditMode && existingQuoteData) {
      const { quote, lineItems: existingLineItems } = existingQuoteData;
      
      setCustomerId(quote.customerId);
      setTitle(quote.title || "");
      setExpiresAt(quote.expiresAt ? format(new Date(quote.expiresAt), 'yyyy-MM-dd') : "");
      setClientMessage(quote.clientMessage || "");
      setInternalNotes(quote.internalNotes || "");
      setDiscountAmount(parseFloat(quote.discountAmount) || 0);
      setTaxPercent(parseFloat(quote.taxPercent) || 0);
      setDepositType(quote.depositType || 'none');
      // Handle depositValue safely (may be null, string, or number)
      const depositVal = quote.depositValue;
      setDepositValue(depositVal != null ? parseFloat(String(depositVal)) || 0 : 0);
      
      // Map line items to local state
      const mappedLineItems: LineItem[] = existingLineItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || "",
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        total: parseFloat(item.total),
        displayOrder: item.displayOrder,
      }));
      
      if (mappedLineItems.length === 0) {
        setLineItems([{ name: "", description: "", quantity: 1, unitPrice: 0, total: 0, displayOrder: 0 }]);
      } else {
        setLineItems(mappedLineItems);
      }
    }
  }, [isEditMode, existingQuoteData]);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const total = afterDiscount + taxAmount;
  
  let requiredDepositAmount = 0;
  if (depositType === 'fixed') {
    requiredDepositAmount = depositValue;
  } else if (depositType === 'percent') {
    requiredDepositAmount = (total * depositValue) / 100;
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId,
        title: title || `Quote for ${customers.find(c => c.id === customerId)?.companyName || customers.find(c => c.id === customerId)?.lastName || 'Customer'}`,
        status: 'draft',
        subtotal: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        taxPercent: taxPercent.toString(),
        taxAmount: taxAmount.toString(),
        total: total.toString(),
        depositType,
        depositValue: depositType !== 'none' ? depositValue.toString() : null,
        requiredDepositAmount: depositType !== 'none' ? requiredDepositAmount.toString() : '0',
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

      if (isEditMode) {
        // Use atomic update endpoint that handles quote + line items in one transaction
        return await apiRequest('PATCH', `/api/contractor/quotes/${quoteId}`, payload);
      } else {
        // Create new quote with line items
        return await apiRequest('POST', '/api/contractor/quotes', payload);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/quotes'] });
      toast({
        title: isEditMode ? "Quote updated" : "Quote created",
        description: isEditMode ? "Quote has been updated successfully." : "Quote has been created successfully.",
      });
      setLocation('/contractor?view=quotes');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'create'} quote. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const addLineItem = () => {
    const newItem: LineItem = {
      name: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
      displayOrder: lineItems.length,
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    
    // Recalculate total when quantity or price changes
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].unitPrice;
    }
    
    setLineItems(updatedItems);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.companyName && !customer.firstName && !customer.lastName) {
      return customer.companyName;
    }
    if (customer.firstName && customer.lastName) {
      return `${customer.lastName}, ${customer.firstName}`;
    }
    if (customer.lastName) return customer.lastName;
    if (customer.firstName) return customer.firstName;
    if (customer.companyName) return customer.companyName;
    return "Unknown Customer";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    if (lineItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate();
  };

  if (isEditMode && isLoadingQuote) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/20 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-3 text-sky-400 animate-pulse" />
          <p className="text-muted-foreground">Loading quote...</p>
        </div>
      </div>
    );
  }

  const frostedCard = "rounded-xl border border-slate-200/70 shadow-lg shadow-slate-200/40" +
    " bg-white/85 backdrop-blur-md ring-1 ring-white/60" +
    " [box-shadow:0_1px_0_0_rgba(255,255,255,0.8)_inset,0_-1px_3px_0_rgba(148,163,184,0.1)_inset,0_4px_12px_-2px_rgba(100,116,139,0.12)]";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/20 to-blue-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/contractor?view=quotes')}
              className="gap-1.5 text-slate-600 hover:text-slate-900"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <h1 className="text-xl font-semibold text-slate-800">
              {isEditMode ? "Edit Quote" : "New Quote"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLocation('/contractor?view=quotes')}
              className="text-slate-600"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saveMutation.isPending}
              onClick={handleSubmit as any}
              className="bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white gap-1.5 shadow-sm"
              data-testid="button-save"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? 'Saving...' : isEditMode ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className={`${frostedCard} p-5`}>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-xs font-medium text-slate-500 mb-1.5 block">Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger data-testid="select-customer" className="bg-white/80">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {getCustomerDisplayName(customer)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-500 mb-1.5 block">Quote Title (Optional)</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="bg-white/80"
                  data-testid="input-title"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-500 mb-1.5 block">Valid Until (Optional)</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="bg-white/80"
                  data-testid="input-expires-at"
                />
              </div>
            </div>
          </div>

          <div className={`${frostedCard} p-5`}>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Line Items</h3>
            
            <Table className="mb-4 table-fixed">
              <TableHeader>
                <TableRow className="border-slate-100">
                  <TableHead className="text-xs text-slate-500" style={{ width: '40%' }}>Product / Service</TableHead>
                  <TableHead className="text-center text-xs text-slate-500" style={{ width: '15%' }}>Qty.</TableHead>
                  <TableHead className="text-center text-xs text-slate-500" style={{ width: '18%' }}>Unit Price</TableHead>
                  <TableHead className="text-right text-xs text-slate-500" style={{ width: '15%' }}>Total</TableHead>
                  <TableHead style={{ width: '12%' }}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item, index) => (
                  <TableRow key={index} className="border-slate-100" data-testid={`line-item-${index}`}>
                    <TableCell>
                      <div className="space-y-1.5">
                        <Input
                          value={item.name}
                          onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                          placeholder="Item name"
                          className="font-medium bg-white/80 h-9"
                          data-testid={`input-name-${index}`}
                        />
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          placeholder="Description (optional)"
                          className="text-sm bg-white/80 h-8 text-slate-500"
                          data-testid={`input-description-${index}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => { try { e.target.select(); } catch {} }}
                        className="text-center bg-white/80 h-9 w-full"
                        data-testid={`input-qty-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => { try { e.target.select(); } catch {} }}
                        className="text-center bg-white/80 h-9 w-full"
                        data-testid={`input-price-${index}`}
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-700" data-testid={`text-total-${index}`}>
                      ${item.total.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-red-50"
                        onClick={() => removeLineItem(index)}
                        data-testid={`button-remove-${index}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
              className="gap-1.5 text-sky-600 border-sky-200 hover:bg-sky-50"
              data-testid="button-add-item"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Line Item
            </Button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div className={`${frostedCard} p-4`}>
                <Label className="text-xs font-medium text-slate-500 mb-2 block">Client Message</Label>
                <Textarea
                  placeholder="Message that the customer will see..."
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  rows={4}
                  className="bg-white/80 resize-none"
                  data-testid="input-client-message"
                />
              </div>
              <div className={`${frostedCard} p-4`}>
                <Label className="text-xs font-medium text-slate-500 mb-1 block">Internal Notes</Label>
                <p className="text-[11px] text-slate-400 mb-2">Only visible to your team</p>
                <Textarea
                  placeholder="Internal notes for your team..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  className="bg-white/80 resize-none"
                  data-testid="input-internal-notes"
                />
              </div>
            </div>

            <div className={`${frostedCard} p-5`}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Subtotal:</span>
                  <span className="text-lg font-semibold text-slate-800" data-testid="text-subtotal">${subtotal.toFixed(2)}</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="discount-amount" className="flex-1 text-sm text-slate-600">Discount:</Label>
                    <Input
                      id="discount-amount"
                      type="number"
                      step="0.01"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => { try { e.target.select(); } catch {} }}
                      className="w-28 text-right bg-white/80 h-8 text-sm"
                      data-testid="input-discount"
                    />
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-end">
                      <span className="text-xs text-red-500">-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="tax-percent" className="flex-1 text-sm text-slate-600">Tax (%):</Label>
                    <Input
                      id="tax-percent"
                      type="number"
                      step="0.01"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => { try { e.target.select(); } catch {} }}
                      className="w-28 text-right bg-white/80 h-8 text-sm"
                      data-testid="input-tax-percent"
                    />
                  </div>
                  {taxPercent > 0 && (
                    <div className="flex justify-end">
                      <span className="text-xs text-slate-500" data-testid="text-tax-amount">${taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-slate-700">Total:</span>
                    <span className="text-xl font-bold text-slate-900" data-testid="text-total">${total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <Label htmlFor="deposit-type" className="text-xs font-medium text-slate-500">Required Deposit</Label>
                  <div className="flex items-center gap-2">
                    <Select value={depositType} onValueChange={(value: any) => setDepositType(value)}>
                      <SelectTrigger id="deposit-type" data-testid="select-deposit-type" className="flex-1 bg-white/80 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Deposit</SelectItem>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    {depositType !== 'none' && (
                      <Input
                        id="deposit-value"
                        type="number"
                        step="0.01"
                        placeholder={depositType === 'percent' ? '25' : '500'}
                        value={depositValue}
                        onChange={(e) => setDepositValue(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => { try { e.target.select(); } catch {} }}
                        className="w-28 bg-white/80 h-9"
                        data-testid="input-deposit-value"
                      />
                    )}
                  </div>
                  {depositType !== 'none' && requiredDepositAmount > 0 && (
                    <p className="text-xs text-slate-500" data-testid="text-deposit-calculated">
                      Deposit Amount: ${requiredDepositAmount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
