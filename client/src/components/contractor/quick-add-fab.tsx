import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Plus,
  X,
  Briefcase,
  UserPlus,
  Receipt,
  FileText,
  Clock,
  Lock,
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

interface QuickAddFabProps {
  onNavigate?: (view: string) => void;
}

export function QuickAddFab({ onNavigate }: QuickAddFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<"job" | "customer" | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: customers = [] } = useQuery<Array<{ id: string; name: string; company?: string }>>({
    queryKey: ["/api/contractor/customers"],
  });

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
    { id: "job", label: "New Job", icon: Briefcase, color: "text-slate-600", bg: "bg-slate-100/60", available: true },
    { id: "customer", label: "New Customer", icon: UserPlus, color: "text-slate-600", bg: "bg-slate-100/60", available: true },
    { id: "quote", label: "New Quote", icon: FileText, color: "text-slate-600", bg: "bg-slate-100/60", available: true },
    { id: "invoice", label: "New Invoice", icon: Receipt, color: "text-slate-400", bg: "bg-slate-50/40", available: false },
  ];

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {isOpen && (
          <div className="flex flex-col gap-2 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
            {fabOptions.map((option, idx) => (
              <button
                key={option.id}
                onClick={() => option.available ? handleOptionClick(option.id) : handleOptionClick("invoice")}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 min-w-[180px] group
                  ${option.available 
                    ? 'hover:scale-[1.02] active:scale-[0.98] cursor-pointer' 
                    : 'opacity-60 cursor-default'
                  }`}
                style={{
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(200, 200, 200, 0.3)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
                  animationDelay: `${idx * 50}ms`,
                }}
              >
                <div className={`w-9 h-9 rounded-lg ${option.bg} flex items-center justify-center flex-shrink-0`}>
                  {option.available ? (
                    <option.icon className={`h-4 w-4 ${option.color}`} />
                  ) : (
                    <Lock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <span className={`text-sm font-medium ${option.available ? 'text-gray-700' : 'text-gray-400'}`}>
                  {option.label}
                </span>
                {!option.available && (
                  <span className="text-[10px] text-gray-400 ml-auto">Soon</span>
                )}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 touch-manipulation"
          style={{
            background: isOpen 
              ? 'rgba(120, 120, 130, 0.9)' 
              : 'rgba(80, 80, 90, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
            <Plus className="h-6 w-6 text-white" />
          </div>
        </button>
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
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
    </>
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
