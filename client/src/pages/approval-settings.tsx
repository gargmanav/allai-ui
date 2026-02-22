import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings2, DollarSign, Clock, Shield, ArrowLeft, Save, Loader2 } from "lucide-react";
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

export default function ApprovalSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: policies = [], isLoading } = useQuery<ApprovalPolicy[]>({
    queryKey: ["/api/approval-policies"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const policy = policies[0] || null;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "My Approval Policy",
      isActive: true,
      trustedContractorIds: [],
      autoApproveWeekdays: true,
      autoApproveWeekends: false,
      autoApproveEvenings: false,
      blockVacationDates: false,
      autoApproveEmergencies: true,
      involvementMode: "hands-on",
      autoApproveCostLimit: "",
      requireApprovalOver: "",
      vacationStartDate: "",
      vacationEndDate: "",
    },
  });

  useEffect(() => {
    if (policy) {
      form.reset({
        name: policy.name,
        isActive: true,
        trustedContractorIds: policy.trustedContractorIds || [],
        autoApproveWeekdays: policy.autoApproveWeekdays ?? true,
        autoApproveWeekends: policy.autoApproveWeekends ?? false,
        autoApproveEvenings: policy.autoApproveEvenings ?? false,
        blockVacationDates: policy.blockVacationDates ?? false,
        autoApproveEmergencies: policy.autoApproveEmergencies ?? true,
        involvementMode: policy.involvementMode ?? "hands-on",
        autoApproveCostLimit: policy.autoApproveCostLimit?.toString() || "",
        requireApprovalOver: policy.requireApprovalOver?.toString() || "",
        vacationStartDate: policy.vacationStartDate ? new Date(policy.vacationStartDate).toISOString().split('T')[0] : "",
        vacationEndDate: policy.vacationEndDate ? new Date(policy.vacationEndDate).toISOString().split('T')[0] : "",
      });
    }
  }, [policy]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      apiRequest("PUT", `/api/approval-policies/${id}`, {
        ...data,
        trustedContractorIds: data.trustedContractorIds || [],
        autoApproveCostLimit: data.autoApproveCostLimit || null,
        requireApprovalOver: data.requireApprovalOver || null,
        vacationStartDate: data.vacationStartDate || null,
        vacationEndDate: data.vacationEndDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-policies"] });
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormData) => {
    if (policy) {
      updateMutation.mutate({ id: policy.id, data });
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  const involvementMode = form.watch("involvementMode");

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-4"
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <h1 className="text-3xl font-bold">Approval Settings</h1>
        <p className="text-muted-foreground mt-1">
          Control how involved you want to be when contractors respond to maintenance requests
        </p>
      </div>

      <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20 p-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Current Mode</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">
            {involvementMode === "hands-off" && "\ud83d\ude4c"}
            {involvementMode === "balanced" && "\u2696\ufe0f"}
            {involvementMode === "hands-on" && "\ud83d\udc4b"}
          </span>
          <div>
            <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {involvementMode === "hands-off" && "Hands Off"}
              {involvementMode === "balanced" && "Balanced"}
              {involvementMode === "hands-on" && "Hands On"}
            </span>
            <p className="text-xs text-muted-foreground">
              {involvementMode === "hands-off" && "Auto-approve most things \u2014 minimal involvement needed"}
              {involvementMode === "balanced" && "Review some items, auto-approve trusted contractors"}
              {involvementMode === "hands-on" && "Review everything \u2014 full control over all approvals"}
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="involvementMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Involvement Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-involvement">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="hands-on">\ud83d\udc4b Hands On - Review everything</SelectItem>
                    <SelectItem value="balanced">\u2696\ufe0f Balanced - Review some, auto-approve trusted</SelectItem>
                    <SelectItem value="hands-off">\ud83d\ude4c Hands Off - Auto-approve most things</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose how involved you want to be in approving contractor work
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                Cost Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="autoApproveCostLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Auto-approve under</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="500" {...field} value={field.value || ""} data-testid="input-auto-approve-cost" />
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
                        <Input type="number" placeholder="1000" {...field} value={field.value || ""} data-testid="input-require-approval-cost" />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Always review over this amount
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                Time Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
                      <Switch checked={field.value ?? true} onCheckedChange={field.onChange} data-testid="switch-weekdays" />
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
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} data-testid="switch-weekends" />
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
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} data-testid="switch-evenings" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                Trusted Contractors
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                        <SelectTrigger data-testid="select-contractor">
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
                              x
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Other Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField
                control={form.control}
                name="autoApproveEmergencies"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Auto-approve emergencies</FormLabel>
                      <FormDescription className="text-xs">Automatically approve emergency work orders</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="blockVacationDates"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Block vacation dates</FormLabel>
                      <FormDescription className="text-xs">Prevent scheduling during vacation</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {form.watch("blockVacationDates") && (
                <div className="grid grid-cols-2 gap-4 pt-2">
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
            </CardContent>
          </Card>

          <Button type="submit" className="w-full gap-2" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </form>
      </Form>
    </div>
  );
}
