import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TenantForm from "@/components/forms/tenant-form";
import LeaseForm from "@/components/forms/lease-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users, Plus, Mail, Phone, FileText, DollarSign, Calendar, AlertTriangle, Archive, RotateCcw, Trash2, UsersRound, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TenantGroup, Property, OwnershipEntity, Lease, Unit, InsertLease } from "@shared/schema";

export function HubTenantsView() {
  const { toast } = useToast();
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [showLeaseForm, setShowLeaseForm] = useState(false);
  const [selectedTenantGroup, setSelectedTenantGroup] = useState<TenantGroup | null>(null);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantGroup | null>(null);
  const [editingTenantData, setEditingTenantData] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<string | null>(null);
  const [showUnarchiveConfirm, setShowUnarchiveConfirm] = useState<string | null>(null);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState<string | null>(null);

  const getTenantStatus = (group: TenantGroup, groupLeases: Lease[]) => {
    if (group.status === "Archived") {
      return "Archived";
    }
    
    const activeLease = groupLeases.find(lease => lease.status === "Active");
    if (activeLease) {
      return "Current";
    } else if (groupLeases.length > 0) {
      return "Prior";
    }
    return "No Lease";
  };

  const { data: tenantGroups, isLoading: tenantsLoading, error } = useQuery<TenantGroup[]>({
    queryKey: ["/api/tenants"],
    retry: false,
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    retry: false,
  });

  const { data: entities = [] } = useQuery<OwnershipEntity[]>({
    queryKey: ["/api/entities"],
    retry: false,
  });

  const { data: leases = [] } = useQuery<Lease[]>({
    queryKey: ["/api/leases"],
    retry: false,
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    retry: false,
  });

  const { data: tenantRelationships, refetch: checkTenantRelationships } = useQuery({
    queryKey: ["/api/tenants", "relationship-count", showPermanentDeleteConfirm],
    queryFn: async () => {
      if (!showPermanentDeleteConfirm) return null;
      const response = await apiRequest("GET", `/api/tenants/${showPermanentDeleteConfirm}/relationship-count`);
      return response.json();
    },
    enabled: false,
    retry: false,
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/tenants", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setShowTenantForm(false);
      toast({
        title: "Success",
        description: "Tenant created successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create tenant",
        variant: "destructive",
      });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async ({ groupId, data }: { groupId: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/tenants/${groupId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setEditingTenant(null);
      setEditingTenantData(null);
      setShowTenantForm(false);
      toast({
        title: "Success",
        description: "Tenant updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update tenant",
        variant: "destructive",
      });
    },
  });

  const archiveTenantMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const response = await apiRequest("DELETE", `/api/tenants/${groupId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      setShowDeleteConfirm(null);
      toast({
        title: "Success",
        description: "Tenant archived successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to archive tenant",
        variant: "destructive",
      });
    },
  });

  const archiveIndividualTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiRequest("PATCH", `/api/tenants/${tenantId}/archive`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setShowArchiveConfirm(null);
      toast({
        title: "Success",
        description: "Tenant archived successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to archive tenant",
        variant: "destructive",
      });
    },
  });

  const unarchiveIndividualTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiRequest("PATCH", `/api/tenants/${tenantId}/unarchive`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setShowUnarchiveConfirm(null);
      toast({
        title: "Success",
        description: "Tenant unarchived successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to unarchive tenant",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiRequest("DELETE", `/api/tenants/${tenantId}/permanent`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      setShowPermanentDeleteConfirm(null);
      toast({
        title: "Success",
        description: "Tenant deleted permanently",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      const errorText = error?.toString() || '';
      if (errorText.includes('has relationships')) {
        toast({
          title: "Cannot Delete Tenant",
          description: "This tenant has lease or transaction history. Please archive instead of deleting.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete tenant",
          variant: "destructive",
        });
      }
    },
  });

  const createLeaseMutation = useMutation({
    mutationFn: async (data: InsertLease) => {
      const response = await apiRequest("POST", "/api/leases", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setShowLeaseForm(false);
      setSelectedTenantGroup(null);
      setSelectedLease(null);
      setIsRenewalMode(false);
      toast({
        title: "Success",
        description: "Lease created successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create lease",
        variant: "destructive",
      });
    },
  });

  const updateLeaseMutation = useMutation({
    mutationFn: async ({ leaseId, data }: { leaseId: string; data: Partial<InsertLease> }) => {
      const response = await apiRequest("PUT", `/api/leases/${leaseId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setShowLeaseForm(false);
      setSelectedTenantGroup(null);
      setSelectedLease(null);
      setIsRenewalMode(false);
      toast({
        title: "Success",
        description: "Lease updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update lease",
        variant: "destructive",
      });
    },
  });

  const filteredProperties = properties || [];
  
  const filteredTenantGroups = tenantGroups?.filter(group => {
    const groupLeases = leases.filter(lease => lease.tenantGroupId === group.id);
    const tenantStatus = getTenantStatus(group, groupLeases);
    const archiveMatch = showArchived ? tenantStatus === "Archived" : tenantStatus !== "Archived";
    
    const propertyMatch = propertyFilter === "all" || group.propertyId === propertyFilter;
    
    const unitMatch = unitFilter.length === 0 || (() => {
      const groupUnitIds = groupLeases.map(lease => lease.unitId);
      
      return groupUnitIds.some(unitId => unitFilter.includes(unitId)) ||
        (unitFilter.includes("common") && groupUnitIds.length === 0);
    })();
    
    if (entityFilter !== "all") {
      const property = properties?.find(p => p.id === group.propertyId);
    }
    
    return archiveMatch && propertyMatch && unitMatch;
  }) || [];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Tenants</h1>
          <p className="text-muted-foreground">Manage your tenant relationships</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Switch 
              id="show-archived-tenants"
              checked={showArchived}
              onCheckedChange={setShowArchived}
              data-testid="toggle-view-archived-tenants"
            />
            <Label htmlFor="show-archived-tenants" className="text-sm">
              View Archived ({showArchived ? 'Shown' : 'Hidden'})
            </Label>
          </div>

          <Select value={entityFilter} onValueChange={(value) => {
            setEntityFilter(value);
            if (value !== "all") {
              setPropertyFilter("all");
            }
          }}>
            <SelectTrigger className="w-44" data-testid="select-entity-filter">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {entities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={propertyFilter} onValueChange={(value) => {
            setPropertyFilter(value);
            setUnitFilter([]);
          }}>
            <SelectTrigger className="w-52" data-testid="select-property-filter">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {(properties || []).map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name || `${property.street}, ${property.city}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {propertyFilter !== "all" && (() => {
            const selectedProperty = properties?.find(p => p.id === propertyFilter);
            const propertyUnits = units.filter(unit => unit.propertyId === propertyFilter);
            const isBuilding = propertyUnits.length > 1;
            
            if (!isBuilding) return null;

            const handleUnitToggle = (unitId: string) => {
              const newFilter = [...unitFilter];
              if (newFilter.includes(unitId)) {
                setUnitFilter(newFilter.filter(id => id !== unitId));
              } else {
                setUnitFilter([...newFilter, unitId]);
              }
            };
            
            return (
              <div className="flex flex-col space-y-2 p-3 border rounded-md bg-muted/30">
                <span className="text-sm font-medium">Units (Optional - leave empty to apply to entire building)</span>
                <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unitFilter.includes("common")}
                      onChange={() => handleUnitToggle("common")}
                      className="rounded border-gray-300"
                      data-testid="checkbox-common-area"
                    />
                    <span className="text-sm">Common Area</span>
                  </label>
                  {propertyUnits.map((unit) => (
                    <label key={unit.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={unitFilter.includes(unit.id)}
                        onChange={() => handleUnitToggle(unit.id)}
                        className="rounded border-gray-300"
                        data-testid={`checkbox-unit-${unit.id}`}
                      />
                      <span className="text-sm">{unit.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}

          <Dialog open={showTenantForm} onOpenChange={(open) => {
            setShowTenantForm(open);
            if (!open) {
              setEditingTenant(null);
              setEditingTenantData(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-tenant">
                <Plus className="h-4 w-4 mr-2" />
                Add Tenant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTenant ? "Edit Tenant" : "Add New Tenant"}</DialogTitle>
              </DialogHeader>
              <TenantForm 
                initialData={editingTenantData || undefined}
                onSubmit={(data) => {
                  if (editingTenant) {
                    updateTenantMutation.mutate({ groupId: editingTenant.id, data });
                  } else {
                    createTenantMutation.mutate(data);
                  }
                }}
                onCancel={() => {
                  setShowTenantForm(false);
                  setEditingTenant(null);
                  setEditingTenantData(null);
                }}
                isLoading={createTenantMutation.isPending || updateTenantMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showLeaseForm} onOpenChange={setShowLeaseForm}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Lease Management</DialogTitle>
              </DialogHeader>
              {selectedTenantGroup && (
                <LeaseForm
                  tenantGroup={selectedTenantGroup}
                  units={units}
                  properties={properties}
                  existingLease={selectedLease || undefined}
                  isRenewal={isRenewalMode}
                  onSubmit={(data) => {
                    if (isRenewalMode) {
                      const renewalData = {
                        ...data,
                        startDate: selectedLease?.endDate ? new Date(new Date(selectedLease.endDate).getTime() + 24 * 60 * 60 * 1000) : data.startDate,
                      };
                      createLeaseMutation.mutate(renewalData);
                    } else if (selectedLease && !isRenewalMode) {
                      updateLeaseMutation.mutate({
                        leaseId: selectedLease.id,
                        data: data
                      });
                    } else {
                      createLeaseMutation.mutate(data);
                    }
                  }}
                  onCancel={() => {
                    setShowLeaseForm(false);
                    setSelectedTenantGroup(null);
                    setSelectedLease(null);
                    setIsRenewalMode(false);
                  }}
                  isLoading={createLeaseMutation.isPending || updateLeaseMutation.isPending}
                />
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archive Tenant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Archive this tenant? This will:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Mark tenant as "Archived" - they won't show in active lists</li>
                  <li>Preserve all historical data and lease information</li>
                  <li>Allow you to view their information in archived tenant reports</li>
                </ul>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Tip:</strong> Use this when tenants move out to keep historical records while cleaning up your active tenant list.
                  </p>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDeleteConfirm(null)}
                    disabled={archiveTenantMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      if (showDeleteConfirm) {
                        archiveTenantMutation.mutate(showDeleteConfirm);
                      }
                    }}
                    disabled={archiveTenantMutation.isPending}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {archiveTenantMutation.isPending ? "Archiving..." : "Archive Tenant"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!showArchiveConfirm} onOpenChange={() => setShowArchiveConfirm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archive Tenant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Archive this tenant? This will:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Mark tenant as "Archived" - they won't show in active lists</li>
                  <li>Preserve all lease and transaction history</li>
                  <li>Allow you to view their information in archived tenant reports</li>
                </ul>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    💡 <strong>Tip:</strong> Use this when tenants move out to keep historical records while cleaning up your active tenant list.
                  </p>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowArchiveConfirm(null)}
                    disabled={archiveIndividualTenantMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      if (showArchiveConfirm) {
                        archiveIndividualTenantMutation.mutate(showArchiveConfirm);
                      }
                    }}
                    disabled={archiveIndividualTenantMutation.isPending}
                    data-testid="button-confirm-archive-tenant"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {archiveIndividualTenantMutation.isPending ? "Archiving..." : "Archive Tenant"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!showUnarchiveConfirm} onOpenChange={() => setShowUnarchiveConfirm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Unarchive Tenant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Unarchive this tenant? This will:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Mark tenant as "Active" - they will show in active tenant lists</li>
                  <li>Restore access to all lease management features</li>
                  <li>Include them in active tenant reports and dashboards</li>
                </ul>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    ✅ <strong>Tip:</strong> Use this to reactivate a tenant you want to manage again.
                  </p>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowUnarchiveConfirm(null)}
                    disabled={unarchiveIndividualTenantMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="default" 
                    onClick={() => {
                      if (showUnarchiveConfirm) {
                        unarchiveIndividualTenantMutation.mutate(showUnarchiveConfirm);
                      }
                    }}
                    disabled={unarchiveIndividualTenantMutation.isPending}
                    data-testid="button-confirm-unarchive-tenant"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {unarchiveIndividualTenantMutation.isPending ? "Unarchiving..." : "Unarchive Tenant"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!showPermanentDeleteConfirm} onOpenChange={() => setShowPermanentDeleteConfirm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Permanently Delete Tenant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    ⚠️ <strong>Warning:</strong> This permanently deletes the tenant and cannot be undone.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  This will permanently remove the tenant if they have no:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Active or historical leases</li>
                  <li>Associated transaction records</li>
                  <li>Any financial or legal history</li>
                </ul>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    💡 <strong>Recommended:</strong> Use "Archive" instead to preserve historical records while hiding from active lists.
                  </p>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPermanentDeleteConfirm(null)}
                    disabled={permanentDeleteTenantMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      if (showPermanentDeleteConfirm) {
                        permanentDeleteTenantMutation.mutate(showPermanentDeleteConfirm);
                      }
                    }}
                    disabled={permanentDeleteTenantMutation.isPending}
                    data-testid="button-confirm-delete-tenant"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {permanentDeleteTenantMutation.isPending ? "Deleting..." : "Delete Permanently"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {tenantsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="group relative rounded-2xl overflow-hidden" data-testid={`skeleton-tenant-${i}`} style={{
              background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
              backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
              WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
              border: '2px solid rgba(255, 255, 255, 0.85)',
              boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)',
            }}>
              <div className="running-light-bar h-1" style={{
                backdropFilter: 'blur(16px) saturate(200%)',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)',
              }} />
              <div className="relative">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="h-6 bg-muted animate-pulse rounded" />
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </CardContent>
              </div>
            </div>
          ))}
        </div>
      ) : (filteredTenantGroups && filteredTenantGroups.length > 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTenantGroups.map((group, index) => {
          const groupLeases = leases.filter(lease => lease.tenantGroupId === group.id);
          const activeLease = groupLeases
            .filter(lease => lease.status === "Active")
            .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())[0];
          const isLeaseEndingSoon = (endDate: string | Date | null) => {
            if (!endDate) return false;
            const daysUntilEnd = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return daysUntilEnd <= 90 && daysUntilEnd > 0;
          };
          
          return (
            <div key={group.id} className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(139,92,246,0.15),0_15px_35px_rgba(59,130,246,0.10),0_8px_20px_rgba(0,0,0,0.08)]" data-testid={`card-tenant-${index}`} style={{
              background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
              backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
              WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
              border: '2px solid rgba(255, 255, 255, 0.85)',
              boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)',
            }}>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }} />
              <div className="running-light-bar h-1 transition-all duration-300" style={{
                backdropFilter: 'blur(16px) saturate(200%)',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)',
              }} />
              <div className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-12 h-12 bg-violet-100/60 rounded-lg flex items-center justify-center cursor-default">
                            <UsersRound className="h-6 w-6 text-violet-600" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Tenant Group</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-tenant-name-${index}`}>{group.name}</CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {group.propertyId && (
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-blue-600 font-medium">Property:</span>
                        <span data-testid={`text-tenant-property-${index}`}>
                          {(() => {
                            const property = properties?.find(p => p.id === group.propertyId);
                            return property ? (property.name || `${property.street}, ${property.city}`) : 'Property';
                          })()}
                        </span>
                      </div>
                    )}
                    
                    {activeLease ? (
                      <>
                        <div className="flex items-center space-x-2 mb-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span data-testid={`text-lease-rent-${index}`}>
                            ${activeLease.rent}/month
                          </span>
                          {isLeaseEndingSoon(activeLease.endDate) && (
                            <Badge variant="destructive" className="ml-2">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expiring Soon
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 mb-2">
                          <Calendar className="h-4 w-4" />
                          <span data-testid={`text-lease-dates-${index}`}>
                            {activeLease.startDate ? new Date(activeLease.startDate).toLocaleDateString() : 'N/A'} - {activeLease.endDate ? new Date(activeLease.endDate).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2 mb-2">
                          <FileText className="h-4 w-4" />
                          <span data-testid={`text-lease-status-${index}`}>
                            Lease: {activeLease.status}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center space-x-2 mb-2 text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span data-testid={`text-no-lease-${index}`}>No Active Lease</span>
                      </div>
                    )}
                    
                  </div>
                  
                  <p className="text-sm text-muted-foreground" data-testid={`text-tenant-created-${index}`}>
                    Added {group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  {group.status === "Archived" ? (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => {
                                setEditingTenant(group);
                                setShowTenantForm(true);
                              }}
                              data-testid={`button-edit-archived-tenant-${index}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>View / Edit</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => setShowUnarchiveConfirm(group.id)}
                              data-testid={`button-unarchive-tenant-${index}`}
                              disabled={unarchiveIndividualTenantMutation.isPending}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Unarchive</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={async () => {
                                try {
                                  const response = await apiRequest("GET", `/api/tenants/${group.id}/relationship-count`);
                                  const relationshipData = await response.json();
                                  
                                  if (relationshipData.count > 0) {
                                    toast({
                                      title: "Cannot Delete Tenant",
                                      description: `This tenant has ${relationshipData.count} relationship${relationshipData.count === 1 ? '' : 's'} (leases, transactions). Please archive instead of deleting.`,
                                      variant: "destructive",
                                    });
                                  } else {
                                    setShowPermanentDeleteConfirm(group.id);
                                  }
                                } catch (error) {
                                  console.error("Error checking tenant relationships:", error);
                                  toast({
                                    title: "Error",
                                    description: "Could not verify tenant relationships. Please try again.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid={`button-delete-tenant-${index}`}
                              disabled={permanentDeleteTenantMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete Permanently</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  ) : activeLease ? (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => {
                                setSelectedTenantGroup(group);
                                setSelectedLease(activeLease);
                                setShowLeaseForm(true);
                              }}
                              data-testid={`button-view-lease-${index}`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Manage Lease</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => {
                                setSelectedTenantGroup(group);
                                setSelectedLease(activeLease);
                                setIsRenewalMode(true);
                                setShowLeaseForm(true);
                              }}
                              data-testid={`button-renew-lease-${index}`}
                            >
                              <Calendar className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Renew Lease</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={async () => {
                                try {
                                  const response = await apiRequest("GET", `/api/tenants/${group.id}/members`);
                                  const groupTenants = await response.json();
                                  
                                  const formData = {
                                    tenantGroup: {
                                      name: group.name,
                                      propertyId: group.propertyId || "",
                                      unitId: ""
                                    },
                                    tenants: groupTenants.length > 0 ? groupTenants : [{
                                      firstName: "",
                                      lastName: "",
                                      email: "",
                                      phone: "",
                                      emergencyContact: "",
                                      emergencyPhone: "",
                                      notes: ""
                                    }]
                                  };
                                  
                                  setEditingTenant(group);
                                  setEditingTenantData(formData);
                                  setShowTenantForm(true);
                                } catch (error) {
                                  console.error("Error fetching tenant data:", error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to load tenant data",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid={`button-edit-tenant-${index}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => setShowArchiveConfirm(group.id)}
                              data-testid={`button-archive-tenant-${index}`}
                              disabled={archiveIndividualTenantMutation.isPending}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Archive</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  ) : (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => {
                                setSelectedTenantGroup(group);
                                setShowLeaseForm(true);
                              }}
                              data-testid={`button-create-lease-${index}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Create Lease</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={async () => {
                                try {
                                  const response = await apiRequest("GET", `/api/tenants/${group.id}/members`);
                                  const groupTenants = await response.json();
                                  
                                  const formData = {
                                    tenantGroup: {
                                      name: group.name,
                                      propertyId: group.propertyId || "",
                                      unitId: ""
                                    },
                                    tenants: groupTenants.length > 0 ? groupTenants : [{
                                      firstName: "",
                                      lastName: "",
                                      email: "",
                                      phone: "",
                                      emergencyContact: "",
                                      emergencyPhone: "",
                                      notes: ""
                                    }]
                                  };
                                  
                                  setEditingTenant(group);
                                  setEditingTenantData(formData);
                                  setShowTenantForm(true);
                                } catch (error) {
                                  console.error("Error fetching tenant data:", error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to load tenant data",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid={`button-edit-tenant-${index}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => setShowArchiveConfirm(group.id)}
                              data-testid={`button-archive-tenant-${index}`}
                              disabled={archiveIndividualTenantMutation.isPending}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Archive</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                </div>
              </CardContent>
              </div>
            </div>
          );
        })}
        </div>
      ) : (
        <div className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(139,92,246,0.15),0_15px_35px_rgba(59,130,246,0.10),0_8px_20px_rgba(0,0,0,0.08)]" style={{
          background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
          backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
          WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
          border: '2px solid rgba(255, 255, 255, 0.85)',
          boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)',
        }}>
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/12 group-hover:to-blue-500/12 transition-all duration-300 rounded-xl" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }} />
          <div className="running-light-bar h-1 transition-all duration-300" style={{
            backdropFilter: 'blur(16px) saturate(200%)',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)',
          }} />
          <div className="relative">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2" data-testid="text-no-tenants">No Tenants Yet</h3>
              <p className="text-muted-foreground mb-4">Start managing tenant relationships by adding your first tenant.</p>
              <Button onClick={() => setShowTenantForm(true)} data-testid="button-add-first-tenant">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Tenant
              </Button>
            </CardContent>
          </div>
        </div>
      )}
    </>
  );
}