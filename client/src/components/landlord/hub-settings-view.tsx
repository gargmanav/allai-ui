import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Settings2, Trash2, Edit, DollarSign, Clock, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertApprovalPolicySchema, type ApprovalPolicy, type Vendor } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

const formSchema = insertApprovalPolicySchema.omit({ orgId: true }).extend({
  autoApproveCostLimit: z.string().optional().refine(
    (val) => !val || !isNaN(parseFloat(val)),
    { message: "Must be a valid number" }
  ),
  requireApprovalOver: z.string().optional().refine(
    (val) => !val || !isNaN(parseFloat(val)),
    { message: "Must be a valid number" }
  ),
  vacationStartDate: z.string().optional(),
  vacationEndDate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function HubSettingsView() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<ApprovalPolicy | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: policies = [], isLoading } = useQuery<ApprovalPolicy[]>({
    queryKey: ["/api/approval-policies"],
    enabled: !!user,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: !!user,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      isActive: true,
      trustedContractorIds: [],
      autoApproveWeekdays: true,
      autoApproveWeekends: true,
      autoApproveEvenings: true,
      blockVacationDates: false,
      autoApproveEmergencies: true,
      involvementMode: "balanced",
      autoApproveCostLimit: "",
      requireApprovalOver: "",
      vacationStartDate: "",
      vacationEndDate: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        orgId: user?.orgId,
        trustedContractorIds: data.trustedContractorIds || [],
        autoApproveCostLimit: data.autoApproveCostLimit || null,
        requireApprovalOver: data.requireApprovalOver || null,
        vacationStartDate: data.vacationStartDate || null,
        vacationEndDate: data.vacationEndDate || null,
      };
      return await apiRequest("POST", "/api/approval-policies", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-policies"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Policy created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create policy", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      apiRequest("PUT", `/api/approval-policies/${id}`, {
        ...data,
        orgId: user?.orgId,
        trustedContractorIds: data.trustedContractorIds || [],
        autoApproveCostLimit: data.autoApproveCostLimit || null,
        requireApprovalOver: data.requireApprovalOver || null,
        vacationStartDate: data.vacationStartDate || null,
        vacationEndDate: data.vacationEndDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-policies"] });
      setEditingPolicy(null);
      form.reset();
      toast({ title: "Policy updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update policy", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/approval-policies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-policies"] });
      setDeletingId(null);
      toast({ title: "Policy deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete policy", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormData) => {
    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (policy: ApprovalPolicy) => {
    setEditingPolicy(policy);
    form.reset({
      name: policy.name,
      isActive: policy.isActive,
      trustedContractorIds: policy.trustedContractorIds || [],
      autoApproveWeekdays: policy.autoApproveWeekdays ?? true,
      autoApproveWeekends: policy.autoApproveWeekends ?? true,
      autoApproveEvenings: policy.autoApproveEvenings ?? true,
      blockVacationDates: policy.blockVacationDates ?? false,
      autoApproveEmergencies: policy.autoApproveEmergencies ?? true,
      involvementMode: policy.involvementMode ?? "balanced",
      autoApproveCostLimit: policy.autoApproveCostLimit?.toString() || "",
      requireApprovalOver: policy.requireApprovalOver?.toString() || "",
      vacationStartDate: policy.vacationStartDate ? new Date(policy.vacationStartDate).toISOString().split('T')[0] : "",
      vacationEndDate: policy.vacationEndDate ? new Date(policy.vacationEndDate).toISOString().split('T')[0] : "",
    });
  };

  const togglePolicyStatus = (policy: ApprovalPolicy) => {
    const isActivating = !policy.isActive;
    const hasOtherActivePolicies = policies.some(p => p.id !== policy.id && p.isActive);

    if (isActivating && hasOtherActivePolicies) {
      toast({
        title: "Note",
        description: "Activating this policy will deactivate all other policies. Only one policy can be active at a time.",
      });
    }

    updateMutation.mutate({
      id: policy.id,
      data: {
        name: policy.name,
        orgId: policy.orgId,
        isActive: !policy.isActive,
        trustedContractorIds: policy.trustedContractorIds || [],
        autoApproveWeekdays: policy.autoApproveWeekdays ?? true,
        autoApproveWeekends: policy.autoApproveWeekends ?? true,
        autoApproveEvenings: policy.autoApproveEvenings ?? true,
        blockVacationDates: policy.blockVacationDates ?? false,
        autoApproveEmergencies: policy.autoApproveEmergencies ?? true,
        involvementMode: policy.involvementMode ?? "balanced",
        autoApproveCostLimit: policy.autoApproveCostLimit?.toString() || undefined,
        requireApprovalOver: policy.requireApprovalOver?.toString() || undefined,
        vacationStartDate: policy.vacationStartDate ? new Date(policy.vacationStartDate).toISOString().split('T')[0] : undefined,
        vacationEndDate: policy.vacationEndDate ? new Date(policy.vacationEndDate).toISOString().split('T')[0] : undefined,
      },
    });
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading settings...</div>;
  }

  const activePolicy = policies.find(p => p.isActive);

  return (
    <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Auto-Approval Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control when scheduling happens automatically vs. when you want to be involved
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="gap-2 shrink-0"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Policy
        </Button>
      </div>

      {activePolicy && (
        <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Active Mode</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {activePolicy.involvementMode === "hands-off" && "🙌"}
              {activePolicy.involvementMode === "balanced" && "⚖️"}
              {activePolicy.involvementMode === "hands-on" && "👋"}
            </span>
            <div>
              <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {activePolicy.involvementMode === "hands-off" && "Hands Off"}
                {activePolicy.involvementMode === "balanced" && "Balanced"}
                {activePolicy.involvementMode === "hands-on" && "Hands On"}
              </span>
              <p className="text-xs text-muted-foreground">
                {activePolicy.involvementMode === "hands-off" && "Auto-approve most things — minimal involvement needed"}
                {activePolicy.involvementMode === "balanced" && "Review some items, auto-approve trusted contractors"}
                {activePolicy.involvementMode === "hands-on" && "Review everything — full control over all approvals"}
              </p>
            </div>
          </div>
          {activePolicy.autoApproveCostLimit && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Auto-approve under ${activePolicy.autoApproveCostLimit}
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
        <Shield className="h-3 w-3" />
        Only one policy can be active at a time. Activating a policy will deactivate all others.
      </p>

      <div className="grid gap-3">
        {policies.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No approval policies yet</p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                variant="outline"
                className="mt-4"
              >
                Create your first policy
              </Button>
            </CardContent>
          </Card>
        ) : (
          policies.map((policy) => (
            <Card key={policy.id} className="border-slate-200/60 dark:border-slate-700/40">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{policy.name}</CardTitle>
                      <Badge variant={policy.isActive ? "default" : "secondary"} className="text-xs">
                        {policy.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {policy.involvementMode === "hands-off" && "🙌 Hands Off"}
                        {policy.involvementMode === "balanced" && "⚖️ Balanced"}
                        {policy.involvementMode === "hands-on" && "👋 Hands On"}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                        {(policy.trustedContractorIds?.length ?? 0) > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs">
                              {policy.trustedContractorIds?.length} trusted contractor{policy.trustedContractorIds?.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                        {(policy.autoApproveCostLimit || policy.requireApprovalOver) && (
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-xs">
                              {policy.autoApproveCostLimit && `Auto under $${policy.autoApproveCostLimit}`}
                              {policy.autoApproveCostLimit && policy.requireApprovalOver && " · "}
                              {policy.requireApprovalOver && `Review over $${policy.requireApprovalOver}`}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-purple-600" />
                          <span className="text-xs">
                            {policy.autoApproveWeekdays && "Weekdays"}
                            {policy.autoApproveWeekdays && policy.autoApproveWeekends && " · "}
                            {policy.autoApproveWeekends && "Weekends"}
                            {policy.autoApproveEvenings && " · Evenings"}
                          </span>
                        </div>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePolicyStatus(policy)}
                      className="text-xs h-8"
                    >
                      {policy.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(policy)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeletingId(policy.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isCreateDialogOpen || !!editingPolicy} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setEditingPolicy(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit Policy" : "Create New Policy"}</DialogTitle>
            <DialogDescription>
              Set rules for when appointments should be auto-approved vs. when you want to review them
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Standard Auto-Approval" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="involvementMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Involvement Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="hands-off">🙌 Hands Off - Auto-approve most things</SelectItem>
                        <SelectItem value="balanced">⚖️ Balanced - Review some, auto-approve trusted</SelectItem>
                        <SelectItem value="hands-on">👋 Hands On - Review everything</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose how involved you want to be in approving appointments
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-semibold text-sm">Cost Thresholds</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="autoApproveCostLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Auto-approve under</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="500" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Automatically approve under this amount
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requireApprovalOver"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Always require approval over</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1000" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Always review over this amount
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-semibold text-sm">Time Preferences</h3>
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="autoApproveWeekdays"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Auto-approve weekdays</FormLabel>
                          <FormDescription className="text-xs">Monday through Friday</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autoApproveWeekends"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Auto-approve weekends</FormLabel>
                          <FormDescription className="text-xs">Saturday and Sunday</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autoApproveEvenings"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Auto-approve evenings</FormLabel>
                          <FormDescription className="text-xs">After 5 PM</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-semibold text-sm">Trusted Contractors</h3>
                <FormField
                  control={form.control}
                  name="trustedContractorIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Select Trusted Contractors</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const current = field.value || [];
                          if (!current.includes(value)) {
                            field.onChange([...current, value]);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Add contractor..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Contractors you trust for automatic approval
                      </FormDescription>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(field.value || []).map((contractorId) => {
                          const vendor = vendors.find(v => v.id === contractorId);
                          return vendor ? (
                            <Badge key={contractorId} variant="secondary" className="gap-1">
                              {vendor.name}
                              <button
                                type="button"
                                onClick={() => {
                                  field.onChange((field.value || []).filter(id => id !== contractorId));
                                }}
                                className="ml-1 hover:text-destructive"
                              >
                                ×
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-semibold text-sm">Vacation Mode</h3>
                <FormField
                  control={form.control}
                  name="blockVacationDates"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div>
                        <FormLabel>Enable vacation auto-approval</FormLabel>
                        <FormDescription className="text-xs">
                          ALL appointments auto-approve during vacation dates
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch("blockVacationDates") && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="vacationStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Vacation Start</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vacationEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Vacation End</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="autoApproveEmergencies"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between border rounded-lg p-4">
                    <div>
                      <FormLabel>Auto-approve emergencies</FormLabel>
                      <FormDescription className="text-xs">
                        Urgent cases are automatically approved regardless of other settings
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between border rounded-lg p-4">
                    <div>
                      <FormLabel>Active Policy</FormLabel>
                      <FormDescription className="text-xs">Enable or disable this policy</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingPolicy(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingPolicy ? "Update Policy" : "Create Policy"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this approval policy? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
