import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { User, Briefcase, Plus, Mail, Phone, Building2, Trash2, Edit, LayoutGrid, List, MapPin, Navigation, Search, X, Sparkles, DollarSign, AlertTriangle, Calendar, Bot, Loader2, Send, ChevronRight, TrendingUp, UserCheck, Map } from "lucide-react";
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

const defaultPinGradId = `pinGrad_default_${Math.random().toString(36).slice(2)}`;
const selectedPinGradId = `pinGrad_selected_${Math.random().toString(36).slice(2)}`;

const defaultIcon = new L.DivIcon({
  className: 'custom-pin-marker',
  html: `
    <div style="position: relative; width: 32px; height: 44px;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44" style="filter: drop-shadow(0 3px 6px rgba(100, 116, 139, 0.4));">
        <defs>
          <linearGradient id="${defaultPinGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#64748B"/>
            <stop offset="50%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#6366f1"/>
          </linearGradient>
        </defs>
        <path d="M16 1C8 1 2 7 2 15C2 26 16 43 16 43S30 26 30 15C30 7 24 1 16 1Z" fill="url(#${defaultPinGradId})"/>
        <circle cx="16" cy="15" r="6" fill="white"/>
        <circle cx="16" cy="15" r="3" fill="#64748B"/>
      </svg>
    </div>
  `,
  iconSize: [32, 44],
  iconAnchor: [16, 44],
  popupAnchor: [0, -40],
});

const selectedIcon = new L.DivIcon({
  className: 'custom-pin-marker selected-pin',
  html: `
    <div style="position: relative; width: 44px; height: 56px;">
      <div style="position: absolute; top: 6px; left: 6px; width: 32px; height: 32px; background: linear-gradient(135deg, rgba(100, 116, 139, 0.4), rgba(139, 92, 246, 0.4)); border-radius: 50%; animation: pulse 1.5s ease-in-out infinite;"></div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 56" width="44" height="56" style="position: relative; z-index: 2; filter: drop-shadow(0 4px 8px rgba(100, 116, 139, 0.5));">
        <defs>
          <linearGradient id="${selectedPinGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#94a3b8"/>
            <stop offset="40%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#6366f1"/>
          </linearGradient>
        </defs>
        <path d="M22 2C12 2 4 10 4 20C4 34 22 54 22 54S40 34 40 20C40 10 32 2 22 2Z" fill="url(#${selectedPinGradId})"/>
        <circle cx="22" cy="20" r="8" fill="white"/>
        <circle cx="22" cy="20" r="4" fill="#64748B"/>
        <circle cx="20" cy="18" r="1.5" fill="white" opacity="0.7"/>
      </svg>
    </div>
  `,
  iconSize: [44, 56],
  iconAnchor: [22, 56],
  popupAnchor: [0, -52],
});

function extractErrorMessage(error: any): string {
  if (!error?.message) return "";
  const match = error.message.match(/\d+:\s*(\{.*\})/);
  if (match) {
    try {
      const errorObj = JSON.parse(match[1]);
      if (errorObj.details && Array.isArray(errorObj.details)) {
        const detailMessages = errorObj.details.map((d: any) => {
          if (d.path && d.message) return `${d.path.join('.')}: ${d.message}`;
          return d.message || JSON.stringify(d);
        }).join(', ');
        return errorObj.error ? `${errorObj.error}. ${detailMessages}` : detailMessages;
      }
      return errorObj.error || "";
    } catch { return ""; }
  }
  return error.message || "";
}

function parseCoord(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? null : num;
}

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

interface MayaChatMessage {
  role: "user" | "maya";
  content: string;
  timestamp: Date;
}

interface MayaRecommendation {
  type: "prioritize" | "followup" | "schedule" | "price";
  title: string;
  message: string;
  customerId?: string;
}

export function CustomersContent({ embedded = false }: { embedded?: boolean }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'company' | 'city' | 'jobs'>('name');
  const [filterCity, setFilterCity] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [mayaChatOpen, setMayaChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<MayaChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isMayaTyping, setIsMayaTyping] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/contractor/customers'],
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      firstName: "", lastName: "", companyName: "", email: "", phone: "",
      streetAddress: "", city: "", state: "", zipCode: "", notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => await apiRequest('POST', '/api/contractor/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: "Customer added", description: "The customer has been added successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: extractErrorMessage(error) || "Failed to add customer.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => await apiRequest('PATCH', `/api/contractor/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      setEditingCustomer(null);
      form.reset();
      toast({ title: "Customer updated", description: "The customer has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: extractErrorMessage(error) || "Failed to update customer.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest('DELETE', `/api/contractor/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/customers'] });
      setSelectedCustomerId(null);
      toast({ title: "Customer deleted", description: "The customer has been deleted successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: extractErrorMessage(error) || "Failed to delete customer.", variant: "destructive" });
    },
  });

  const geocodeMutation = useMutation({
    mutationFn: async (customerId: string) => await apiRequest('POST', `/api/contractor/customers/${customerId}/geocode`),
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
      firstName: customer.firstName || "", lastName: customer.lastName || "",
      companyName: customer.companyName || "", email: customer.email || "",
      phone: customer.phone || "", streetAddress: customer.streetAddress || "",
      city: customer.city || "", state: customer.state || "",
      zipCode: customer.zipCode || "", notes: customer.notes || "",
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCardClick = (customer: Customer) => {
    setSelectedCustomerId(selectedCustomerId === customer.id ? null : customer.id);
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.companyName && !customer.firstName && !customer.lastName) return customer.companyName;
    if (customer.firstName && customer.lastName) return `${customer.lastName}, ${customer.firstName}`;
    if (customer.lastName) return customer.lastName;
    if (customer.firstName) return customer.firstName;
    if (customer.companyName) return customer.companyName;
    return "Unnamed Customer";
  };

  const getInitials = (customer: Customer) => {
    const name = getCustomerDisplayName(customer);
    const parts = name.replace(',', '').split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.[0] || '?').toUpperCase();
  };

  const uniqueCities = Array.from(new Set(customers.map(c => c.city).filter(Boolean))).sort();

  const filteredAndSortedCustomers = useMemo(() => {
    let result = customers.filter(customer => {
      if (filterCity && customer.city !== filterCity) return false;
      if (statusFilter !== 'all') {
        const cs = getCustomerStatus(customer);
        if (cs !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = getCustomerDisplayName(customer).toLowerCase();
        const company = (customer.companyName || '').toLowerCase();
        const email = (customer.email || '').toLowerCase();
        const city = (customer.city || '').toLowerCase();
        if (!name.includes(q) && !company.includes(q) && !email.includes(q) && !city.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name': return getCustomerDisplayName(a).localeCompare(getCustomerDisplayName(b));
        case 'company': return (a.companyName || '').localeCompare(b.companyName || '');
        case 'city': return (a.city || '').localeCompare(b.city || '');
        case 'jobs': return b.totalJobCount - a.totalJobCount;
        default: return 0;
      }
    });
    return result;
  }, [customers, filterCity, statusFilter, searchQuery, sortBy]);

  const customersWithCoords = useMemo(() =>
    filteredAndSortedCustomers.filter(c => parseCoord(c.latitude) !== null && parseCoord(c.longitude) !== null),
    [filteredAndSortedCustomers]
  );

  const mapCenter = useMemo(() => {
    if (customersWithCoords.length === 0) return [40.7128, -74.006] as [number, number];
    const coords = customersWithCoords.map(c => ({ lat: parseCoord(c.latitude)!, lng: parseCoord(c.longitude)! }));
    return [
      coords.reduce((a, c) => a + c.lat, 0) / coords.length,
      coords.reduce((a, c) => a + c.lng, 0) / coords.length,
    ] as [number, number];
  }, [customersWithCoords]);

  const groupedCustomers = filteredAndSortedCustomers.reduce((groups, customer) => {
    const firstLetter = getCustomerDisplayName(customer).charAt(0).toUpperCase();
    if (!groups[firstLetter]) groups[firstLetter] = [];
    groups[firstLetter].push(customer);
    return groups;
  }, {} as Record<string, Customer[]>);

  const mayaRecommendations = useMemo<MayaRecommendation[]>(() => {
    if (customers.length === 0) return [];
    const recommendations: MayaRecommendation[] = [];

    const mostActive = customers.reduce((max, c) => c.totalJobCount > max.totalJobCount ? c : max, customers[0]);
    if (mostActive && mostActive.totalJobCount > 0) {
      recommendations.push({
        type: "prioritize",
        title: "Top Customer",
        message: `${getCustomerDisplayName(mostActive)} has ${mostActive.totalJobCount} total jobs (${mostActive.activeJobCount} active). Your most valuable relationship.`,
        customerId: mostActive.id,
      });
    }

    const leads = customers.filter(c => getCustomerStatus(c) === 'leads');
    if (leads.length > 0) {
      recommendations.push({
        type: "followup",
        title: "Potential Customers",
        message: `${leads.length} lead${leads.length > 1 ? 's' : ''} with no jobs yet. Reach out to convert them into active customers.`,
        customerId: leads[0]?.id,
      });
    }

    const noAddress = customers.filter(c => !c.streetAddress);
    if (noAddress.length > 0) {
      recommendations.push({
        type: "schedule",
        title: "Missing Addresses",
        message: `${noAddress.length} customer${noAddress.length > 1 ? 's' : ''} without addresses. Add them to see locations on the map and plan routes.`,
        customerId: noAddress[0]?.id,
      });
    }

    const multipleActive = customers.filter(c => c.activeJobCount > 1).sort((a, b) => b.activeJobCount - a.activeJobCount);
    if (multipleActive.length > 0) {
      recommendations.push({
        type: "price",
        title: "High Activity",
        message: `${getCustomerDisplayName(multipleActive[0])} has ${multipleActive[0].activeJobCount} active jobs right now. Make sure workload is manageable.`,
        customerId: multipleActive[0].id,
      });
    }

    return recommendations.slice(0, 3);
  }, [customers]);

  const generateMayaResponse = (question: string): string => {
    const q = question.toLowerCase();
    const current = customers.filter(c => getCustomerStatus(c) === 'current');
    const leads = customers.filter(c => getCustomerStatus(c) === 'leads');
    const prior = customers.filter(c => getCustomerStatus(c) === 'prior');

    if (q.includes("best") || q.includes("top") || q.includes("valuable") || q.includes("most")) {
      const sorted = [...customers].sort((a, b) => b.totalJobCount - a.totalJobCount);
      if (sorted.length > 0 && sorted[0].totalJobCount > 0) {
        return `Your top customer is ${getCustomerDisplayName(sorted[0])} with ${sorted[0].totalJobCount} total jobs. Consider offering them a loyalty discount or priority scheduling to maintain this relationship.`;
      }
      return `You don't have enough job history yet to identify a top customer. Keep building those relationships!`;
    }

    if (q.includes("owe") || q.includes("money") || q.includes("outstanding") || q.includes("payment") || q.includes("invoice")) {
      const withActive = customers.filter(c => c.activeJobCount > 0).sort((a, b) => b.activeJobCount - a.activeJobCount);
      if (withActive.length > 0) {
        return `${withActive.length} customer${withActive.length > 1 ? 's have' : ' has'} active jobs. ${getCustomerDisplayName(withActive[0])} has the most active work (${withActive[0].activeJobCount} jobs). Check your invoices to make sure payments are up to date for completed work.`;
      }
      return `No customers currently have active jobs. Check your completed jobs for any outstanding invoices.`;
    }

    if (q.includes("lead") || q.includes("potential") || q.includes("new") || q.includes("prospect")) {
      if (leads.length > 0) {
        return `You have ${leads.length} lead${leads.length > 1 ? 's' : ''} — customers added but with no jobs yet. Following up within 48 hours of adding them increases conversion rates significantly. Consider reaching out with a personalized quote.`;
      }
      return `No leads right now. All your customers have job history. Consider adding new prospects to keep your pipeline growing.`;
    }

    if (q.includes("inactive") || q.includes("prior") || q.includes("old") || q.includes("past")) {
      if (prior.length > 0) {
        return `${prior.length} prior customer${prior.length > 1 ? 's have' : ' has'} completed all their jobs. A quick check-in or seasonal maintenance reminder could bring them back.`;
      }
      return `All your customers are either active or leads — great job maintaining relationships!`;
    }

    if (q.includes("city") || q.includes("location") || q.includes("area") || q.includes("where")) {
      const cityCount: Record<string, number> = {};
      customers.forEach(c => { if (c.city) cityCount[c.city] = (cityCount[c.city] || 0) + 1; });
      const topCity = Object.entries(cityCount).sort((a, b) => b[1] - a[1])[0];
      if (topCity) {
        return `Your customers are spread across ${Object.keys(cityCount).length} cities. ${topCity[0]} is your busiest area with ${topCity[1]} customer${topCity[1] > 1 ? 's' : ''}. Consider focusing marketing in that area.`;
      }
      return `Not enough address data to analyze your service area. Add addresses to customers to see location insights.`;
    }

    if (q.includes("map") || q.includes("address")) {
      const withAddr = customers.filter(c => c.streetAddress);
      const withCoords = customers.filter(c => c.latitude);
      return `${withAddr.length} of ${customers.length} customers have addresses. ${withCoords.length} are mapped. ${withAddr.length - withCoords.length > 0 ? `Click "Add to Map" on customer cards to geocode the remaining ${withAddr.length - withCoords.length}.` : 'All addressed customers are on the map!'}`;
    }

    return `You have ${customers.length} customers: ${current.length} active, ${leads.length} leads, and ${prior.length} prior. Ask me about your top customers, leads, payments, or service areas!`;
  };

  const handleMayaChat = async () => {
    if (!chatInput.trim()) return;
    const question = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", content: question, timestamp: new Date() }]);
    setChatInput("");
    setIsMayaTyping(true);
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: "maya", content: generateMayaResponse(question), timestamp: new Date() }]);
      setIsMayaTyping(false);
    }, 1200);
  };

  const statusCounts = useMemo(() => ({
    all: customers.length,
    current: customers.filter(c => getCustomerStatus(c) === 'current').length,
    leads: customers.filter(c => getCustomerStatus(c) === 'leads').length,
    prior: customers.filter(c => getCustomerStatus(c) === 'prior').length,
  }), [customers]);

  const CustomerCard = ({ customer, isSelected }: { customer: Customer; isSelected: boolean }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handleCardClick(customer)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(customer); }}
      className={`
        w-full text-left rounded-xl p-4 transition-all duration-300 cursor-pointer
        backdrop-blur-xl backdrop-saturate-[180%]
        border border-white/20 dark:border-white/10
        focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2 focus:ring-offset-transparent
        ${isSelected
          ? 'bg-gradient-to-br from-violet-500/20 via-purple-500/15 to-slate-500/20 shadow-lg shadow-violet-500/10 scale-[1.01] border-violet-400/30'
          : 'bg-white/60 dark:bg-slate-900/60 hover:bg-gradient-to-br hover:from-slate-500/10 hover:via-violet-500/10 hover:to-slate-500/10 hover:shadow-md hover:scale-[1.005]'
        }
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              isSelected ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {getInitials(customer)}
            </div>
            <h3 className="font-semibold truncate text-sm">{getCustomerDisplayName(customer)}</h3>
            {(() => {
              const status = getCustomerStatus(customer);
              const cfg = {
                current: { label: 'Active', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
                leads: { label: 'Lead', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
                prior: { label: 'Prior', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
              };
              return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${cfg[status].cls}`}>{cfg[status].label}</Badge>;
            })()}
          </div>
          {customer.companyName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 ml-10 truncate">
              <Building2 className="h-3 w-3 flex-shrink-0" />{customer.companyName}
            </p>
          )}
        </div>
        <div className="flex gap-1 ml-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/30" onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/20" onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="space-y-1 text-xs ml-10">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Briefcase className="h-3 w-3" />
          <span>{customer.activeJobCount} active, {customer.totalJobCount} total</span>
        </div>
        {customer.email && (
          <div className="flex items-center gap-2 text-muted-foreground truncate">
            <Mail className="h-3 w-3 flex-shrink-0" /><span className="truncate">{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3 w-3" />{customer.phone}
          </div>
        )}
        {customer.streetAddress ? (
          <div className="flex items-center gap-2 text-muted-foreground truncate">
            <MapPin className={`h-3 w-3 flex-shrink-0 ${customer.latitude ? 'text-slate-500' : 'text-amber-500'}`} />
            <span className="truncate">{customer.streetAddress}{customer.city ? `, ${customer.city}` : ''}</span>
            {!customer.latitude && (
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] ml-auto bg-amber-50 hover:bg-amber-100 text-amber-600"
                onClick={(e) => { e.stopPropagation(); geocodeMutation.mutate(customer.id); }} disabled={geocodeMutation.isPending}>
                <Navigation className="h-2.5 w-2.5 mr-0.5" />{geocodeMutation.isPending ? '...' : 'Map'}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-500/70 text-[10px]">
            <MapPin className="h-3 w-3 flex-shrink-0" /><span>No address</span>
          </div>
        )}
      </div>
    </div>
  );

  const MayaSidebar = () => (
    <>
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md">
          <Sparkles className="h-4 w-4 text-white maya-sparkle-spin" />
        </div>
        <div>
          <h3 className="font-medium text-gray-800 text-sm">Maya AI Advisor</h3>
          <p className="text-[10px] text-muted-foreground">Customer insights</p>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Insights</h4>
          {mayaRecommendations.length > 0 ? (
            mayaRecommendations.map((rec, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-white border border-violet-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => { if (rec.customerId) { setSelectedCustomerId(rec.customerId); setMayaChatOpen(false); } }}>
                <div className="flex items-center gap-2 mb-1">
                  {rec.type === "prioritize" && <TrendingUp className="h-4 w-4 text-slate-600" />}
                  {rec.type === "followup" && <UserCheck className="h-4 w-4 text-blue-500" />}
                  {rec.type === "schedule" && <MapPin className="h-4 w-4 text-amber-500" />}
                  {rec.type === "price" && <AlertTriangle className="h-4 w-4 text-slate-500" />}
                  <span className="text-sm font-medium text-gray-800">{rec.title}</span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{rec.message}</p>
                {rec.customerId && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-violet-600">
                    <span>View</span><ChevronRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">Add customers to get insights.</p>
          )}

          {chatMessages.length > 0 && (
            <>
              <div className="h-px bg-violet-100 my-4" />
              <h4 className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Conversation</h4>
              <div className="space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`p-3 rounded-lg text-sm ${msg.role === "user" ? "bg-gray-100 ml-4" : "bg-violet-50 border border-violet-100"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === "maya" ? <Bot className="h-3 w-3 text-violet-500" /> : <User className="h-3 w-3 text-gray-500" />}
                      <span className="text-xs text-muted-foreground">{msg.role === "maya" ? "Maya" : "You"}</span>
                    </div>
                    <p className="text-gray-700">{msg.content}</p>
                  </div>
                ))}
                {isMayaTyping && (
                  <div className="flex items-center gap-2 text-sm text-violet-500 p-3">
                    <Loader2 className="h-4 w-4 animate-spin" /><span>Maya is thinking...</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input ref={chatInputRef} placeholder="Ask about customers..." value={chatInput}
            onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleMayaChat()}
            className="flex-1 h-10 text-sm" />
          <Button size="icon" className="h-10 w-10 bg-violet-500 hover:bg-violet-600"
            onClick={handleMayaChat} disabled={!chatInput.trim() || isMayaTyping}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  const hasActiveFilters = searchQuery || filterCity || statusFilter !== 'all';

  const customerFormDialog = (
    <Dialog open={isAddDialogOpen || !!editingCustomer} onOpenChange={(open) => { if (!open) { setIsAddDialogOpen(false); setEditingCustomer(null); form.reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          <DialogDescription>{editingCustomer ? 'Update customer information' : 'Enter the details for your new customer'}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Smith" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="ABC Properties LLC" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="(555) 123-4567" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="streetAddress" render={({ field }) => (<FormItem><FormLabel>Street Address</FormLabel><FormControl><Input placeholder="123 Main St" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="Boston" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="MA" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="02108" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Additional notes..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); setEditingCustomer(null); form.reset(); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingCustomer ? 'Update' : 'Add Customer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {customerFormDialog}

      <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between shrink-0"
        style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)", backdropFilter: "blur(24px) saturate(180%)" }}>
        <div>
          <h2 className="font-semibold text-lg sm:text-xl">Customers</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage your clients and view their locations</p>
        </div>
        <div className="flex items-center gap-2">
          <Sheet open={mayaChatOpen} onOpenChange={setMayaChatOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden h-9 gap-2 touch-manipulation">
                <Sparkles className="h-4 w-4 text-violet-500" /><span className="hidden sm:inline">Maya</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] p-0">
              <SheetHeader className="p-4 border-b bg-gradient-to-r from-violet-100/80 to-purple-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white maya-sparkle-spin" />
                  </div>
                  <SheetTitle>Maya AI Advisor</SheetTitle>
                </div>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-180px)] p-4">
                <div className="space-y-3">
                  {mayaRecommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-white border border-violet-100"
                      onClick={() => { if (rec.customerId) { setSelectedCustomerId(rec.customerId); setMayaChatOpen(false); } }}>
                      <div className="flex items-center gap-2 mb-1">
                        {rec.type === "prioritize" && <TrendingUp className="h-4 w-4 text-slate-600" />}
                        {rec.type === "followup" && <UserCheck className="h-4 w-4 text-blue-500" />}
                        {rec.type === "schedule" && <MapPin className="h-4 w-4 text-amber-500" />}
                        {rec.type === "price" && <AlertTriangle className="h-4 w-4 text-slate-500" />}
                        <span className="text-sm font-medium">{rec.title}</span>
                      </div>
                      <p className="text-xs text-gray-600">{rec.message}</p>
                    </div>
                  ))}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`p-3 rounded-lg text-sm ${msg.role === "user" ? "bg-gray-100 ml-4" : "bg-violet-50"}`}>
                      <p>{msg.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
                <div className="flex gap-2">
                  <Input placeholder="Ask about customers..." value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMayaChat()} className="flex-1 h-10" />
                  <Button size="icon" className="h-10 w-10 bg-violet-500" onClick={handleMayaChat}><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Button size="sm" className="h-9 gap-2 touch-manipulation" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4" /><span className="hidden sm:inline">Add Customer</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="hidden lg:flex flex-col w-80 border-r bg-gradient-to-b from-violet-50/50 to-white shrink-0 overflow-hidden">
          <MayaSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="shrink-0 px-4 py-3 border-b bg-white">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CustomerStatus)}
                className="h-8 px-2.5 pr-7 text-xs font-medium bg-violet-50 border border-violet-200 rounded-md text-violet-700 cursor-pointer shrink-0">
                <option value="all">All ({statusCounts.all})</option>
                <option value="current">Active ({statusCounts.current})</option>
                <option value="leads">Leads ({statusCounts.leads})</option>
                <option value="prior">Prior ({statusCounts.prior})</option>
              </select>

              {uniqueCities.length > 0 && (
                <select value={filterCity || "all-cities"} onChange={(e) => setFilterCity(e.target.value === "all-cities" ? "" : e.target.value)}
                  className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 cursor-pointer shrink-0">
                  <option value="all-cities">All Cities</option>
                  {uniqueCities.map(city => <option key={city} value={city!}>{city}</option>)}
                </select>
              )}

              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                className="h-8 px-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 cursor-pointer shrink-0">
                <option value="name">By Name</option>
                <option value="company">By Company</option>
                <option value="city">By City</option>
                <option value="jobs">Most Jobs</option>
              </select>

              {hasActiveFilters && (
                <button onClick={() => { setSearchQuery(""); setFilterCity(""); setStatusFilter("all"); }}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-0.5 whitespace-nowrap touch-manipulation shrink-0">
                  <X className="h-3 w-3" />Clear
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 w-32 text-xs border-slate-200 bg-slate-50 focus:bg-white focus:w-44 transition-all" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded">
                      <X className="h-3 w-3 text-slate-400" />
                    </button>
                  )}
                </div>

                <button onClick={() => setShowMap(!showMap)}
                  className={`p-1.5 rounded transition-colors touch-manipulation ${showMap ? 'bg-violet-100 text-violet-700' : 'hover:bg-slate-100 text-slate-500'}`}
                  title="Toggle Map">
                  <Map className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-center bg-muted rounded-md p-0.5">
                  <button onClick={() => setViewMode("cards")}
                    className={`p-1.5 rounded transition-colors touch-manipulation ${viewMode === "cards" ? "bg-white shadow-sm" : "hover:bg-white/50"}`}
                    title="Card View"><LayoutGrid className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded transition-colors touch-manipulation ${viewMode === "list" ? "bg-white shadow-sm" : "hover:bg-white/50"}`}
                    title="List View"><List className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          </div>

          {(filteredAndSortedCustomers.length !== customers.length || hasActiveFilters) && (
            <div className="px-4 py-1 bg-slate-50/80 border-b">
              <span className="text-[11px] text-slate-400">
                Showing {filteredAndSortedCustomers.length} of {customers.length} customers
                {customersWithCoords.length > 0 && ` (${customersWithCoords.length} on map)`}
              </span>
            </div>
          )}

          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className={`${showMap ? 'w-1/2' : 'w-full'} h-full overflow-y-auto`}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading customers...</p>
                  </div>
                </div>
              ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <User className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">Add your first customer to start tracking work orders.</p>
                  <Button onClick={() => setIsAddDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Your First Customer</Button>
                </div>
              ) : viewMode === 'cards' ? (
                <div className="p-4">
                  <div className="flex items-start gap-3 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
                    {filteredAndSortedCustomers.map(customer => {
                      const isSelected = selectedCustomerId === customer.id;
                      return (
                        <button key={customer.id} onClick={() => handleCardClick(customer)}
                          className="flex flex-col items-center min-w-[70px] sm:min-w-[90px] group touch-manipulation">
                          <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isSelected ? "ring-2 ring-violet-400 scale-105" : "hover:scale-105"
                          }`}
                            style={{
                              background: isSelected
                                ? "linear-gradient(180deg, rgba(245,243,255,0.95), rgba(237,233,254,0.9))"
                                : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))",
                              boxShadow: isSelected ? "0 6px 20px rgba(139, 92, 246, 0.2)" : "0 4px 12px rgba(0,0,0,0.06)",
                            }}>
                            <span className={`text-sm font-bold ${isSelected ? 'text-violet-700' : 'text-slate-500'}`}>
                              {getInitials(customer)}
                            </span>
                            {customer.activeJobCount > 1 && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-500 rounded-full flex items-center justify-center">
                                <span className="text-[8px] text-white font-bold">{customer.activeJobCount}</span>
                              </div>
                            )}
                          </div>
                          <span className={`text-xs mt-2 font-medium truncate max-w-[65px] ${isSelected ? "text-violet-700" : "text-foreground"}`}>
                            {getCustomerDisplayName(customer).split(',')[0].split(' ')[0]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {customer.activeJobCount > 0 ? `${customer.activeJobCount} active` : customer.totalJobCount > 0 ? 'Prior' : 'Lead'}
                          </span>
                        </button>
                      );
                    })}
                    {filteredAndSortedCustomers.length === 0 && (
                      <div className="text-sm text-muted-foreground px-4">No customers found</div>
                    )}
                  </div>

                  {selectedCustomerId && (() => {
                    const customer = filteredAndSortedCustomers.find(c => c.id === selectedCustomerId);
                    if (!customer) return null;
                    return (
                      <Card className="mt-4 overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-white">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-slate-600 font-bold"
                              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.95))", boxShadow: "0 3px 10px rgba(0,0,0,0.08)" }}>
                              {getInitials(customer)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg">{getCustomerDisplayName(customer)}</h3>
                              {customer.companyName && <p className="text-sm text-muted-foreground">{customer.companyName}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEdit(customer)}><Edit className="h-3 w-3 mr-1" />Edit</Button>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedCustomerId(null)}><X className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-muted-foreground">Jobs:</span><p className="font-medium">{customer.activeJobCount} active, {customer.totalJobCount} total</p></div>
                            {customer.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /><span>{customer.email}</span></div>}
                            {customer.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" /><span>{customer.phone}</span></div>}
                            {customer.streetAddress && (
                              <div className="flex items-center gap-2 col-span-2"><MapPin className="h-3 w-3 text-muted-foreground" /><span>{customer.streetAddress}{customer.city ? `, ${customer.city}` : ''}{customer.state ? ` ${customer.state}` : ''}</span></div>
                            )}
                          </div>
                          {customer.notes && <div className="mt-4 pt-4 border-t"><p className="text-sm text-gray-600">{customer.notes}</p></div>}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {!selectedCustomerId && filteredAndSortedCustomers.length > 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Select a customer to view details</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2 sm:p-4">
                  <div className="rounded-lg border bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-medium">Customer</th>
                          <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">City</th>
                          <th className="text-center px-3 py-2.5 font-medium">Jobs</th>
                          <th className="text-center px-3 py-2.5 font-medium hidden md:table-cell">Status</th>
                          <th className="text-right px-3 py-2.5 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedCustomers.map(customer => (
                          <tr key={customer.id}
                            className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${selectedCustomerId === customer.id ? "bg-violet-50" : ""}`}
                            onClick={() => handleCardClick(customer)}>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 text-xs font-bold shrink-0 bg-slate-100">
                                  {getInitials(customer)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{getCustomerDisplayName(customer)}</p>
                                  {customer.companyName && <p className="text-xs text-muted-foreground truncate">{customer.companyName}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell">
                              <span className="text-muted-foreground">{customer.city || '—'}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="font-medium text-slate-700">{customer.activeJobCount}/{customer.totalJobCount}</span>
                            </td>
                            <td className="px-3 py-3 text-center hidden md:table-cell">
                              {(() => {
                                const status = getCustomerStatus(customer);
                                const cfg = {
                                  current: { label: 'Active', cls: 'bg-slate-100 text-slate-600' },
                                  leads: { label: 'Lead', cls: 'bg-blue-50 text-blue-600' },
                                  prior: { label: 'Prior', cls: 'bg-slate-50 text-slate-500' },
                                };
                                return <Badge className={`${cfg[status].cls} text-[10px] px-1.5 py-0.5`}>{cfg[status].label}</Badge>;
                              })()}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-50 touch-manipulation"
                                  onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}><Edit className="h-4 w-4" /></Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 touch-manipulation"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredAndSortedCustomers.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground"><p>No customers match your filters</p></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {selectedCustomerId && viewMode === "list" && (() => {
                    const customer = filteredAndSortedCustomers.find(c => c.id === selectedCustomerId);
                    if (!customer) return null;
                    return (
                      <Card className="mt-4 border-violet-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 font-bold bg-slate-100">
                                {getInitials(customer)}
                              </div>
                              <div>
                                <h4 className="font-semibold">{getCustomerDisplayName(customer)}</h4>
                                <p className="text-xs text-muted-foreground">{customer.email || customer.phone || ''}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedCustomerId(null)}><X className="h-4 w-4" /></Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {customer.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{customer.phone}</div>}
                            {customer.streetAddress && <div className="flex items-center gap-2 col-span-2"><MapPin className="h-3 w-3 text-muted-foreground" />{customer.streetAddress}{customer.city ? `, ${customer.city}` : ''}</div>}
                          </div>
                          {customer.notes && <p className="text-sm text-gray-600 mt-3 pt-3 border-t">{customer.notes}</p>}
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              )}
            </div>

            {showMap && (
              <div className="w-1/2 h-full rounded-xl overflow-hidden border border-white/20 shadow-lg relative">
                <MapContainer center={mapCenter} zoom={customersWithCoords.length > 0 ? 10 : 4} className="h-full w-full" scrollWheelZoom={true}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FlyToCustomer customerId={selectedCustomerId} customers={filteredAndSortedCustomers} />
                  {customersWithCoords.map(customer => {
                    const lat = parseCoord(customer.latitude)!;
                    const lng = parseCoord(customer.longitude)!;
                    const isSelected = selectedCustomerId === customer.id;
                    return (
                      <Marker key={customer.id} position={[lat, lng]} icon={isSelected ? selectedIcon : defaultIcon}
                        eventHandlers={{ click: () => setSelectedCustomerId(customer.id) }}>
                        <Popup>
                          <div className="min-w-[200px]">
                            <h3 className="font-semibold text-base">{getCustomerDisplayName(customer)}</h3>
                            {customer.companyName && <p className="text-sm text-gray-600">{customer.companyName}</p>}
                            <p className="text-sm mt-1">{customer.streetAddress}{customer.city && `, ${customer.city}`}{customer.state && ` ${customer.state}`}</p>
                            {customer.phone && <p className="text-sm mt-1">{customer.phone}</p>}
                            <div className="mt-2 pt-2 border-t flex justify-between items-center">
                              <span className="text-xs text-gray-500">{customer.activeJobCount} active job{customer.activeJobCount !== 1 ? 's' : ''}</span>
                              <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                <Navigation className="h-3 w-3" />Directions
                              </a>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
                {customers.length > 0 && customersWithCoords.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 text-center max-w-sm mx-4 shadow-xl">
                      <MapPin className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                      <h3 className="font-semibold mb-2">No Locations Available</h3>
                      <p className="text-sm text-muted-foreground mb-4">Add addresses and click "Map" to see customers here.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  return <CustomersContent embedded={false} />;
}
