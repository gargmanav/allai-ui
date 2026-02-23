import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, ChevronDown, ChevronRight, Loader2, Check, User, Mail, Phone, Shield, Wrench, Zap, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TIER_NAMES: Record<string, string> = {
  tier1: 'Tier 1: Essential Services',
  tier2: 'Tier 2: Specialized Trades',
  tier3: 'Tier 3: Premium Services',
  tier4: 'Tier 4: Emergency Services',
  tier5: 'Tier 5: Technology & Security',
  tier6: 'Tier 6: Specialty Services',
};

type SignupStep = 'email' | 'phone' | 'verify-phone' | 'specialties' | 'complete';

const STEPS = [
  { key: 'email', label: 'Info', icon: User },
  { key: 'phone', label: 'Verify', icon: Phone },
  { key: 'specialties', label: 'Skills', icon: Wrench },
] as const;

const VALUE_PROPS = [
  { icon: Zap, text: "No cold leads — real jobs, real clients" },
  { icon: Shield, text: "Get paid on time, every time" },
  { icon: Wrench, text: "AI sends you prepared with full diagnostics" },
];

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

const phoneSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
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
  if (step === 'phone' || step === 'verify-phone') return 1;
  return 2;
}

export default function ContractorSignup() {
  const [step, setStep] = useState<SignupStep>('email');
  const [userId, setUserId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<Set<string>>(new Set());
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set(['tier1']));
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

  const emailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailSchema>) => {
      const res = await apiRequest('/api/auth/signup-contractor/email', {
        method: 'POST',
        body: data,
      });
      return res;
    },
    onSuccess: (data) => {
      setUserId(data.userId);
      toast({ title: 'Email sent!', description: 'Check your email for a verification link.' });
      transitionTo('phone');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send verification email. Please try again.', variant: 'destructive' });
    },
  });

  const phoneMutation = useMutation({
    mutationFn: async (data: z.infer<typeof phoneSchema>) => {
      const res = await apiRequest('/api/auth/signup-contractor/phone', {
        method: 'POST',
        body: { userId, phone: data.phone },
      });
      return res;
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
      const res = await apiRequest('/api/auth/signup-contractor/verify-phone', {
        method: 'POST',
        body: { phone, code: data.code },
      });
      return res;
    },
    onSuccess: () => {
      toast({ title: 'Phone verified!', description: 'Now select your specialties.' });
      transitionTo('specialties');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Invalid or expired code. Please try again.', variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof specialtiesSchema>) => {
      const res = await apiRequest('/api/auth/signup-contractor/complete', {
        method: 'POST',
        body: { userId, specialtyIds: data.specialtyIds, bio: data.bio },
      });
      return res;
    },
    onSuccess: (data) => {
      sessionStorage.setItem('refreshToken', data.session.refreshToken);
      sessionStorage.setItem('sessionId', data.session.sessionId);
      toast({ title: 'Welcome!', description: 'Your contractor account is ready.' });
      setLocation('/contractor-dashboard');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to complete signup. Please try again.', variant: 'destructive' });
    },
  });

  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', firstName: '', lastName: '' },
  });

  const phoneForm = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
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

  const toggleTier = (tier: string) => {
    const newExpanded = new Set(expandedTiers);
    if (newExpanded.has(tier)) {
      newExpanded.delete(tier);
    } else {
      newExpanded.add(tier);
    }
    setExpandedTiers(newExpanded);
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
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit((data) => emailMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={emailForm.control}
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
                      control={emailForm.control}
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
                    control={emailForm.control}
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
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02]"
                    disabled={emailMutation.isPending}
                    data-testid="button-submit-email"
                  >
                    {emailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Continue
                  </Button>
                </form>
              </Form>
            )}

            {step === 'phone' && (
              <Form {...phoneForm}>
                <form onSubmit={phoneForm.handleSubmit((data) => { setPhone(data.phone); phoneMutation.mutate(data); })} className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-sm text-gray-500">We'll send a verification code to your phone</p>
                  </div>
                  <FormField
                    control={phoneForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 text-sm font-medium">Phone Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input {...field} type="tel" placeholder="+1 (555) 123-4567" className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl" data-testid="input-phone" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02]"
                    disabled={phoneMutation.isPending}
                    data-testid="button-submit-phone"
                  >
                    {phoneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Verification Code
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
                  <div className="text-center mb-2">
                    <p className="text-sm text-gray-500">Choose the services you provide</p>
                  </div>

                  {specialtiesLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white/60 p-3">
                      {Object.entries(specialtiesByTier).sort().map(([tier, specs]) => (
                        <div key={tier} className="rounded-lg border border-gray-100 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleTier(tier)}
                            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-50/50 transition-colors"
                            data-testid={`toggle-tier-${tier}`}
                          >
                            <span className="font-medium text-sm text-gray-700">{TIER_NAMES[tier]}</span>
                            {expandedTiers.has(tier) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                          </button>
                          {expandedTiers.has(tier) && (
                            <div className="px-4 pb-3 space-y-2 bg-gray-50/50">
                              {(specs as any[]).map((specialty) => (
                                <div key={specialty.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={specialty.id}
                                    checked={selectedSpecialties.has(specialty.id)}
                                    onCheckedChange={() => toggleSpecialty(specialty.id)}
                                    data-testid={`checkbox-specialty-${specialty.id}`}
                                    className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                  />
                                  <label htmlFor={specialty.id} className="text-sm cursor-pointer text-gray-600">
                                    {specialty.name}
                                    {specialty.description && (
                                      <span className="text-gray-400 ml-1.5">— {specialty.description}</span>
                                    )}
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedSpecialties.size > 0 && (
                    <p className="text-xs text-blue-500 font-medium">
                      {selectedSpecialties.size} {selectedSpecialties.size === 1 ? 'specialty' : 'specialties'} selected
                    </p>
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
