import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Loader2, Check, User, Mail, Phone, Shield, Wrench, Zap, ArrowLeft, Search, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CATEGORY_LABELS: Record<string, string> = {
  tier1: 'Core Trades',
  tier2: 'Specialized Trades',
  tier3: 'Premium & Technical',
  tier4: 'Home Improvement',
  tier5: 'Outdoor & Heavy',
  tier6: 'Compliance & Safety',
};

type SignupStep = 'email' | 'verify-phone' | 'specialties' | 'complete';

const STEPS = [
  { key: 'email', label: 'Info', icon: User },
  { key: 'verify-phone', label: 'Verify', icon: Phone },
  { key: 'specialties', label: 'Skills', icon: Wrench },
] as const;

const VALUE_PROPS = [
  { icon: Zap, text: "No cold leads — real jobs, real clients" },
  { icon: Shield, text: "Get paid on time, every time" },
  { icon: Wrench, text: "AI sends you prepared with full diagnostics" },
];

const infoSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().refine(val => val.replace(/\D/g, '').length === 10, 'Please enter a complete 10-digit phone number'),
  smsOptIn: z.boolean().default(false),
});

const verifyPhoneSchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const specialtiesSchema = z.object({
  specialtyIds: z.array(z.string()).min(1, 'Select at least one specialty'),
  bio: z.string().optional(),
});

function getStepIndex(step: SignupStep): number {
  if (step === 'email') return 0;
  if (step === 'verify-phone') return 1;
  return 2;
}

export default function ContractorSignup() {
  const [step, setStep] = useState<SignupStep>('email');
  const [userId, setUserId] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<Set<string>>(new Set());
  const [skillSearch, setSkillSearch] = useState('');
  const [fadeIn, setFadeIn] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const currentStepIndex = getStepIndex(step);

  const transitionTo = (nextStep: SignupStep) => {
    setFadeIn(false);
    setTimeout(() => {
      setStep(nextStep);
      setFadeIn(true);
    }, 200);
  };

  const { data: specialties, isLoading: specialtiesLoading } = useQuery<any[]>({
    queryKey: ['/api/contractor-specialties'],
    enabled: step === 'specialties',
  });

  const specialtiesByTier = specialties?.reduce((acc, specialty) => {
    if (!acc[specialty.tier]) {
      acc[specialty.tier] = [];
    }
    acc[specialty.tier].push(specialty);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const infoMutation = useMutation({
    mutationFn: async (data: z.infer<typeof infoSchema>) => {
      const res = await apiRequest('POST', '/api/auth/signup-contractor/email', {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone.replace(/\D/g, ''),
        smsOptIn: data.smsOptIn,
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      setUserId(data.userId);
      const phoneValue = infoForm.getValues('phone').replace(/\D/g, '');
      setPhone(phoneValue);
      toast({ title: 'Account created!', description: 'Now let\'s verify your phone number.' });
      phoneMutation.mutate({ userId: data.userId, phone: phoneValue });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create account. Please try again.', variant: 'destructive' });
    },
  });

  const phoneMutation = useMutation({
    mutationFn: async (data: { userId: string; phone: string }) => {
      const res = await apiRequest('POST', '/api/auth/signup-contractor/phone', data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: 'Code sent!', description: 'Check your phone for a verification code.' });
      transitionTo('verify-phone');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send verification code. Please try again.', variant: 'destructive' });
    },
  });

  const verifyPhoneMutation = useMutation({
    mutationFn: async (data: z.infer<typeof verifyPhoneSchema>) => {
      const res = await apiRequest('POST', '/api/auth/signup-contractor/verify-phone', { phone, code: data.code });
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.userId) setUserId(data.userId);
      toast({ title: 'Phone verified!', description: 'Now select your specialties.' });
      transitionTo('specialties');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Invalid or expired code. Please try again.', variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof specialtiesSchema>) => {
      const res = await apiRequest('POST', '/api/auth/signup-contractor/complete', { userId, specialtyIds: data.specialtyIds, bio: data.bio });
      return await res.json();
    },
    onSuccess: async (data: any) => {
      sessionStorage.setItem('refreshToken', data.session?.refreshToken);
      sessionStorage.setItem('sessionId', data.session?.sessionId);
      toast({ title: 'Welcome!', description: 'Your contractor account is ready.' });
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
      setLocation('/contractor-dashboard');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to complete signup. Please try again.', variant: 'destructive' });
    },
  });

  const infoForm = useForm({
    resolver: zodResolver(infoSchema),
    defaultValues: { email: '', firstName: '', lastName: '', phone: '', smsOptIn: false },
  });

  const verifyPhoneForm = useForm({
    resolver: zodResolver(verifyPhoneSchema),
    defaultValues: { code: '' },
  });

  const specialtiesForm = useForm({
    resolver: zodResolver(specialtiesSchema),
    defaultValues: { specialtyIds: [] as string[], bio: '' },
  });

  const toggleSpecialty = (specialtyId: string) => {
    const newSelected = new Set(selectedSpecialties);
    if (newSelected.has(specialtyId)) {
      newSelected.delete(specialtyId);
    } else {
      newSelected.add(specialtyId);
    }
    setSelectedSpecialties(newSelected);
    specialtiesForm.setValue('specialtyIds', Array.from(newSelected));
  };

  const toggleCategory = (tier: string, filteredSpecs?: any[]) => {
    const specsToToggle = filteredSpecs || (specialtiesByTier[tier] || []) as any[];
    const allSelected = specsToToggle.every((s: any) => selectedSpecialties.has(s.id));
    const newSelected = new Set(selectedSpecialties);
    specsToToggle.forEach((s: any) => {
      if (allSelected) {
        newSelected.delete(s.id);
      } else {
        newSelected.add(s.id);
      }
    });
    setSelectedSpecialties(newSelected);
    specialtiesForm.setValue('specialtyIds', Array.from(newSelected));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 30%, #f5f3ff 60%, #faf5ff 100%)',
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-100/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg z-10">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 text-gray-500 hover:text-gray-700 transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800">AllAI Property</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Join as a Contractor</h1>
          <p className="text-gray-500 text-sm">Get access to real maintenance jobs — no cold leads</p>
        </div>

        <div
          className="rounded-2xl border-2 p-6 md:p-8"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.95) 50%, rgba(243,244,255,0.92) 100%)',
            borderColor: 'rgba(255, 255, 255, 0.9)',
            boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.8), inset 0 -2px 8px rgba(99,102,241,0.06), 0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.5)',
            backdropFilter: 'blur(40px) saturate(200%)',
          }}
        >
          <div className="flex items-center justify-between mb-8 relative">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === currentStepIndex;
              const isCompleted = i < currentStepIndex;
              return (
                <div key={s.key} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                      isCompleted
                        ? 'bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-blue-500/25'
                        : isActive
                        ? 'bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-blue-500/25 scale-110'
                        : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-medium mt-2 transition-colors duration-300 ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-blue-500' : 'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
            <div className="absolute top-5 left-[16%] right-[16%] h-0.5 bg-gray-200 z-0">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500 rounded-full"
                style={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>

          <div
            className={`transition-all duration-200 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          >
            {step === 'email' && (
              <Form {...infoForm}>
                <form onSubmit={infoForm.handleSubmit((data) => infoMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={infoForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 text-sm font-medium">First Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input {...field} placeholder="John" className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl" data-testid="input-first-name" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={infoForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 text-sm font-medium">Last Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input {...field} placeholder="Smith" className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl" data-testid="input-last-name" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={infoForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 text-sm font-medium">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input {...field} type="email" placeholder="john@company.com" className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl" data-testid="input-email" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={infoForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 text-sm font-medium">Cell Phone</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="tel"
                              placeholder="(555) 123-4567"
                              maxLength={14}
                              className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl"
                              data-testid="input-phone"
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                let formatted = '';
                                if (digits.length > 0) formatted = '(' + digits.slice(0, 3);
                                if (digits.length >= 3) formatted += ') ';
                                if (digits.length > 3) formatted += digits.slice(3, 6);
                                if (digits.length >= 6) formatted += '-';
                                if (digits.length > 6) formatted += digits.slice(6, 10);
                                field.onChange(formatted);
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={infoForm.control}
                    name="smsOptIn"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-start space-x-3 rounded-xl bg-blue-50/60 p-3 border border-blue-100">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                              data-testid="checkbox-sms-optin"
                            />
                          </FormControl>
                          <div className="space-y-0.5">
                            <span className="text-sm font-medium text-gray-700">Receive SMS notifications</span>
                            <p className="text-xs text-gray-500 leading-relaxed">
                              Get job alerts, scheduling updates, and client messages via text. You can opt out anytime. Reply STOP to opt out.
                            </p>
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02]"
                    disabled={infoMutation.isPending || phoneMutation.isPending}
                    data-testid="button-submit-email"
                  >
                    {(infoMutation.isPending || phoneMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Continue
                  </Button>
                </form>
              </Form>
            )}

            {step === 'verify-phone' && (
              <Form {...verifyPhoneForm}>
                <form onSubmit={verifyPhoneForm.handleSubmit((data) => verifyPhoneMutation.mutate(data))} className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-sm text-gray-500">Enter the 6-digit code sent to your phone</p>
                  </div>
                  <FormField
                    control={verifyPhoneForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 text-sm font-medium">Verification Code</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input {...field} placeholder="123456" maxLength={6} className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl text-center text-lg tracking-widest font-mono" data-testid="input-verification-code" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02]"
                    disabled={verifyPhoneMutation.isPending}
                    data-testid="button-verify-phone"
                  >
                    {verifyPhoneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify Phone
                  </Button>
                </form>
              </Form>
            )}

            {step === 'specialties' && (
              <Form {...specialtiesForm}>
                <form onSubmit={specialtiesForm.handleSubmit((data) => completeMutation.mutate(data))} className="space-y-4">
                  {selectedSpecialties.size > 0 && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold" style={{ color: 'hsl(210, 60%, 55%)' }}>
                          {selectedSpecialties.size} {selectedSpecialties.size === 1 ? 'skill' : 'skills'} selected
                        </p>
                        <button
                          type="button"
                          onClick={() => { setSelectedSpecialties(new Set()); specialtiesForm.setValue('specialtyIds', []); }}
                          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {specialties?.filter((s: any) => selectedSpecialties.has(s.id)).map((s: any) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSpecialty(s.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-blue-600 border border-blue-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                          >
                            {s.name}
                            <span className="text-[10px] leading-none">&times;</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-1">
                    <p className="text-sm text-gray-500">Tap any and all services you provide</p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search skills... (e.g. roof, snow, plumbing)"
                      value={skillSearch}
                      onChange={(e) => setSkillSearch(e.target.value)}
                      className="pl-9 h-10 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl text-sm"
                    />
                    {skillSearch && (
                      <button
                        type="button"
                        onClick={() => setSkillSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {specialtiesLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white/60 p-3">
                      {Object.entries(specialtiesByTier).sort().map(([tier, specs]) => {
                        const filtered = (specs as any[]).filter((s: any) =>
                          !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase())
                        );
                        if (filtered.length === 0) return null;
                        const allSelected = filtered.every((s: any) => selectedSpecialties.has(s.id));
                        return (
                          <div key={tier}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(210, 60%, 70%)' }}>
                                {CATEGORY_LABELS[tier] || tier}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleCategory(tier, filtered)}
                                className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                                  allSelected
                                    ? 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                                    : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50'
                                }`}
                              >
                                <CheckCheck className="h-3 w-3" />
                                {allSelected ? 'Deselect all' : 'Select all'}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {filtered.map((specialty: any) => {
                                const isSelected = selectedSpecialties.has(specialty.id);
                                const isSearchMatch = skillSearch && specialty.name.toLowerCase().includes(skillSearch.toLowerCase());
                                return (
                                  <button
                                    key={specialty.id}
                                    type="button"
                                    onClick={() => toggleSpecialty(specialty.id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border cursor-pointer ${
                                      isSelected
                                        ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white border-blue-400 shadow-sm shadow-blue-500/20'
                                        : isSearchMatch
                                        ? 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-300'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                                    }`}
                                  >
                                    {isSelected && <Check className="h-3 w-3" />}
                                    {specialty.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {skillSearch && Object.entries(specialtiesByTier).every(([_, specs]) =>
                        (specs as any[]).every((s: any) => !s.name.toLowerCase().includes(skillSearch.toLowerCase()))
                      ) && (
                        <p className="text-center text-sm text-gray-400 py-4">
                          No skills match "{skillSearch}"
                        </p>
                      )}
                    </div>
                  )}

                  <FormField
                    control={specialtiesForm.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 text-sm font-medium">Bio (Optional)</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            className="w-full min-h-20 p-3 border border-gray-200 rounded-xl bg-white/80 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none resize-none transition-all"
                            placeholder="Tell clients about your experience and expertise..."
                            data-testid="textarea-bio"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02]"
                    disabled={completeMutation.isPending || selectedSpecialties.size === 0}
                    data-testid="button-complete-signup"
                  >
                    {completeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Complete Signup
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {VALUE_PROPS.map((prop, i) => {
            const Icon = prop.icon;
            return (
              <div
                key={i}
                className="flex flex-col items-center text-center p-3 rounded-xl"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.7), rgba(248,250,255,0.5))',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400/20 to-blue-500/20 flex items-center justify-center mb-2">
                  <Icon className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-xs text-gray-500 leading-tight">{prop.text}</span>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
