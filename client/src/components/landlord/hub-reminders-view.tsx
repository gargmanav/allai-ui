import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ReminderForm from "@/components/forms/reminder-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Plus, Clock, CheckCircle, Calendar, AlertTriangle, DollarSign, FileText, Wrench, Shield, Edit, Trash2, CalendarDays, Repeat, List, ChevronLeft, ChevronRight, LayoutGrid, MapPin } from "lucide-react";
import type { Reminder, Property, OwnershipEntity, Lease, Unit, TenantGroup } from "@shared/schema";
import { REMINDER_TYPE_COLORS, STATUS_COLORS, getReminderStatus, getStatusBadgeText, type ReminderType, type ReminderStatus } from "@/lib/colorTokens";

export function HubRemindersView() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [pendingEditReminder, setPendingEditReminder] = useState<Reminder | null>(null);
  const [isEditingSeries, setIsEditingSeries] = useState(false);
  const [editMode, setEditMode] = useState<"future" | "all">("all");
  const [deleteReminderId, setDeleteReminderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "cards" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("due");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    
    if (filter === 'due-soon') {
      setStatusFilter('due');
      params.set('filter', 'due');
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    } else if (filter && ['due', 'all', 'Overdue', 'Completed', 'Cancelled'].includes(filter)) {
      setStatusFilter(filter);
    }
  }, []);

  const { data: reminders, isLoading: remindersLoading, error } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
    retry: false,
  });
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reminderId = params.get('reminderId');
    
    if (reminderId && reminders) {
      const reminder = reminders.find(r => r.id === reminderId);
      if (reminder) {
        setTimeout(() => {
          const element = document.querySelector(`[data-testid="reminder-card-${reminderId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-2', 'ring-blue-500');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-blue-500');
            }, 2000);
          }
        }, 100);
        params.delete('reminderId');
        const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [reminders]);

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

  const { data: tenants = [] } = useQuery<TenantGroup[]>({
    queryKey: ["/api/tenants"],
    retry: false,
  });

  const createReminderMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingReminder) {
        if (isEditingSeries) {
          const response = await apiRequest("PUT", `/api/reminders/${editingReminder.id}/recurring?mode=${editMode}`, data);
          return response.json();
        } else {
          const response = await apiRequest("PATCH", `/api/reminders/${editingReminder.id}`, data);
          return response.json();
        }
      } else {
        const response = await apiRequest("POST", "/api/reminders", data);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setShowReminderForm(false);
      setEditingReminder(null);
      setPendingEditReminder(null);
      setIsEditingSeries(false);
      setEditMode("all");
      toast({
        title: "Success",
        description: editingReminder ? (isEditingSeries ? "Recurring reminder series updated successfully" : "Reminder updated successfully") : "Reminder created successfully",
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
        description: editingReminder ? "Failed to update reminder" : "Failed to create reminder",
        variant: "destructive",
      });
    },
  });

  const completeReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/reminders/${id}`, { 
        status: "Completed",
        completedAt: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({
        title: "Success",
        description: "Reminder marked as completed",
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
        description: "Failed to complete reminder",
        variant: "destructive",
      });
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/reminders/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setEditingReminder(null);
      setShowReminderForm(false);
      toast({
        title: "Success",
        description: "Reminder updated successfully",
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
        description: "Failed to update reminder",
        variant: "destructive",
      });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/reminders/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setDeleteReminderId(null);
      toast({
        title: "Success",
        description: "Reminder deleted successfully",
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
        description: "Failed to delete reminder",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteReminderMutation = useMutation({
    mutationFn: async ({ reminderId, mode }: { reminderId: string; mode: "future" | "all" }) => {
      const response = await apiRequest("DELETE", `/api/reminders/${reminderId}/recurring?mode=${mode}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setDeleteReminderId(null);
      toast({
        title: "Success",
        description: "Recurring reminder series deleted successfully",
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
        description: "Failed to delete recurring reminder series",
        variant: "destructive",
      });
    },
  });

  const bulkEditReminderMutation = useMutation({
    mutationFn: async ({ reminderId, data, mode }: { reminderId: string; data: any; mode: "future" | "all" }) => {
      const response = await apiRequest("PUT", `/api/reminders/${reminderId}/recurring?mode=${mode}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setShowReminderForm(false);
      setEditingReminder(null);
      setPendingEditReminder(null);
      toast({
        title: "Success",
        description: "Recurring reminder series updated successfully",
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
        description: "Failed to update recurring reminder series",
        variant: "destructive",
      });
    },
  });

  if (error && isUnauthorizedError(error as Error)) {
    return null;
  }

  const filteredProperties = properties || [];
  
  const isOverdue = (dueAt: Date | string) => {
    return new Date(dueAt) < new Date();
  };

  const getEffectiveStatus = (reminder: any): string | null => {
    if (reminder.status === "Completed" || reminder.status === "Cancelled") {
      return reminder.status;
    }
    if (isOverdue(reminder.dueAt)) {
      return "Overdue";
    }
    return reminder.status || "Pending";
  };
  
  const isDueWithinDays = (dueAt: Date | string, days: number) => {
    const now = new Date();
    const due = new Date(dueAt);
    const timeDiff = due.getTime() - now.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);
    return daysDiff >= -days && daysDiff <= days;
  };

  const filteredReminders = reminders?.filter(reminder => {
    const typeMatch = typeFilter === "all" || reminder.type === typeFilter;
    
    const effectiveStatus = getEffectiveStatus(reminder);
    
    let statusMatch = false;
    if (statusFilter === "all") {
      statusMatch = true;
    } else if (statusFilter === "due") {
      statusMatch = effectiveStatus === "Pending" || effectiveStatus === "Overdue" || !reminder.status;
    } else if (statusFilter === "Overdue") {
      statusMatch = effectiveStatus === "Overdue";
    } else {
      statusMatch = reminder.status === statusFilter;
    }
    
    let dateMatch = true;
    const reminderDue = new Date(reminder.dueAt);
    const now = new Date();
    
    if (dateFilter === "this-month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateMatch = reminderDue >= startOfMonth && reminderDue <= endOfMonth;
    } else if (dateFilter === "next-month") {
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      dateMatch = reminderDue >= startOfNextMonth && reminderDue <= endOfNextMonth;
    } else if (dateFilter === "next-30-days") {
      const next30Days = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      dateMatch = reminderDue >= now && reminderDue <= next30Days;
    } else if (dateFilter === "year-end") {
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      dateMatch = reminderDue >= now && reminderDue <= endOfYear;
    } else if (dateFilter === "custom" && customDateFrom && customDateTo) {
      dateMatch = reminderDue >= customDateFrom && reminderDue <= customDateTo;
    }
    
    let propertyMatch = false;
    if (propertyFilter === "all") {
      propertyMatch = true;
    } else {
      if (reminder.scope === 'property' && reminder.scopeId === propertyFilter) {
        propertyMatch = true;
      }
      else if (reminder.scope === 'entity' && reminder.scopeId === propertyFilter) {
        propertyMatch = true;
      }
      else if (reminder.scope === 'lease') {
        const lease = leases?.find(l => l.id === reminder.scopeId);
        if (lease) {
          const unit = units?.find(u => u.id === lease.unitId);
          if (unit && unit.propertyId === propertyFilter) {
            propertyMatch = true;
          }
        }
      }
    }
    
    let unitMatch = true;
    if (unitFilter.length > 0) {
      unitMatch = false;
      
      if (reminder.scope === 'lease' && reminder.scopeId) {
        const lease = leases?.find(l => l.id === reminder.scopeId);
        if (lease) {
          const unit = units?.find(u => u.id === lease.unitId);
          if (unit && unitFilter.includes(unit.id)) {
            unitMatch = true;
          } else if (!unit && unitFilter.includes("common")) {
            unitMatch = true;
          }
        }
      }
      else if (reminder.scope === 'property' && unitFilter.includes("common")) {
        unitMatch = true;
      }
    }
    
    return typeMatch && statusMatch && propertyMatch && unitMatch && dateMatch;
  }) || [];

  const reminderTypes = Array.from(new Set(reminders?.map(r => r.type).filter(Boolean))) || [];

  const getTypeIcon = (type: string | null) => {
    switch (type) {
      case "rent": return <DollarSign className="h-4 w-4 text-green-600" />;
      case "lease": return <FileText className="h-4 w-4 text-blue-600" />;
      case "maintenance": return <Wrench className="h-4 w-4 text-yellow-600" />;
      case "regulatory": return <Shield className="h-4 w-4 text-purple-600" />;
      default: return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    switch (status) {
      case "Overdue": return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      case "Completed": return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "Cancelled": return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default: return null;
    }
  };

  const getTypeBadge = (type: string | null) => {
    if (!type) return null;
    
    const typeColors: Record<string, string> = {
      rent: "text-green-700 dark:text-green-400",
      lease: "text-blue-700 dark:text-blue-400",
      maintenance: "text-orange-700 dark:text-orange-400",
      regulatory: "text-purple-700 dark:text-purple-400",
      custom: "text-gray-700 dark:text-gray-400",
      mortgage: "text-red-700 dark:text-red-400",
      insurance: "text-cyan-700 dark:text-cyan-400",
      property_tax: "text-indigo-700 dark:text-indigo-400",
      hoa: "text-pink-700 dark:text-pink-400",
      permit: "text-teal-700 dark:text-teal-400",
    };
    
    const colorClass = typeColors[type] || "text-gray-700 dark:text-gray-400";
    const displayName = type.replace(/_/g, ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    return (
      <Badge variant="secondary" className={`bg-muted/30 border-0 text-xs ${colorClass}`}>
        {displayName}
      </Badge>
    );
  };

  const getScopeLabel = (reminder: Reminder): string => {
    if (reminder.scope === 'property' && reminder.scopeId) {
      const property = properties?.find(p => p.id === reminder.scopeId);
      return property ? (property.name || `${property.street}, ${property.city}`) : '';
    }
    if (reminder.scope === 'entity' && reminder.scopeId) {
      const entity = entities?.find(e => e.id === reminder.scopeId);
      return entity ? entity.name : '';
    }
    if (reminder.scope === 'lease' && reminder.scopeId) {
      const lease = leases?.find(l => l.id === reminder.scopeId);
      if (!lease) return '';
      const unit = units?.find(u => u.id === lease.unitId);
      const property = properties?.find(p => p.id === unit?.propertyId);
      if (unit && property) return `${property.name || property.street} (${unit.label})`;
      if (property) return property.name || property.street;
      return '';
    }
    return '';
  };

  const allReminders = reminders || [];
  const overdueReminders = allReminders.filter(r => 
    getEffectiveStatus(r) === "Overdue"
  ).length;
  const now = new Date();
  const dueSoonReminders = allReminders.filter(r => {
    if (r.status === "Completed" || r.status === "Cancelled") return false;
    const due = new Date(r.dueAt);
    const daysUntil = (due.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return daysUntil >= 0 && daysUntil <= 30;
  }).length;
  const thisMonthReminders = allReminders.filter(r => {
    if (r.status === "Completed" || r.status === "Cancelled") return false;
    const reminderDue = new Date(r.dueAt);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return reminderDue >= startOfMonth && reminderDue <= endOfMonth;
  }).length;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Reminders</h1>
          <p className="text-muted-foreground">Track key tasks and deadlines</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="Due Reminders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due">Due</SelectItem>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-48" data-testid="select-date-filter">
              <SelectValue placeholder="All Dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="next-30-days">Next 30 Days</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="next-month">Next Month</SelectItem>
              <SelectItem value="year-end">Before Year End</SelectItem>
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
              {filteredProperties.map((property) => (
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

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44" data-testid="select-type-filter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {reminderTypes.map((type) => (
                <SelectItem key={type} value={type!}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          <Dialog open={showReminderForm} onOpenChange={setShowReminderForm}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-reminder">
                <Plus className="h-4 w-4 mr-2" />
                Add Reminder
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingReminder ? "Edit Reminder" : "Create New Reminder"}</DialogTitle>
              </DialogHeader>
              <ReminderForm 
                properties={properties || []}
                entities={entities || []}
                units={units || []}
                reminder={editingReminder || undefined}
                userRole={user?.primaryRole}
                onSubmit={(data) => {
                  createReminderMutation.mutate(data);
                }}
                onCancel={() => {
                  setShowReminderForm(false);
                  setEditingReminder(null);
                }}
                isLoading={createReminderMutation.isPending || updateReminderMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={!!pendingEditReminder} onOpenChange={() => setPendingEditReminder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recurring Reminder</DialogTitle>
            <DialogDescription>
              This reminder is part of a recurring series. How would you like to edit it?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              onClick={() => {
                setEditingReminder(pendingEditReminder);
                setIsEditingSeries(false);
                setShowReminderForm(true);
                setPendingEditReminder(null);
              }}
              className="w-full justify-start"
              variant="outline"
              data-testid="button-edit-single-reminder"
            >
              Edit this reminder only
            </Button>
            <Button
              onClick={() => {
                setEditingReminder(pendingEditReminder);
                setIsEditingSeries(true);
                setEditMode("future");
                setShowReminderForm(true);
                setPendingEditReminder(null);
              }}
              className="w-full justify-start"
              variant="outline"
              data-testid="button-edit-future-reminders"
            >
              Edit this and all future reminders
            </Button>
            <Button
              onClick={() => {
                setEditingReminder(pendingEditReminder);
                setIsEditingSeries(true);
                setEditMode("all");
                setShowReminderForm(true);
                setPendingEditReminder(null);
              }}
              className="w-full justify-start"
              variant="outline"
              data-testid="button-edit-series-reminder"
            >
              Edit entire recurring series
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteReminderId} onOpenChange={() => setDeleteReminderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(() => {
                const reminder = reminders?.find(r => r.id === deleteReminderId);
                const isRecurring = reminder?.isRecurring || reminder?.parentRecurringId;
                return isRecurring ? "Delete Recurring Reminder" : "Delete Reminder";
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const reminder = reminders?.find(r => r.id === deleteReminderId);
                const isRecurring = reminder?.isRecurring || reminder?.parentRecurringId;
                if (isRecurring) {
                  return "This reminder is part of a recurring series. How would you like to delete it?";
                } else {
                  return "Are you sure you want to delete this reminder? This action cannot be undone.";
                }
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            {(() => {
              const reminder = reminders?.find(r => r.id === deleteReminderId);
              const isRecurring = reminder?.isRecurring || reminder?.parentRecurringId;
              
              if (isRecurring) {
                return (
                  <div className="flex flex-col space-y-2 w-full">
                    <AlertDialogAction
                      onClick={() => {
                        if (deleteReminderId) {
                          deleteReminderMutation.mutate(deleteReminderId);
                        }
                      }}
                      className="text-red-600 hover:text-red-700 hover:border-red-300 w-full"
                      data-testid="button-delete-single-reminder"
                    >
                      Delete this reminder only
                    </AlertDialogAction>
                    <AlertDialogAction
                      onClick={() => {
                        if (deleteReminderId) {
                          bulkDeleteReminderMutation.mutate({ reminderId: deleteReminderId, mode: "future" });
                        }
                      }}
                      className="text-red-600 hover:text-red-700 hover:border-red-300 w-full"
                      data-testid="button-delete-future-reminders"
                    >
                      Delete this and all future reminders
                    </AlertDialogAction>
                    <AlertDialogAction
                      onClick={() => {
                        if (deleteReminderId) {
                          bulkDeleteReminderMutation.mutate({ reminderId: deleteReminderId, mode: "all" });
                        }
                      }}
                      className="bg-red-600 text-white hover:bg-red-700 w-full"
                      data-testid="button-delete-series-reminder"
                    >
                      Delete entire recurring series
                    </AlertDialogAction>
                  </div>
                );
              } else {
                return (
                  <AlertDialogAction
                    onClick={() => {
                      if (deleteReminderId) {
                        deleteReminderMutation.mutate(deleteReminderId);
                      }
                    }}
                    className="bg-red-600 text-white hover:bg-red-700"
                    data-testid="button-confirm-delete"
                  >
                    Delete
                  </AlertDialogAction>
                );
              }
            })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center gap-1 mb-6 bg-muted/30 rounded-xl p-1 w-fit" data-testid="view-toggle">
        <button
          onClick={() => setViewMode("list")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === "list" ? "bg-white dark:bg-gray-800 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50"}`}
          data-testid="button-list-view"
        >
          <List className="h-4 w-4" />
          List
        </button>
        <button
          onClick={() => setViewMode("cards")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === "cards" ? "bg-white dark:bg-gray-800 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50"}`}
          data-testid="button-cards-view"
        >
          <LayoutGrid className="h-4 w-4" />
          Cards
        </button>
        <button
          onClick={() => setViewMode("calendar")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === "calendar" ? "bg-white dark:bg-gray-800 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50"}`}
          data-testid="button-calendar-view"
        >
          <Calendar className="h-4 w-4" />
          Calendar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          data-testid="card-overdue-reminders"
          className="group relative w-full rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.04] hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(239,68,68,0.15),0_15px_35px_rgba(59,130,246,0.10),0_8px_20px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:ring-offset-2"
          onClick={() => {
            setStatusFilter("Overdue");
            setDateFilter("all");
          }}
          style={{
            background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
            backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
            WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
            border: '2px solid rgba(255, 255, 255, 0.85)',
            boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-orange-500/0 group-hover:from-red-500/8 group-hover:to-orange-500/8 transition-all duration-300 rounded-xl" />
          <div className="running-light-bar h-1 transition-all duration-300" style={{ backdropFilter: 'blur(16px) saturate(200%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)' }} />
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Overdue</span>
              <AlertTriangle className="h-4 w-4 text-red-400 group-hover:text-red-500 transition-colors duration-300" />
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-gray-500 font-medium">Past Due</span>
              <span className={`text-3xl font-bold tabular-nums ${overdueReminders > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`} data-testid="text-overdue-count">
                {overdueReminders}
              </span>
            </div>
            {overdueReminders > 0 && (
              <div className="pt-2 border-t border-gray-100/50">
                <span
                  role="button"
                  tabIndex={0}
                  className="text-[11px] text-green-600 hover:text-green-700 font-semibold flex items-center gap-1 cursor-pointer select-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (completeReminderMutation.isPending) return;
                    const overdueIds = allReminders
                      .filter(r => getEffectiveStatus(r) === "Overdue")
                      .map(r => r.id);
                    Promise.all(overdueIds.map(id => 
                      completeReminderMutation.mutateAsync(id)
                    )).then(() => {
                      toast({
                        title: "Success",
                        description: `Cleared ${overdueIds.length} overdue reminder${overdueIds.length > 1 ? 's' : ''}`,
                      });
                    });
                  }}
                  data-testid="button-clear-all-overdue"
                >
                  <CheckCircle className="h-3 w-3" />
                  Clear All
                </span>
              </div>
            )}
          </div>
        </button>

        <button
          data-testid="card-due-soon-reminders"
          className="group relative w-full rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.04] hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(245,158,11,0.15),0_15px_35px_rgba(59,130,246,0.10),0_8px_20px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2"
          onClick={() => {
            setStatusFilter("due");
            setDateFilter("next-30-days");
          }}
          style={{
            background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
            backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
            WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
            border: '2px solid rgba(255, 255, 255, 0.85)',
            boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 to-yellow-500/0 group-hover:from-amber-500/8 group-hover:to-yellow-500/8 transition-all duration-300 rounded-xl" />
          <div className="running-light-bar h-1 transition-all duration-300" style={{ backdropFilter: 'blur(16px) saturate(200%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)' }} />
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">Due Soon</span>
              <Clock className="h-4 w-4 text-amber-400 group-hover:text-amber-500 transition-colors duration-300" />
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-gray-500 font-medium">Next 30 Days</span>
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {dueSoonReminders}
              </span>
            </div>
          </div>
        </button>

        <button
          data-testid="card-total-reminders"
          className="group relative w-full rounded-2xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.04] hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(139,92,246,0.15),0_15px_35px_rgba(59,130,246,0.10),0_8px_20px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2"
          onClick={() => {
            setStatusFilter("due");
            setDateFilter("this-month");
          }}
          style={{
            background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
            backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
            WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
            border: '2px solid rgba(255, 255, 255, 0.85)',
            boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 to-blue-500/0 group-hover:from-violet-500/8 group-hover:to-blue-500/8 transition-all duration-300 rounded-xl" />
          <div className="running-light-bar h-1 transition-all duration-300" style={{ backdropFilter: 'blur(16px) saturate(200%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)' }} />
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight">This Month</span>
              <Bell className="h-4 w-4 text-blue-400 group-hover:text-blue-500 transition-colors duration-300" />
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-gray-500 font-medium">Due This Month</span>
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums" data-testid="text-total-count">
                {thisMonthReminders}
              </span>
            </div>
          </div>
        </button>
      </div>

      {viewMode === "calendar" ? (
        (() => {
          const year = calendarMonth.getFullYear();
          const month = calendarMonth.getMonth();
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const today = new Date();
          const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

          const remindersByDay: Record<number, typeof allReminders> = {};
          allReminders.forEach(r => {
            const due = new Date(r.dueAt);
            if (due.getFullYear() === year && due.getMonth() === month) {
              const day = due.getDate();
              if (!remindersByDay[day]) remindersByDay[day] = [];
              remindersByDay[day].push(r);
            }
          });

          const cells = [];
          for (let i = 0; i < firstDay; i++) {
            cells.push(<div key={`empty-${i}`} className="min-h-[90px]" />);
          }
          for (let day = 1; day <= daysInMonth; day++) {
            const dayReminders = remindersByDay[day] || [];
            const isToday = isCurrentMonth && today.getDate() === day;
            cells.push(
              <div
                key={day}
                className={`min-h-[90px] p-1.5 rounded-xl border transition-all duration-200 ${
                  isToday
                    ? "border-violet-300 bg-violet-50/50 dark:bg-violet-900/20"
                    : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                }`}
              >
                <div className={`text-xs font-semibold mb-1 ${isToday ? "text-violet-600 dark:text-violet-400" : "text-gray-500"}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayReminders.slice(0, 3).map((r, i) => {
                    const eff = getEffectiveStatus(r);
                    const dotColor = eff === "Overdue" ? "bg-red-500" : eff === "Completed" ? "bg-green-500" : "bg-blue-500";
                    return (
                      <div key={i} className="flex items-center gap-1 group/item cursor-default">
                        <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        <span className="text-[10px] text-gray-700 dark:text-gray-300 truncate leading-tight">
                          {r.title}
                        </span>
                      </div>
                    );
                  })}
                  {dayReminders.length > 3 && (
                    <span className="text-[9px] text-muted-foreground font-medium">+{dayReminders.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div className="group relative rounded-2xl overflow-hidden" style={{
              background: 'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)',
              backdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
              WebkitBackdropFilter: 'blur(60px) saturate(220%) brightness(1.04)',
              border: '2px solid rgba(255, 255, 255, 0.85)',
              boxShadow: 'inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), 0 10px 40px rgba(0, 0, 0, 0.06)',
            }}>
              <div className="running-light-bar h-1" style={{ backdropFilter: 'blur(16px) saturate(200%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08)' }} />
              <div className="relative p-5">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                    {monthNames[month]} {year}
                  </h3>
                  <button
                    onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells}
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100/50">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Overdue
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Due
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-green-500" /> Completed
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : remindersLoading ? (
        <div className={viewMode === "cards" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="group relative rounded-2xl overflow-hidden" data-testid={`skeleton-reminder-${i}`} style={{
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
                  <div className="space-y-3">
                    <div className="h-5 bg-muted animate-pulse rounded" />
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </CardContent>
              </div>
            </div>
          ))}
        </div>
      ) : filteredReminders.length > 0 ? (
        viewMode === "cards" ? 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReminders.map((reminder, index) => {
            const effectiveStatus = getEffectiveStatus(reminder);
            return (
              <div key={reminder.id} className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(139,92,246,0.12),0_10px_25px_rgba(59,130,246,0.08),0_4px_12px_rgba(0,0,0,0.06)]" data-testid={`card-reminder-grid-${index}`} style={{
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
                <div className="relative p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-violet-100/60 rounded-lg flex items-center justify-center shrink-0">
                      {getTypeIcon(reminder.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">
                        {reminder.title}
                      </h4>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                    {getScopeLabel(reminder) && (
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{getScopeLabel(reminder)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      <span>Due {new Date(reminder.dueAt).toLocaleDateString()}</span>
                    </div>
                    {(reminder.leadDays || 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{reminder.leadDays} day(s) notice</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {getStatusBadge(effectiveStatus)}
                    {reminder.isRecurring && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-blue-600 border-blue-300">
                        <Repeat className="h-2.5 w-2.5 mr-0.5" />
                        {reminder.recurringFrequency}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 pt-2 border-t border-gray-100/60">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (reminder.isRecurring || reminder.parentRecurringId) {
                          setPendingEditReminder(reminder);
                        } else {
                          setEditingReminder(reminder);
                          setShowReminderForm(true);
                        }
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    {(effectiveStatus === "Pending" || effectiveStatus === "Overdue") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-green-600"
                        onClick={() => completeReminderMutation.mutate(reminder.id)}
                        disabled={completeReminderMutation.isPending}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteReminderId(reminder.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        : 
        <div className="space-y-2">
          {filteredReminders.map((reminder, index) => {
            const effectiveStatus = getEffectiveStatus(reminder);
            return (
            <div key={reminder.id} className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(139,92,246,0.10),0_8px_20px_rgba(59,130,246,0.06),0_4px_12px_rgba(0,0,0,0.05)]" data-testid={`card-reminder-${index}`} style={{
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
                  <div className="w-10 h-10 bg-violet-100/60 rounded-lg flex items-center justify-center shrink-0">
                    {getTypeIcon(reminder.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate" data-testid={`text-reminder-title-${index}`}>
                        {reminder.title}
                      </h3>
                      {reminder.isRecurring && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-blue-600 border-blue-300 shrink-0">
                          <Repeat className="h-2.5 w-2.5 mr-0.5" />
                          {reminder.recurringFrequency}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
                      {getScopeLabel(reminder) && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {getScopeLabel(reminder)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 shrink-0" data-testid={`text-reminder-due-${index}`}>
                        <CalendarDays className="h-3 w-3" />
                        {new Date(reminder.dueAt).toLocaleDateString()}
                      </span>
                      {(reminder.leadDays || 0) > 0 && (
                        <span className="shrink-0 text-xs">{reminder.leadDays}d notice</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(effectiveStatus)}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs h-8 w-8 p-0"
                      onClick={() => {
                        const isRecurring = reminder.isRecurring || reminder.parentRecurringId;
                        if (isRecurring) {
                          setPendingEditReminder(reminder);
                        } else {
                          setEditingReminder(reminder);
                          setShowReminderForm(true);
                        }
                      }}
                      data-testid={`button-edit-reminder-${index}`}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    {(effectiveStatus === "Pending" || effectiveStatus === "Overdue") && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => completeReminderMutation.mutate(reminder.id)}
                        disabled={completeReminderMutation.isPending}
                        data-testid={`button-complete-reminder-${index}`}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteReminderId(reminder.id)}
                      data-testid={`button-delete-reminder-${index}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2" data-testid="text-no-reminders">No Reminders Set</h3>
              <p className="text-muted-foreground mb-4">Create reminders to stay on top of important tasks and deadlines.</p>
              <Button onClick={() => setShowReminderForm(true)} data-testid="button-add-first-reminder">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Reminder
              </Button>
            </CardContent>
          </div>
        </div>
      )}
    </>
  );
}