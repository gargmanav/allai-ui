import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, Link } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Loader2, Check, User, Mail, Phone, Shield, Users, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type SignupStep = 'info' | 'verify-phone' | 'complete';

const STEPS = [
  { key: 'info', label: 'Info', icon: User },
  { key: 'verify-phone', label: 'Verify', icon: Phone },
] as const;

const VALUE_PROPS = [
  { icon: Users, text: "Submit maintenance requests easily" },
  { icon: Shield, text: "Track repair progress in real time" },
  { icon: Phone, text: "Get notified when help is on the way" },
];

const infoSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  smsOptIn: z.boolean().default(false),
});

const verifyPhoneSchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

function getStepIndex(step: SignupStep): number {
  if (step === 'info') return 0;
  return 1;
}

export default function TenantSignup() {
  const [step, setStep] = useState<SignupStep>('info');
  const [userId, setUserId] = useState('');
  const [phone, setPhone] = useState('');
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

  const infoMutation = useMutation({
    mutationFn: async (data: z.infer<typeof infoSchema>) => {
      const res = await apiRequest('POST', '/api/auth/signup-tenant/email', {
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
      toast({ title: 'Account created!', description: "Now let's verify your phone number." });
      phoneMutation.mutate({ userId: data.userId, phone: phoneValue });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create account. Please try again.', variant: 'destructive' });
    },
  });

  const phoneMutation = useMutation({
    mutationFn: async (data: { userId: string; phone: string }) => {
      const res = await apiRequest('POST', '/api/auth/signup-tenant/phone', data);
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
      const res = await apiRequest('POST', '/api/auth/signup-tenant/verify-phone', { phone, code: data.code });
      return await res.json();
    },
    onSuccess: () => {
      completeMutation.mutate({});
    },
    onError: () => {
      toast({ title: 'Error', description: 'Invalid or expired code. Please try again.', variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (_data: {}) => {
      const res = await apiRequest('POST', '/api/auth/signup-tenant/complete', { userId });
      return await res.json();
    },
    onSuccess: (data: any) => {
      sessionStorage.setItem('refreshToken', data.session?.refreshToken);
      sessionStorage.setItem('sessionId', data.session?.sessionId);
      toast({ title: 'Welcome!', description: 'Your tenant account is ready.' });
      setLocation('/tenant-hub');
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
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Tenant Signup</h1>
          <p className="text-gray-500 text-sm">Submit requests and track repairs — all in one place</p>
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
            <div className="absolute top-5 left-[25%] right-[25%] h-0.5 bg-gray-200 z-0">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500 rounded-full"
                style={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>

          <div
            className={`transition-all duration-200 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          >
            {step === 'info' && (
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
                              <Input {...field} placeholder="Jane" className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl" />
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
                              <Input {...field} placeholder="Doe" className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl" />
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
                            <Input {...field} type="email" placeholder="jane@example.com" className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl" />
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
                            />
                          </FormControl>
                          <div className="space-y-0.5">
                            <span className="text-sm font-medium text-gray-700">Receive SMS notifications</span>
                            <p className="text-xs text-gray-500 leading-relaxed">
                              Get repair updates, contractor arrival alerts, and scheduling notifications via text. You can opt out anytime. Reply STOP to opt out.
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
                            <Input {...field} placeholder="123456" maxLength={6} className="pl-9 h-11 bg-white/80 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl text-center text-lg tracking-widest font-mono" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02]"
                    disabled={verifyPhoneMutation.isPending || completeMutation.isPending}
                  >
                    {(verifyPhoneMutation.isPending || completeMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify & Complete
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
