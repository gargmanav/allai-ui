import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PropertyForm from "@/components/forms/property-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building, Plus, MapPin, Home, Calendar, Building2, Filter, ChevronDown, ChevronRight, Bed, Bath, DollarSign, Settings, Bell, Archive, Trash2, RotateCcw, Warehouse, HousePlus, Store, LayoutGrid, List as ListIcon, TrendingUp, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Property, OwnershipEntity, Unit } from "@shared/schema";
import ImpersonationBanner from "@/components/admin/impersonation-banner";

// Extended property type that includes ownership information  
type PropertyWithOwnerships = Property & {
  status?: "Active" | "Archived"; // Add status with default
  ownerships?: Array<{
    entityId: string;
    percent: number;
    entityName: string;
    entityType: string;
  }>;
};

export default function Properties() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [editingProperty, setEditingProperty] = useState<PropertyWithOwnerships | null>(null);
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<string | null>(null);
  const [showUnarchiveConfirm, setShowUnarchiveConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [performancePropertyId, setPerformancePropertyId] = useState<string | null>(null);

  const { data: performanceData, isLoading: performanceLoading } = useQuery<any>({
    queryKey: ["/api/properties", performancePropertyId, "performance"],
    retry: false,
    enabled: !!performancePropertyId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPropertyTypeIcon = (type: string) => {
    switch (type) {
      case "Single Family": return <Home className="h-6 w-6 text-violet-600" />;
      case "Condo": return <Building className="h-6 w-6 text-violet-600" />;
      case "Townhome": return <HousePlus className="h-6 w-6 text-violet-600" />;
      case "Residential Building": return <Building2 className="h-6 w-6 text-violet-600" />;
      case "Commercial Unit": return <Store className="h-6 w-6 text-violet-600" />;
      case "Commercial Building": return <Warehouse className="h-6 w-6 text-violet-600" />;
      default: return <Building className="h-6 w-6 text-violet-600" />;
    }
  };

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: properties, isLoading: propertiesLoading, error } = useQuery<PropertyWithOwnerships[]>({
    queryKey: ["/api/properties"],
    retry: false,
  });

  const { data: entities } = useQuery<OwnershipEntity[]>({
    queryKey: ["/api/entities"],
    retry: false,
  });

  // Fetch units for properties
  const { data: allUnits = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    retry: false,
  });

  const createPropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      // Separate pending equipment from property data
      const { pendingEquipment, ...propertyData } = data;
      
      // Create the property first
      const response = await apiRequest("POST", "/api/properties", propertyData);
      const newProperty = await response.json();
      
      // If there's pending equipment, save it now that we have a propertyId
      if (pendingEquipment && pendingEquipment.length > 0 && newProperty.id) {
        const failedItems: string[] = [];
        for (const equipment of pendingEquipment) {
          try {
            await apiRequest('POST', `/api/properties/${newProperty.id}/equipment`, equipment);
          } catch (error) {
            console.error('Failed to save equipment:', error);
            failedItems.push(equipment.name || 'Unknown item');
            // Continue with other equipment items even if one fails
          }
        }
        
        // Store failed items for notification in onSuccess
        if (failedItems.length > 0) {
          newProperty._failedEquipment = failedItems;
        }
      }
      
      return newProperty;
    },
    onSuccess: (response) => {
      // Invalidate both properties and units queries since we might have created a unit too
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      
      // Also invalidate equipment query if we saved equipment
      if (response.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/properties', response.id, 'equipment'] });
        queryClient.invalidateQueries({ queryKey: ['/api/predictive-insights'] });
      }
      
      setShowPropertyForm(false);
      
      // Check if there were any failed equipment saves
      if (response._failedEquipment && response._failedEquipment.length > 0) {
        toast({
          title: "Property created with warnings",
          description: `Property saved successfully, but ${response._failedEquipment.length} equipment item(s) failed to save: ${response._failedEquipment.join(', ')}. Please try adding them again.`,
          variant: "destructive",
        });
      } else {
        const message = response.unit 
          ? "Property and default unit created successfully" 
          : "Property created successfully";
        
        toast({
          title: "Success",
          description: message,
        });
      }
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
        description: "Failed to create property",
        variant: "destructive",
      });
    },
  });

  const updatePropertyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/properties/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      setShowPropertyForm(false);
      setEditingProperty(null);
      toast({
        title: "Success",
        description: "Property updated successfully",
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
        description: "Failed to update property",
        variant: "destructive",
      });
    },
  });

  const archivePropertyMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      const response = await apiRequest("PATCH", `/api/properties/${propertyId}/archive`);
      if (response.status === 204) return null;
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      setShowArchiveConfirm(null);
      toast({
        title: "Success",
        description: "Property archived successfully",
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
        description: "Failed to archive property",
        variant: "destructive",
      });
    },
  });

  const deletePropertyMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      const response = await apiRequest("DELETE", `/api/properties/${propertyId}/permanent`);
      if (response.status === 204) return null;
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      setShowDeleteConfirm(null);
      toast({
        title: "Success",
        description: "Property deleted permanently",
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
        description: "Failed to delete property",
        variant: "destructive",
      });
    },
  });

  // Unarchive property mutation
  const unarchivePropertyMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      const response = await apiRequest("PATCH", `/api/properties/${propertyId}/unarchive`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      setShowUnarchiveConfirm(null);
      toast({
        title: "Success",
        description: "Property unarchived successfully",
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
        description: "Failed to unarchive property",
        variant: "destructive",
      });
    },
  });

  if (isLoading || !isAuthenticated) {
    return null;
  }

  if (error && isUnauthorizedError(error as Error)) {
    return null;
  }

  // Filter properties by selected ownership entity and archive status
  const filteredProperties = properties?.filter((property) => {
    // Filter by entity
    const entityMatch = selectedEntity === "all" || property.ownerships?.some((ownership: any) => ownership.entityId === selectedEntity);
    
    // Filter by archive status
    const isArchived = property.status === "Archived";
    const statusMatch = showArchived ? isArchived : !isArchived;
    
    return entityMatch && statusMatch;
  }) || [];

  const handleEditProperty = async (property: PropertyWithOwnerships) => {
    // Convert string values to correct types for form compatibility
    const propertyForEditing = {
      ...property,
      propertyValue: property.propertyValue ? Number(property.propertyValue) : undefined,
      appreciationRate: property.appreciationRate ? Number(property.appreciationRate) : undefined,
      // Convert mortgage fields to proper types
      monthlyMortgage: property.monthlyMortgage ? Number(property.monthlyMortgage) : undefined,
      interestRate: property.interestRate ? Number(property.interestRate) : undefined,
      purchasePrice: property.purchasePrice ? Number(property.purchasePrice) : undefined,
      downPayment: property.downPayment ? Number(property.downPayment) : undefined,
      salePrice: property.salePrice ? Number(property.salePrice) : undefined,
      // Convert date fields to Date objects
      acquisitionDate: property.acquisitionDate ? new Date(property.acquisitionDate) : undefined,
      saleDate: property.saleDate ? new Date(property.saleDate) : undefined,
      mortgageStartDate: property.mortgageStartDate ? new Date(property.mortgageStartDate) : undefined,
      mortgageStartDate2: property.mortgageStartDate2 ? new Date(property.mortgageStartDate2) : undefined,
    };
    
    // Fetch the property's units to get appliance data and determine numberOfUnits
    try {
      const unitsResponse = await apiRequest("GET", `/api/units`);
      const units: Unit[] = await unitsResponse.json();
      const propertyUnits = units.filter(unit => unit.propertyId === property.id);
      
      // Add units-related fields based on actual units (using type casting)
      (propertyForEditing as any).numberOfUnits = propertyUnits.length || 1;
      (propertyForEditing as any).hasMultipleUnits = propertyUnits.length > 1;
      (propertyForEditing as any).createDefaultUnit = propertyUnits.length > 0;
      
      console.log("🔧 Setting numberOfUnits to:", propertyUnits.length);
      console.log("🔧 Setting hasMultipleUnits to:", propertyUnits.length > 1);
      console.log("🔧 Final propertyForEditing:", propertyForEditing);
      
      // Add the first unit as defaultUnit to the editing property
      if (propertyUnits.length > 0) {
        const firstUnit = propertyUnits[0];
        
        // Fetch appliances for this unit
        const appliancesResponse = await apiRequest("GET", `/api/units/${firstUnit.id}/appliances`);
        const appliances = await appliancesResponse.json();
        
        (propertyForEditing as any).defaultUnit = {
          id: firstUnit.id,
          label: firstUnit.label,
          bedrooms: firstUnit.bedrooms,
          bathrooms: firstUnit.bathrooms ? parseFloat(firstUnit.bathrooms) : undefined,
          sqft: firstUnit.sqft,
          rentAmount: firstUnit.rentAmount,
          deposit: firstUnit.deposit,
          notes: firstUnit.notes,
          hvacBrand: firstUnit.hvacBrand,
          hvacModel: firstUnit.hvacModel,
          hvacYear: firstUnit.hvacYear,
          hvacLifetime: firstUnit.hvacLifetime,
          hvacReminder: firstUnit.hvacReminder,
          waterHeaterBrand: firstUnit.waterHeaterBrand,
          waterHeaterModel: firstUnit.waterHeaterModel,
          waterHeaterYear: firstUnit.waterHeaterYear,
          waterHeaterLifetime: firstUnit.waterHeaterLifetime,
          waterHeaterReminder: firstUnit.waterHeaterReminder,
          applianceNotes: firstUnit.applianceNotes,
          appliances: appliances || [],
        };
        
        // Mark that this property has existing unit data but don't check the creation checkbox
        (propertyForEditing as any).hasExistingUnit = true;
        (propertyForEditing as any).createDefaultUnit = false;
      }
    } catch (error) {
      console.error("Error loading unit data:", error);
      // Continue with editing even if unit data fails to load
    }
    
    // Update the editing property with unit data (cast to expected type)
    setEditingProperty(propertyForEditing as any);
    setShowPropertyForm(true);
  };

  const handleCloseForm = () => {
    setShowPropertyForm(false);
    setEditingProperty(null);
  };

  const handleFormSubmit = (data: any) => {
    if (editingProperty) {
      updatePropertyMutation.mutate({ id: editingProperty.id, data });
    } else {
      createPropertyMutation.mutate(data);
    }
  };

  const togglePropertyUnits = (propertyId: string) => {
    setExpandedProperties(prev => {
      const newSet = new Set(prev);
      if (newSet.has(propertyId)) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });
  };

  const getPropertyUnits = (propertyId: string): Unit[] => {
    return allUnits.filter(unit => unit.propertyId === propertyId);
  };

  return (
    <div data-testid="page-properties">
      <ImpersonationBanner />
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Properties</h1>
          <p className="text-muted-foreground">Manage your portfolio</p>
        </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                  <SelectTrigger className="w-48" data-testid="select-entity-filter">
                    <SelectValue placeholder="Filter by ownership" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    {entities?.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-3 w-3" />
                          <span>{entity.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {entity.type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="show-archived"
                    checked={showArchived}
                    onCheckedChange={setShowArchived}
                    data-testid="toggle-view-archived"
                  />
                  <Label htmlFor="show-archived" className="text-sm">
                    View Archived ({showArchived ? filteredProperties.length : 'Hidden'})
                  </Label>
                </div>
              </div>
              
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button 
                  variant={viewMode === "cards" ? "default" : "ghost"} 
                  size="sm" 
                  className="rounded-none px-3"
                  onClick={() => setViewMode("cards")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === "list" ? "default" : "ghost"} 
                  size="sm" 
                  className="rounded-none px-3"
                  onClick={() => setViewMode("list")}
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
              </div>

              <Button onClick={() => setShowPropertyForm(true)} data-testid="button-add-property" className="bg-blue-500/90 hover:bg-blue-600/92 text-white shadow-md shadow-blue-300/40 backdrop-blur-sm border border-blue-400/45">
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
              
              <Dialog open={showPropertyForm} onOpenChange={handleCloseForm}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProperty ? "Edit Property" : "Add New Property"}</DialogTitle>
                </DialogHeader>
                <PropertyForm 
                  entities={entities || []}
                  onSubmit={handleFormSubmit}
                  onCancel={handleCloseForm}
                  isLoading={createPropertyMutation.isPending || updatePropertyMutation.isPending}
                  initialData={editingProperty || undefined}
                />
              </DialogContent>
            </Dialog>

            {/* Archive Confirmation Dialog */}
            <Dialog open={!!showArchiveConfirm} onOpenChange={() => setShowArchiveConfirm(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Archive Property</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Archive this property? This will:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Mark property as "Archived" - it won't show in active lists</li>
                    <li>Preserve all historical data, units, and lease information</li>
                    <li>Allow you to view it in archived property reports</li>
                  </ul>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      💡 <strong>Tip:</strong> Use this when you sell a property or want to remove it from active management while keeping records.
                    </p>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowArchiveConfirm(null)}
                      disabled={archivePropertyMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        if (showArchiveConfirm) {
                          archivePropertyMutation.mutate(showArchiveConfirm);
                        }
                      }}
                      disabled={archivePropertyMutation.isPending}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      {archivePropertyMutation.isPending ? "Archiving..." : "Archive Property"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Unarchive Confirmation Dialog */}
            <Dialog open={!!showUnarchiveConfirm} onOpenChange={() => setShowUnarchiveConfirm(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Unarchive Property</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Unarchive this property? This will:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Mark property as "Active" - it will show in active property lists</li>
                    <li>Restore access to all units, leases, and management features</li>
                    <li>Include it in active property reports and dashboards</li>
                  </ul>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✅ <strong>Tip:</strong> Use this to reactivate a property you want to manage again.
                    </p>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowUnarchiveConfirm(null)}
                      disabled={unarchivePropertyMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="default" 
                      onClick={() => {
                        if (showUnarchiveConfirm) {
                          unarchivePropertyMutation.mutate(showUnarchiveConfirm);
                        }
                      }}
                      disabled={unarchivePropertyMutation.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {unarchivePropertyMutation.isPending ? "Unarchiving..." : "Unarchive Property"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-destructive">⚠️ Permanently Delete Property</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-destructive">This action cannot be undone.</strong> Permanently delete this property will:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li className="text-destructive">Completely remove the property and all related data</li>
                    <li className="text-destructive">Delete all units, leases, and tenant information</li>
                    <li className="text-destructive">Remove all transaction history and financial records</li>
                    <li className="text-destructive">Delete all reminders and maintenance records</li>
                  </ul>
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                    <p className="text-sm text-red-800">
                      🚨 <strong>Warning:</strong> Use this only for properties created by mistake. For properties you no longer manage, use <strong>Archive</strong> instead to preserve records.
                    </p>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDeleteConfirm(null)}
                      disabled={deletePropertyMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        if (showDeleteConfirm) {
                          deletePropertyMutation.mutate(showDeleteConfirm);
                        }
                      }}
                      disabled={deletePropertyMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletePropertyMutation.isPending ? "Deleting..." : "Delete Permanently"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {propertiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="group relative rounded-2xl overflow-hidden transition-all duration-300" data-testid={`skeleton-property-${i}`} style={{
                  background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
                  backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                  WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                  border: '2px solid rgba(255, 255, 255, 0.85)',
                  boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)',
                }}>
                  <div className="running-light-bar h-1 transition-all duration-300" style={{
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
          ) : (filteredProperties && filteredProperties.length > 0) ? (
            viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((property, index) => (
                <div key={property.id} className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(139,92,246,0.15),0_15px_35px_rgba(59,130,246,0.10),0_8px_20px_rgba(0,0,0,0.08)] ${property.status === "Archived" ? "opacity-80" : ""}`} data-testid={`card-property-${index}`} style={{
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
                              <div className="w-12 h-12 bg-violet-100/60 rounded-lg flex items-center justify-center cursor-pointer">
                                {getPropertyTypeIcon(property.type)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{property.type}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-property-name-${index}`}>{property.name}</CardTitle>
                          {property.status === "Archived" && (
                            <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 mt-1" data-testid={`badge-archived-${index}`}>
                              Archived
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span data-testid={`text-property-address-${index}`}>
                          {property.street}, {property.city}, {property.state} {property.zipCode}
                        </span>
                      </div>
                      
                      {property.yearBuilt && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span data-testid={`text-property-year-${index}`}>Built in {property.yearBuilt}</span>
                        </div>
                      )}
                      
                      {property.sqft && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Home className="h-4 w-4" />
                          <span data-testid={`text-property-sqft-${index}`}>{property.sqft.toLocaleString()} sq ft</span>
                        </div>
                      )}
                      
                      {property.notes && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-property-notes-${index}`}>
                          {property.notes}
                        </p>
                      )}
                      
                      {/* Ownership Information */}
                      {property.ownerships && property.ownerships.length > 0 && (
                        <div className="border-t pt-3 mt-3">
                          <div className="flex items-center space-x-2 mb-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">Ownership</span>
                          </div>
                          <div className="space-y-1">
                            {property.ownerships.map((ownership, ownershipIndex) => (
                              <div key={ownershipIndex} className="flex items-center justify-between text-sm">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    {ownership.entityType}
                                  </Badge>
                                  <span data-testid={`text-ownership-entity-${index}-${ownershipIndex}`}>
                                    {ownership.entityName}
                                  </span>
                                </div>
                                <span className="font-medium text-primary" data-testid={`text-ownership-percent-${index}-${ownershipIndex}`}>
                                  {ownership.percent}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Central Building Equipment Section - Show when expanded and is a building */}
                    {expandedProperties.has(property.id) && (property.type === "Residential Building" || property.type === "Commercial Building") && (
                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Central Building Equipment</span>
                        </div>
                        
                        {(property.buildingHvacBrand || property.buildingWaterBrand || property.buildingWaterShutoff || property.buildingElectricalPanel || property.buildingEquipmentNotes) ? (
                          <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                            {/* Central HVAC */}
                            {(property.buildingHvacBrand || property.buildingHvacModel || property.buildingHvacYear) && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Settings className="h-3 w-3 text-blue-500" />
                                  <span className="text-xs font-medium text-blue-700">Central HVAC System</span>
                                  {property.buildingHvacReminder && (
                                    <div className="flex items-center space-x-1 text-xs text-orange-600">
                                      <span>📅</span>
                                      <span>Reminder</span>
                                    </div>
                                  )}
                                </div>
                                <div className="ml-5 text-xs text-muted-foreground space-y-1">
                                  {property.buildingHvacBrand && (
                                    <div><span className="font-medium">Brand:</span> {property.buildingHvacBrand}</div>
                                  )}
                                  {property.buildingHvacModel && (
                                    <div><span className="font-medium">Model:</span> {property.buildingHvacModel}</div>
                                  )}
                                  <div className="flex items-center space-x-4">
                                    {property.buildingHvacYear && (
                                      <span><span className="font-medium">Year:</span> {property.buildingHvacYear}</span>
                                    )}
                                    {property.buildingHvacLifetime && (
                                      <span><span className="font-medium">Expected lifetime:</span> {property.buildingHvacLifetime} years</span>
                                    )}
                                  </div>
                                  {property.buildingHvacLocation && (
                                    <div><span className="font-medium">Location:</span> {property.buildingHvacLocation}</div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Central Water/Boiler */}
                            {(property.buildingWaterBrand || property.buildingWaterModel || property.buildingWaterYear) && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Settings className="h-3 w-3 text-blue-500" />
                                  <span className="text-xs font-medium text-blue-700">Central Water/Boiler System</span>
                                  {property.buildingWaterReminder && (
                                    <div className="flex items-center space-x-1 text-xs text-orange-600">
                                      <span>📅</span>
                                      <span>Reminder</span>
                                    </div>
                                  )}
                                </div>
                                <div className="ml-5 text-xs text-muted-foreground space-y-1">
                                  {property.buildingWaterBrand && (
                                    <div><span className="font-medium">Brand:</span> {property.buildingWaterBrand}</div>
                                  )}
                                  {property.buildingWaterModel && (
                                    <div><span className="font-medium">Model:</span> {property.buildingWaterModel}</div>
                                  )}
                                  <div className="flex items-center space-x-4">
                                    {property.buildingWaterYear && (
                                      <span><span className="font-medium">Year:</span> {property.buildingWaterYear}</span>
                                    )}
                                    {property.buildingWaterLifetime && (
                                      <span><span className="font-medium">Expected lifetime:</span> {property.buildingWaterLifetime} years</span>
                                    )}
                                  </div>
                                  {property.buildingWaterLocation && (
                                    <div><span className="font-medium">Location:</span> {property.buildingWaterLocation}</div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Building Utilities */}
                            {(property.buildingWaterShutoff || property.buildingElectricalPanel) && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Settings className="h-3 w-3 text-green-500" />
                                  <span className="text-xs font-medium text-green-700">Building Utilities</span>
                                </div>
                                <div className="ml-5 text-xs text-muted-foreground space-y-1">
                                  {property.buildingWaterShutoff && (
                                    <div><span className="font-medium">Water shut-off:</span> {property.buildingWaterShutoff}</div>
                                  )}
                                  {property.buildingElectricalPanel && (
                                    <div><span className="font-medium">Electrical panel:</span> {property.buildingElectricalPanel}</div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Building Equipment Notes */}
                            {property.buildingEquipmentNotes && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Settings className="h-3 w-3 text-gray-500" />
                                  <span className="text-xs font-medium text-gray-700">Equipment Notes</span>
                                </div>
                                <div className="ml-5 text-xs text-muted-foreground">
                                  {property.buildingEquipmentNotes}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No Central Equipment</p>
                            <p className="text-xs">Click Edit to add building equipment details.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Units Section - Show when expanded */}
                    {expandedProperties.has(property.id) && (
                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Units</span>
                        </div>
                        
                        {getPropertyUnits(property.id).length > 0 ? (
                          <div className="space-y-3">
                            {getPropertyUnits(property.id).map((unit, unitIndex) => (
                              <div key={unit.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm" data-testid={`text-unit-label-${index}-${unitIndex}`}>
                                    {unit.label}
                                  </h4>
                                  {unit.rentAmount && (
                                    <div className="flex items-center space-x-1 text-sm font-medium text-green-600">
                                      <DollarSign className="h-3 w-3" />
                                      <span data-testid={`text-unit-rent-${index}-${unitIndex}`}>
                                        ${unit.rentAmount.toLocaleString()}/mo
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                  {unit.bedrooms !== null && (
                                    <div className="flex items-center space-x-1">
                                      <Bed className="h-3 w-3" />
                                      <span>{unit.bedrooms} bed</span>
                                    </div>
                                  )}
                                  {unit.bathrooms !== null && (
                                    <div className="flex items-center space-x-1">
                                      <Bath className="h-3 w-3" />
                                      <span>{unit.bathrooms} bath</span>
                                    </div>
                                  )}
                                  {unit.sqft && (
                                    <div className="flex items-center space-x-1">
                                      <Home className="h-3 w-3" />
                                      <span>{unit.sqft.toLocaleString()} sq ft</span>
                                    </div>
                                  )}
                                </div>
                                
                                {unit.notes && (
                                  <p className="text-xs text-muted-foreground" data-testid={`text-unit-notes-${index}-${unitIndex}`}>
                                    {unit.notes}
                                  </p>
                                )}
                                
                                {/* Equipment Section */}
                                {(unit.hvacBrand || unit.waterHeaterBrand || unit.applianceNotes) && (
                                  <div className="border-t pt-3 mt-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className="text-xs font-medium text-foreground flex items-center space-x-1">
                                        <Settings className="h-3 w-3" />
                                        <span>Equipment</span>
                                      </h5>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => handleEditProperty(property)}
                                        data-testid={`button-edit-equipment-${index}-${unitIndex}`}
                                      >
                                        Edit
                                      </Button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                      {/* HVAC */}
                                      {unit.hvacBrand && (
                                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-md p-2 border-l-2 border-blue-400">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                                <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">H</span>
                                              </div>
                                              <div>
                                                <div className="text-xs font-medium text-blue-900 dark:text-blue-100">HVAC System</div>
                                                <div className="text-xs text-blue-700 dark:text-blue-300">
                                                  {unit.hvacBrand}
                                                  {unit.hvacModel && ` ${unit.hvacModel}`}
                                                  {unit.hvacYear && ` (${unit.hvacYear})`}
                                                </div>
                                              </div>
                                            </div>
                                            {unit.hvacReminder && (
                                              <div className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400">
                                                <Bell className="h-3 w-3" />
                                                <span>Reminder</span>
                                              </div>
                                            )}
                                          </div>
                                          {unit.hvacLifetime && (
                                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 ml-8">
                                              Expected lifetime: {unit.hvacLifetime} years
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* Water Heater */}
                                      {unit.waterHeaterBrand && (
                                        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-md p-2 border-l-2 border-orange-400">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                                <span className="text-orange-600 dark:text-orange-400 text-xs font-medium">W</span>
                                              </div>
                                              <div>
                                                <div className="text-xs font-medium text-orange-900 dark:text-orange-100">Water Heater</div>
                                                <div className="text-xs text-orange-700 dark:text-orange-300">
                                                  {unit.waterHeaterBrand}
                                                  {unit.waterHeaterModel && ` ${unit.waterHeaterModel}`}
                                                  {unit.waterHeaterYear && ` (${unit.waterHeaterYear})`}
                                                </div>
                                              </div>
                                            </div>
                                            {unit.waterHeaterReminder && (
                                              <div className="flex items-center space-x-1 text-xs text-orange-600 dark:text-orange-400">
                                                <Bell className="h-3 w-3" />
                                                <span>Reminder</span>
                                              </div>
                                            )}
                                          </div>
                                          {unit.waterHeaterLifetime && (
                                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 ml-8">
                                              Expected lifetime: {unit.waterHeaterLifetime} years
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* Equipment Notes */}
                                      {unit.applianceNotes && (
                                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-md p-2 border border-gray-200 dark:border-gray-700">
                                          <div className="text-xs">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">Equipment Notes:</span>
                                            <div className="text-gray-600 dark:text-gray-400 mt-1">{unit.applianceNotes}</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            <Home className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Default Unit</p>
                            <p className="text-xs">This property has one main unit. Click Edit to add unit details.</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => togglePropertyUnits(property.id)}
                              data-testid={`button-view-units-${index}`}
                            >
                              {expandedProperties.has(property.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Units ({Math.max(getPropertyUnits(property.id).length, 1)})</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => setPerformancePropertyId(property.id)}
                              data-testid={`button-view-performance-${index}`}
                            >
                              <TrendingUp className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>View Performance</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => handleEditProperty(property)}
                              data-testid={`button-edit-property-${index}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit Property</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {property.status === "Archived" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full"
                                onClick={() => setShowUnarchiveConfirm(property.id)}
                                data-testid={`button-unarchive-property-${index}`}
                                disabled={unarchivePropertyMutation.isPending}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Unarchive</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full"
                                onClick={() => setShowArchiveConfirm(property.id)}
                                data-testid={`button-archive-property-${index}`}
                                disabled={archivePropertyMutation.isPending}
                              >
                                <Archive className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Archive</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              onClick={() => setShowDeleteConfirm(property.id)}
                              data-testid={`button-delete-property-${index}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardContent>
                  </div>
                </div>
              ))}
            </div>
            ) : (
            <div className="space-y-2">
              {filteredProperties.map((property, index) => (
                <div key={property.id} className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(139,92,246,0.10),0_8px_20px_rgba(59,130,246,0.06),0_4px_12px_rgba(0,0,0,0.05)] ${property.status === "Archived" ? "opacity-80" : ""}`} data-testid={`list-property-${index}`} style={{
                  background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
                  backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                  WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
                  border: '2px solid rgba(255, 255, 255, 0.85)',
                  boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), 0 10px 40px rgba(0, 0, 0, 0.06)',
                }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/8 group-hover:to-blue-500/8 transition-all duration-300 rounded-xl" />
                  <div className="running-light-bar h-1 transition-all duration-300" style={{
                    backdropFilter: 'blur(16px) saturate(200%)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)',
                  }} />
                  <div className="relative flex items-center p-4 gap-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-10 h-10 bg-violet-100/60 rounded-lg flex items-center justify-center shrink-0 cursor-pointer">
                            {getPropertyTypeIcon(property.type)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{property.type}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{property.name}</h3>
                        {property.status === "Archived" && (
                          <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 shrink-0">
                            Archived
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {property.street}, {property.city}
                        </span>
                        {property.sqft && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Home className="h-3 w-3" />
                            {property.sqft.toLocaleString()} sqft
                          </span>
                        )}
                        <span className="shrink-0">Units: {Math.max(getPropertyUnits(property.id).length, 1)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => togglePropertyUnits(property.id)} data-testid={`button-list-view-units-${index}`}>
                        {expandedProperties.has(property.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setPerformancePropertyId(property.id)} data-testid={`button-list-view-performance-${index}`}>
                        Performance
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => handleEditProperty(property)} data-testid={`button-list-edit-property-${index}`}>
                        Edit
                      </Button>
                      {property.status === "Archived" ? (
                        <Button variant="outline" size="sm" className="px-2" onClick={() => setShowUnarchiveConfirm(property.id)} disabled={unarchivePropertyMutation.isPending} data-testid={`button-list-unarchive-property-${index}`}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="px-2" onClick={() => setShowArchiveConfirm(property.id)} disabled={archivePropertyMutation.isPending} data-testid={`button-list-archive-property-${index}`}>
                          <Archive className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm(property.id)} data-testid={`button-list-delete-property-${index}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )
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
                  <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2" data-testid="text-no-properties">No Properties Yet</h3>
                  <p className="text-muted-foreground mb-4">Start building your property portfolio by adding your first property.</p>
                  <Button onClick={() => setShowPropertyForm(true)} data-testid="button-add-first-property" className="bg-blue-500/90 hover:bg-blue-600/92 text-white shadow-md shadow-blue-300/40 backdrop-blur-sm border border-blue-400/45">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Property
                  </Button>
                </CardContent>
              </div>
            </div>
          )}

      <Dialog open={!!performancePropertyId} onOpenChange={(open) => !open && setPerformancePropertyId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100/60 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <span>Property Performance</span>
                {performanceData?.property && (
                  <p className="text-sm font-normal text-muted-foreground mt-0.5">
                    {performanceData.property.name} — {performanceData.property.street}, {performanceData.property.city}
                  </p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {performanceLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 rounded-lg border">
                  <div className="h-4 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : performanceData?.metrics ? (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border bg-gradient-to-br from-violet-50 to-white">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Current Value</p>
                  <p className="text-xl font-bold">{formatCurrency(performanceData.metrics.currentValue)}</p>
                  {performanceData.metrics.appreciationGain !== 0 && (
                    <p className={`text-xs mt-1 ${performanceData.metrics.appreciationGain > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {performanceData.metrics.appreciationGain > 0 ? '+' : ''}{formatCurrency(performanceData.metrics.appreciationGain)}
                    </p>
                  )}
                </div>
                <div className="p-4 rounded-xl border bg-gradient-to-br from-blue-50 to-white">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Total Units</p>
                  <p className="text-xl font-bold">{performanceData.metrics.totalUnits}</p>
                </div>
                <div className="p-4 rounded-xl border bg-gradient-to-br from-green-50 to-white">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Monthly Revenue</p>
                  <p className="text-xl font-bold">{formatCurrency(performanceData.metrics.monthlyRevenue)}</p>
                </div>
                <div className="p-4 rounded-xl border bg-gradient-to-br from-emerald-50 to-white">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Net Cash Flow</p>
                  <p className={`text-xl font-bold ${performanceData.metrics.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(performanceData.metrics.netCashFlow)}
                  </p>
                  <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Revenue Collection
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Expected</p>
                    <p className="text-lg font-bold text-orange-600">{formatCurrency(performanceData.metrics.expectedMonthlyRevenue)}</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Collected</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(performanceData.metrics.actualMonthlyRevenue)}</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Collection Rate</p>
                    <p className={`text-lg font-bold ${performanceData.metrics.collectionRate >= 95 ? 'text-green-600' : performanceData.metrics.collectionRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {performanceData.metrics.collectionRate}%
                    </p>
                  </div>
                </div>
              </div>

              {performanceData.entities?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Ownership Structure
                  </h3>
                  <div className="space-y-2">
                    {performanceData.entities.map((entity: any, idx: number) => (
                      <div key={entity.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium text-sm">{entity.name}</p>
                          <Badge variant="outline" className="text-xs">{entity.type}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{entity.ownershipPercent}%</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(performanceData.metrics.currentValue * (entity.ownershipPercent / 100))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {performanceData.units?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Units
                  </h3>
                  <div className="space-y-2">
                    {performanceData.units.map((unit: any, idx: number) => (
                      <div key={unit.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium text-sm">{unit.label}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {unit.bedrooms && <span>{unit.bedrooms} bed</span>}
                            {unit.bathrooms && <span>{unit.bathrooms} bath</span>}
                            {unit.sqft && <span>{unit.sqft} sqft</span>}
                          </div>
                        </div>
                        {unit.rentAmount && (
                          <p className="font-semibold">{formatCurrency(Number(unit.rentAmount))}/mo</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Property not found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
