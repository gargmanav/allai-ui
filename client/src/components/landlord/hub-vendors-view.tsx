import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Plus, Trash2, Pencil, DollarSign, Phone, Mail, MapPin, Search } from "lucide-react";
import type { Vendor, Property } from "@shared/schema";

const VENDOR_CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "general", label: "General" },
  { value: "roofing", label: "Roofing" },
  { value: "landscaping", label: "Landscaping" },
  { value: "painting", label: "Painting" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
];

const VENDOR_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "llc", label: "LLC" },
];

const FROSTED_CARD_STYLE = {
  background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
  backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
  WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
  border: '2px solid rgba(255, 255, 255, 0.85)',
  boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)',
};

const defaultFormState = {
  name: "",
  category: "",
  phone: "",
  email: "",
  address: "",
  vendorType: "individual",
  w9OnFile: false,
  taxExempt: false,
  notes: "",
};

const defaultPaymentState = {
  amount: "",
  date: new Date().toISOString().split("T")[0],
  description: "",
  category: "repairs",
  propertyId: "",
};

export function HubVendorsView() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [paymentVendor, setPaymentVendor] = useState<Vendor | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formState, setFormState] = useState(defaultFormState);
  const [paymentState, setPaymentState] = useState(defaultPaymentState);

  const { data: vendors, isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    retry: false,
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    retry: false,
  });

  const createVendorMutation = useMutation({
    mutationFn: async (data: typeof formState) => {
      const response = await apiRequest("POST", "/api/vendors", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setShowAddDialog(false);
      setFormState(defaultFormState);
      toast({ title: "Success", description: "Vendor created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create vendor", variant: "destructive" });
    },
  });

  const updateVendorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formState }) => {
      const response = await apiRequest("PATCH", `/api/vendors/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setEditingVendor(null);
      setFormState(defaultFormState);
      toast({ title: "Success", description: "Vendor updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update vendor", variant: "destructive" });
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/vendors/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setShowDeleteConfirm(null);
      toast({ title: "Success", description: "Vendor deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete vendor", variant: "destructive" });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { amount: number; description: string; category: string; date: string; vendorId: string; propertyId?: string }) => {
      const response = await apiRequest("POST", "/api/expenses", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax/1099-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setPaymentVendor(null);
      setPaymentState(defaultPaymentState);
      toast({ title: "Success", description: "Payment recorded successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    },
  });

  const handleOpenEdit = (vendor: Vendor) => {
    setFormState({
      name: vendor.name,
      category: vendor.category || "",
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address || "",
      vendorType: vendor.vendorType || "individual",
      w9OnFile: vendor.w9OnFile || false,
      taxExempt: vendor.taxExempt || false,
      notes: vendor.notes || "",
    });
    setEditingVendor(vendor);
  };

  const handleSubmitForm = () => {
    if (!formState.name || !formState.phone || !formState.email) {
      toast({ title: "Validation Error", description: "Name, phone, and email are required", variant: "destructive" });
      return;
    }
    if (editingVendor) {
      updateVendorMutation.mutate({ id: editingVendor.id, data: formState });
    } else {
      createVendorMutation.mutate(formState);
    }
  };

  const handleSubmitPayment = () => {
    if (!paymentVendor || !paymentState.amount || !paymentState.description) {
      toast({ title: "Validation Error", description: "Amount and description are required", variant: "destructive" });
      return;
    }
    const payload: { amount: number; description: string; category: string; date: string; vendorId: string; propertyId?: string } = {
      amount: parseFloat(paymentState.amount),
      description: paymentState.description,
      category: paymentState.category,
      date: paymentState.date,
      vendorId: paymentVendor.id,
    };
    if (paymentState.propertyId) {
      payload.propertyId = paymentState.propertyId;
    }
    recordPaymentMutation.mutate(payload);
  };

  const filteredVendors = vendors?.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return v.name.toLowerCase().includes(q) || (v.category?.toLowerCase().includes(q));
  }) || [];

  const renderVendorForm = () => (
    <div className="space-y-4">
      <div>
        <Label>Name *</Label>
        <Input value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} placeholder="Vendor name" />
      </div>
      <div>
        <Label>Category</Label>
        <Select value={formState.category} onValueChange={(val) => setFormState({ ...formState, category: val })}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {VENDOR_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Phone *</Label>
          <Input value={formState.phone} onChange={(e) => setFormState({ ...formState, phone: e.target.value })} placeholder="(555) 123-4567" />
        </div>
        <div>
          <Label>Email *</Label>
          <Input value={formState.email} onChange={(e) => setFormState({ ...formState, email: e.target.value })} placeholder="vendor@email.com" type="email" />
        </div>
      </div>
      <div>
        <Label>Address</Label>
        <Input value={formState.address} onChange={(e) => setFormState({ ...formState, address: e.target.value })} placeholder="Street address" />
      </div>
      <div>
        <Label>Vendor Type</Label>
        <Select value={formState.vendorType} onValueChange={(val) => setFormState({ ...formState, vendorType: val })}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {VENDOR_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <Checkbox id="w9OnFile" checked={formState.w9OnFile} onCheckedChange={(checked) => setFormState({ ...formState, w9OnFile: !!checked })} />
          <Label htmlFor="w9OnFile">W-9 On File</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="taxExempt" checked={formState.taxExempt} onCheckedChange={(checked) => setFormState({ ...formState, taxExempt: !!checked })} />
          <Label htmlFor="taxExempt">Tax Exempt</Label>
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={formState.notes} onChange={(e) => setFormState({ ...formState, notes: e.target.value })} placeholder="Additional notes..." rows={3} />
      </div>
      <div className="flex justify-end space-x-2 pt-2">
        <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingVendor(null); setFormState(defaultFormState); }}>
          Cancel
        </Button>
        <Button onClick={handleSubmitForm} disabled={createVendorMutation.isPending || updateVendorMutation.isPending}>
          {createVendorMutation.isPending || updateVendorMutation.isPending ? "Saving..." : editingVendor ? "Update Vendor" : "Add Vendor"}
        </Button>
      </div>
    </div>
  );

  const renderSkeletonCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="group relative rounded-2xl overflow-hidden" style={FROSTED_CARD_STYLE}>
          <div className="running-light-bar h-1" style={{ backdropFilter: 'blur(16px) saturate(200%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)' }} />
          <div className="relative p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground">Manage your vendor relationships</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendors..."
              className="pl-9 w-64"
            />
          </div>
          <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) setFormState(defaultFormState); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
              </DialogHeader>
              {renderVendorForm()}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? renderSkeletonCards() : filteredVendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-violet-100/60 flex items-center justify-center mb-4">
            <Wrench className="h-8 w-8 text-violet-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No vendors found</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {searchQuery ? "Try adjusting your search query" : "Add your first vendor to get started"}
          </p>
          {!searchQuery && (
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(139,92,246,0.15),0_15px_35px_rgba(59,130,246,0.10),0_8px_20px_rgba(0,0,0,0.08)]"
              style={FROSTED_CARD_STYLE}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }} />
              <div className="running-light-bar h-1 transition-all duration-300" style={{
                backdropFilter: 'blur(16px) saturate(200%)',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)',
              }} />
              <div className="relative p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100/60 flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{vendor.name}</h3>
                      {vendor.category && (
                        <span className="text-xs text-muted-foreground capitalize">{vendor.category}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0 rounded-full" onClick={() => handleOpenEdit(vendor)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0 rounded-full" onClick={() => { setPaymentVendor(vendor); setPaymentState(defaultPaymentState); }}>
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Record Payment</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0 rounded-full text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(vendor.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{vendor.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{vendor.email}</span>
                  </div>
                  {vendor.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{vendor.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={vendor.w9OnFile ? "default" : "secondary"} className="text-xs">
                    W-9 {vendor.w9OnFile ? "✓" : "Missing"}
                  </Badge>
                  {vendor.vendorType && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {vendor.vendorType}
                    </Badge>
                  )}
                  {vendor.taxExempt && (
                    <Badge variant="outline" className="text-xs">
                      Tax Exempt
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editingVendor} onOpenChange={(open) => { if (!open) { setEditingVendor(null); setFormState(defaultFormState); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          {renderVendorForm()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!paymentVendor} onOpenChange={(open) => { if (!open) { setPaymentVendor(null); setPaymentState(defaultPaymentState); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment — {paymentVendor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount *</Label>
              <Input type="number" step="0.01" value={paymentState.amount} onChange={(e) => setPaymentState({ ...paymentState, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={paymentState.date} onChange={(e) => setPaymentState({ ...paymentState, date: e.target.value })} />
            </div>
            <div>
              <Label>Description *</Label>
              <Input value={paymentState.description} onChange={(e) => setPaymentState({ ...paymentState, description: e.target.value })} placeholder="Payment description" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={paymentState.category} onValueChange={(val) => setPaymentState({ ...paymentState, category: val })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Property (optional)</Label>
              <Select value={paymentState.propertyId} onValueChange={(val) => setPaymentState({ ...paymentState, propertyId: val })}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Property</SelectItem>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name || `${p.street}, ${p.city}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="outline" onClick={() => { setPaymentVendor(null); setPaymentState(defaultPaymentState); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmitPayment} disabled={recordPaymentMutation.isPending}>
                {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this vendor? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { if (showDeleteConfirm) deleteVendorMutation.mutate(showDeleteConfirm); }} disabled={deleteVendorMutation.isPending}>
                {deleteVendorMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
