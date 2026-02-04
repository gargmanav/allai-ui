import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, Briefcase, Plus, Mail, Phone, Building2, Trash2, Edit, ArrowUpDown, Filter, LayoutGrid, List, MapPin, Navigation } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Customer = {
  id: string;
  contractorId: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  notes: string | null;
  latitude?: string | null;
  longitude?: string | null;
  geocodedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  activeJobCount: number;
  totalJobCount: number;
};

type CustomerStatus = 'all' | 'current' | 'leads' | 'prior';

const getCustomerStatus = (customer: Customer): 'current' | 'leads' | 'prior' => {
  if (customer.activeJobCount > 0) return 'current';
  if (customer.totalJobCount === 0) return 'leads';
  return 'prior';
};

const customerFormSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.firstName || data.lastName || data.companyName,
  {
    message: "At least one of First Name, Last Name, or Company Name is required",
    path: ["firstName"],
  }
);

type CustomerFormData = z.infer<typeof customerFormSchema>;

// Custom marker icons
const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const selectedIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#8b5cf6"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white"/>
    </svg>
  `),
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -48],
});

// Helper function to extract error message from API error
function extractErrorMessage(error: any): string {
  if (!error?.message) return "";
  
  const match = error.message.match(/\d+:\s*(\{.*\})/);
  if (match) {
    try {
      const errorObj = JSON.parse(match[1]);
      
      if (errorObj.details && Array.isArray(errorObj.details)) {
        const detailMessages = errorObj.details.map((d: any) => {
          if (d.path && d.message) {
            return `${d.path.join('.')}: ${d.message}`;
          }
          return d.message || JSON.stringify(d);
        }).join(', ');
        
        return errorObj.error ? `${errorObj.error}. ${detailMessages}` : detailMessages;
      }
      
      return errorObj.error || "";
    } catch {
      return "";
    }
  }
  
  return error.message || "";
}

// Helper to parse coordinates safely
function parseCoord(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? null : num;
}

// Component to fly to selected customer - only triggers on customer change
function FlyToCustomer({ customerId, customers }: { customerId: string | null; customers: Customer[] }) {
  const map = useMap();
  const prevCustomerId = useRef<string | null>(null);
  
  useEffect(() => {
    if (customerId && customerId !== prevCustomerId.current) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        const lat = parseCoord(customer.latitude);
        const lng = parseCoord(customer.longitude);
        if (lat !== null && lng !== null) {
          map.flyTo([lat, lng], 15, { duration: 0.8 });
        }
      }
    }
    prevCustomerId.current = customerId;
  }, [customerId, customers, map]);
  
  return null;
}

export default function CustomersPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'company' | 'city'>('name');
  const [filterCity, setFilterCity] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus>('current');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/contractor/customers'],
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      phone: "",
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      return await apiRequest('POST', '/api/contractor/customers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Customer added",
        description: "The customer has been added successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error",
        description: errorMessage || "Failed to add customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
      return await apiRequest('PATCH', `/api/contractor/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      setEditingCustomer(null);
      form.reset();
      toast({
        title: "Customer updated",
        description: "The customer has been updated successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error",
        description: errorMessage || "Failed to update customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/contractor/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      setSelectedCustomerId(null);
      toast({
        title: "Customer deleted",
        description: "The customer has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error",
        description: errorMessage || "Failed to delete customer. They may have existing work orders.",
        variant: "destructive",
      });
    },
  });

  const geocodeMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return await apiRequest('POST', `/api/contractor/customers/${customerId}/geocode`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      toast({ title: 'Address geocoded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to geocode address', variant: 'destructive' });
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      companyName: customer.companyName || "",
      email: customer.email || "",
      phone: customer.phone || "",
      streetAddress: customer.streetAddress || "",
      city: customer.city || "",
      state: customer.state || "",
      zipCode: customer.zipCode || "",
      notes: customer.notes || "",
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCardClick = (customer: Customer) => {
    setSelectedCustomerId(selectedCustomerId === customer.id ? null : customer.id);
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
    return "Unnamed Customer";
  };

  // Get unique cities for filter dropdown
  const uniqueCities = Array.from(
    new Set(
      customers
        .map(c => c.city)
        .filter(Boolean)
    )
  ).sort();

  // Apply filters and sorting
  const filteredAndSortedCustomers = customers
    .filter(customer => {
      if (filterCity && customer.city !== filterCity) {
        return false;
      }
      if (statusFilter !== 'all') {
        const customerStatus = getCustomerStatus(customer);
        if (statusFilter === 'current' && customerStatus !== 'current') return false;
        if (statusFilter === 'leads' && customerStatus !== 'leads') return false;
        if (statusFilter === 'prior' && customerStatus !== 'prior') return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = getCustomerDisplayName(a).toLowerCase();
        const nameB = getCustomerDisplayName(b).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'company') {
        const companyA = (a.companyName || '').toLowerCase();
        const companyB = (b.companyName || '').toLowerCase();
        return companyA.localeCompare(companyB);
      }
      if (sortBy === 'city') {
        const cityA = (a.city || '').toLowerCase();
        const cityB = (b.city || '').toLowerCase();
        return cityA.localeCompare(cityB);
      }
      return 0;
    });

  // Customers with valid coordinates for map
  const customersWithCoords = useMemo(() => 
    filteredAndSortedCustomers.filter(c => {
      const lat = parseCoord(c.latitude);
      const lng = parseCoord(c.longitude);
      return lat !== null && lng !== null;
    }), [filteredAndSortedCustomers]
  );

  // Calculate map center using parsed coordinates
  const mapCenter = useMemo(() => {
    if (customersWithCoords.length === 0) return [40.7128, -74.006] as [number, number];
    const coords = customersWithCoords.map(c => ({
      lat: parseCoord(c.latitude)!,
      lng: parseCoord(c.longitude)!
    }));
    return [
      coords.reduce((a, c) => a + c.lat, 0) / coords.length,
      coords.reduce((a, c) => a + c.lng, 0) / coords.length
    ] as [number, number];
  }, [customersWithCoords]);

  // Group customers alphabetically by first letter (for list view)
  const groupedCustomers = filteredAndSortedCustomers.reduce((groups, customer) => {
    const displayName = getCustomerDisplayName(customer);
    const firstLetter = displayName.charAt(0).toUpperCase();
    if (!groups[firstLetter]) {
      groups[firstLetter] = [];
    }
    groups[firstLetter].push(customer);
    return groups;
  }, {} as Record<string, Customer[]>);

  // Customer card component with frosted glass styling
  const CustomerCard = ({ customer, isSelected }: { customer: Customer; isSelected: boolean }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handleCardClick(customer)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(customer); }}
      className={`
        w-full text-left rounded-xl p-4 transition-all duration-500 ease-out cursor-pointer
        backdrop-blur-xl backdrop-saturate-[180%]
        border border-white/20 dark:border-white/10
        focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2 focus:ring-offset-transparent
        ${isSelected 
          ? 'bg-gradient-to-br from-violet-500/30 via-purple-500/25 to-blue-500/30 shadow-xl shadow-violet-500/20 scale-[1.02] border-violet-400/40' 
          : 'bg-white/60 dark:bg-slate-900/60 hover:bg-gradient-to-br hover:from-violet-500/20 hover:via-purple-500/15 hover:to-blue-500/20 hover:shadow-lg hover:shadow-violet-500/10 hover:scale-[1.01]'
        }
      `}
      data-testid={`card-customer-${customer.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`
              p-1.5 rounded-lg transition-colors duration-300
              ${isSelected ? 'bg-violet-500/30' : 'bg-primary/10'}
            `}>
              <User className={`h-4 w-4 ${isSelected ? 'text-violet-300' : 'text-primary'}`} />
            </div>
            <h3 className="font-semibold truncate" data-testid={`text-customer-name-${customer.id}`}>
              {getCustomerDisplayName(customer)}
            </h3>
            {(() => {
              const status = getCustomerStatus(customer);
              const statusConfig = {
                current: { label: 'Current', className: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
                leads: { label: 'Lead', className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30' },
                prior: { label: 'Prior', className: 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30' },
              };
              const config = statusConfig[status];
              return (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${config.className}`}>
                  {config.label}
                </Badge>
              );
            })()}
          </div>
          {customer.companyName && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1 ml-8 truncate">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              {customer.companyName}
            </p>
          )}
        </div>
        <div className="flex gap-1 ml-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-white/30 dark:hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}
            data-testid={`button-edit-${customer.id}`}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-red-500/20"
            onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }}
            data-testid={`button-delete-${customer.id}`}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5" />
          <span>{customer.activeJobCount} active {customer.activeJobCount === 1 ? 'job' : 'jobs'}</span>
        </div>
        {customer.email && (
          <div className="flex items-center gap-2 text-muted-foreground truncate">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {customer.phone}
          </div>
        )}
        {customer.streetAddress && (
          <div className="flex items-center gap-2 text-muted-foreground truncate">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">
              {customer.streetAddress}{customer.city ? `, ${customer.city}` : ''}
            </span>
            {!customer.latitude && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-xs ml-auto"
                onClick={(e) => { e.stopPropagation(); geocodeMutation.mutate(customer.id); }}
                disabled={geocodeMutation.isPending}
              >
                <Navigation className="h-3 w-3 mr-1" />
                Locate
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Customers" />
        <main className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="mb-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
                Customers
              </h1>
              <p className="text-muted-foreground">
                Manage your clients and view their locations
              </p>
            </div>
            <Dialog open={isAddDialogOpen || !!editingCustomer} onOpenChange={(open) => {
              if (!open) {
                setIsAddDialogOpen(false);
                setEditingCustomer(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-customer">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                  <DialogDescription>
                    {editingCustomer ? 'Update customer information' : 'Enter the details for your new customer'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} data-testid="input-first-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Smith" {...field} data-testid="input-last-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC Properties LLC" {...field} data-testid="input-company-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="streetAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} data-testid="input-street-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="Boston" {...field} data-testid="input-city" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="MA" {...field} data-testid="input-state" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Zip Code</FormLabel>
                            <FormControl>
                              <Input placeholder="02108" {...field} data-testid="input-zip-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Additional notes..." {...field} data-testid="input-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddDialogOpen(false);
                          setEditingCustomer(null);
                          form.reset();
                        }}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createMutation.isPending || updateMutation.isPending}
                        data-testid="button-submit"
                      >
                        {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingCustomer ? 'Update' : 'Add Customer'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filter and Sort Controls */}
          {customers.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-4 items-center flex-shrink-0" data-testid="filter-sort-controls">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(value: 'name' | 'company' | 'city') => setSortBy(value)}>
                  <SelectTrigger className="w-32" data-testid="select-sort">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="city">City</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={(value: CustomerStatus) => setStatusFilter(value)}>
                  <SelectTrigger className="w-32" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="prior">Prior</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {uniqueCities.length > 0 && (
                <Select value={filterCity || "all-cities"} onValueChange={(value) => setFilterCity(value === "all-cities" ? "" : value)}>
                  <SelectTrigger className="w-32" data-testid="select-city">
                    <SelectValue placeholder="All Cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-cities">All Cities</SelectItem>
                    {uniqueCities.map((city) => (
                      <SelectItem key={city} value={city!}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(filterCity || statusFilter !== 'current') && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setFilterCity('');
                    setStatusFilter('current');
                  }}
                  data-testid="button-clear-filters"
                >
                  Reset Filters
                </Button>
              )}

              <div className="ml-auto flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {filteredAndSortedCustomers.length} of {customers.length} customers
                  {customersWithCoords.length > 0 && (
                    <span className="ml-2 text-violet-500">
                      ({customersWithCoords.length} on map)
                    </span>
                  )}
                </div>
                <div className="flex gap-1 border rounded-md p-1">
                  <Button
                    variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                    data-testid="button-view-cards"
                    className="h-8 w-8 p-0"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    data-testid="button-view-list"
                    className="h-8 w-8 p-0"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Main Content - Split Layout */}
          <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
            {/* Customer List Panel */}
            <div className="w-1/2 overflow-auto pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading customers...</p>
                  </div>
                </div>
              ) : customers.length === 0 ? (
                <Card className="backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border-white/20">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <User className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-4">
                      Add your first customer to start tracking work orders and viewing them on the map.
                    </p>
                    <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-customer">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Customer
                    </Button>
                  </CardContent>
                </Card>
              ) : filteredAndSortedCustomers.length === 0 ? (
                <Card className="backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border-white/20">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No customers match your filters</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-4">
                      Try adjusting your filters to see more results.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setFilterCity('');
                        setFilterActiveJobs('all');
                      }}
                      data-testid="button-clear-all-filters"
                    >
                      Clear All Filters
                    </Button>
                  </CardContent>
                </Card>
              ) : viewMode === 'cards' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredAndSortedCustomers.map((customer) => (
                    <CustomerCard 
                      key={customer.id} 
                      customer={customer} 
                      isSelected={selectedCustomerId === customer.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(groupedCustomers).sort().map((letter) => (
                    <div key={letter} data-testid={`group-letter-${letter}`}>
                      <h2 className="text-lg font-bold mb-2 text-primary sticky top-0 bg-background/80 backdrop-blur-sm py-1 border-b">
                        {letter}
                      </h2>
                      <div className="space-y-2">
                        {groupedCustomers[letter].map((customer) => (
                          <CustomerCard 
                            key={customer.id} 
                            customer={customer} 
                            isSelected={selectedCustomerId === customer.id}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Map Panel */}
            <div className="w-1/2 rounded-xl overflow-hidden border border-white/20 shadow-lg">
              <MapContainer
                center={mapCenter}
                zoom={customersWithCoords.length > 0 ? 10 : 4}
                className="h-full w-full"
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FlyToCustomer customerId={selectedCustomerId} customers={filteredAndSortedCustomers} />
                {customersWithCoords.map((customer) => {
                  const lat = parseCoord(customer.latitude)!;
                  const lng = parseCoord(customer.longitude)!;
                  const isSelected = selectedCustomerId === customer.id;
                  
                  return (
                    <Marker
                      key={customer.id}
                      position={[lat, lng]}
                      icon={isSelected ? selectedIcon : defaultIcon}
                      eventHandlers={{
                        click: () => setSelectedCustomerId(customer.id),
                      }}
                    >
                      <Popup>
                        <div className="min-w-[200px]">
                          <h3 className="font-semibold text-base">{getCustomerDisplayName(customer)}</h3>
                          {customer.companyName && (
                            <p className="text-sm text-gray-600">{customer.companyName}</p>
                          )}
                          <p className="text-sm mt-1">
                            {customer.streetAddress}
                            {customer.city && `, ${customer.city}`}
                            {customer.state && ` ${customer.state}`}
                          </p>
                          {customer.phone && (
                            <p className="text-sm mt-1">{customer.phone}</p>
                          )}
                          <div className="mt-2 pt-2 border-t flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                              {customer.activeJobCount} active job{customer.activeJobCount !== 1 ? 's' : ''}
                            </span>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Navigation className="h-3 w-3" />
                              Directions
                            </a>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
              
              {/* Map overlay for no coordinates */}
              {customers.length > 0 && customersWithCoords.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-6 text-center max-w-sm mx-4 shadow-xl">
                    <MapPin className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">No Locations Available</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add addresses to your customers and click "Locate" to see them on the map.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
