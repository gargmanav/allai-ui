import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Plus,
  Briefcase,
  UserPlus,
  Receipt,
  FileText,
  Clock,
  Lock,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QuickAddProps {
  onNavigate?: (view: string) => void;
}

export function QuickAdd({ onNavigate }: QuickAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<"job" | "customer" | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: customers = [] } = useQuery<Array<{ id: string; name: string; company?: string }>>({
    queryKey: ["/api/contractor/customers"],
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleOptionClick = (option: string) => {
    setIsOpen(false);
    if (option === "job") {
      setActiveForm("job");
    } else if (option === "customer") {
      setActiveForm("customer");
    } else if (option === "quote") {
      navigate("/contractor/quotes/new");
    } else if (option === "invoice") {
      toast({
        title: "Coming Soon",
        description: "Invoicing will be available in a future update.",
      });
    }
  };

  const fabOptions = [
    { id: "job", label: "New Job", desc: "Schedule a job or appointment", icon: Briefcase, available: true },
    { id: "customer", label: "New Customer", desc: "Add a customer contact", icon: UserPlus, available: true },
    { id: "quote", label: "New Quote", desc: "Create a quote for a customer", icon: FileText, available: true },
    { id: "invoice", label: "New Invoice", desc: "Send an invoice", icon: Receipt, available: false },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        style={{
          background: 'rgba(100, 116, 139, 0.12)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <Plus className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs font-medium text-slate-600">Quick Add</span>
        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(200, 200, 200, 0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div className="px-3 py-2 border-b border-gray-100/60">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Create New</p>
          </div>
          {fabOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => option.available ? handleOptionClick(option.id) : handleOptionClick("invoice")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors duration-150
                ${option.available 
                  ? 'hover:bg-slate-50/80 cursor-pointer' 
                  : 'opacity-50 cursor-default'
                }`}
            >
              <div className="w-7 h-7 rounded-md bg-slate-100/70 flex items-center justify-center flex-shrink-0">
                {option.available ? (
                  <option.icon className="h-3.5 w-3.5 text-slate-500" />
                ) : (
                  <Lock className="h-3 w-3 text-slate-300" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <span className={`text-xs font-medium block ${option.available ? 'text-slate-700' : 'text-slate-400'}`}>
                  {option.label}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">{option.desc}</span>
              </div>
              {!option.available && (
                <span className="text-[9px] text-slate-300 font-medium">Soon</span>
              )}
            </button>
          ))}
        </div>
      )}

      <QuickAddJobDialog 
        open={activeForm === "job"} 
        onClose={() => setActiveForm(null)}
        customers={customers}
      />
      <QuickAddCustomerDialog 
        open={activeForm === "customer"} 
        onClose={() => setActiveForm(null)}
      />
    </div>
  );
}

function QuickAddJobDialog({ 
  open, 
  onClose, 
  customers 
}: { 
  open: boolean; 
  onClose: () => void; 
  customers: Array<{ id: string; name: string; company?: string }>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const mins = (Math.ceil(now.getMinutes() / 15) * 15 % 60).toString().padStart(2, "0");
    return `${hours}:${mins}`;
  });
  const [duration, setDuration] = useState("60");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("Medium");

  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/contractor/quick-job", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/team-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/appointments"] });
      toast({ title: "Job Created", description: "New job has been added to your calendar." });
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create job", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setCustomerId("");
    setAddress("");
    setNotes("");
    setPriority("Medium");
    setDuration("60");
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ title: "Required", description: "Please enter a job title", variant: "destructive" });
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000);

    createJobMutation.mutate({
      title: title.trim(),
      customerId: customerId || undefined,
      scheduledStartAt: startDateTime.toISOString(),
      scheduledEndAt: endDateTime.toISOString(),
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      priority,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]" style={{
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-800">
            <div className="w-8 h-8 rounded-lg bg-slate-100/60 flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-slate-600" />
            </div>
            Quick Add Job
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-gray-500">Job Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kitchen faucet repair"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-500">Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select customer (optional)" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.company ? ` — ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-gray-500">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High (Urgent)</SelectItem>
                <SelectItem value="Emergent">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-500">Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Job site address"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-500">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createJobMutation.isPending}
            className="bg-gray-800 hover:bg-gray-700 text-white"
          >
            {createJobMutation.isPending ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Job"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickAddCustomerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/contractor/customers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/customers"] });
      toast({ title: "Customer Added", description: `${name} has been added to your customers.` });
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create customer", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setCustomerNotes("");
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Required", description: "Please enter a customer name", variant: "destructive" });
      return;
    }

    createCustomerMutation.mutate({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      notes: customerNotes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[400px]" style={{
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-800">
            <div className="w-8 h-8 rounded-lg bg-slate-100/60 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-slate-600" />
            </div>
            Quick Add Customer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-gray-500">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 555-5555"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">Company</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name (optional)"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-500">Notes</Label>
            <Textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Any notes about this customer..."
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createCustomerMutation.isPending}
            className="bg-gray-800 hover:bg-gray-700 text-white"
          >
            {createCustomerMutation.isPending ? "Adding..." : "Add Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
