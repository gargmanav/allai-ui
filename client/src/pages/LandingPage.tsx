import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Building2, Wrench, Home, Sparkles, Shield, Users, ChevronRight, ArrowRight, Star, Zap, MessageCircle, Phone, Search, Calendar, Smile } from 'lucide-react';
import ghassan from "@assets/IMG_9883_1762612867473.jpeg";
import nihal from "@assets/IMG_9884_1762612867472.jpeg";
import omar from "@assets/image_1771811659808.png";

const FROSTED_CARD_STYLE = {
  background:
    "radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.99) 0%, rgba(252,252,254,0.96) 15%, rgba(248,249,251,0.92) 30%, rgba(244,245,248,0.85) 50%, rgba(240,241,245,0.78) 70%, rgba(236,237,242,0.70) 100%)",
  backdropFilter: "blur(60px) saturate(220%) brightness(1.04)",
  WebkitBackdropFilter: "blur(60px) saturate(220%) brightness(1.04)",
  border: "2px solid rgba(255, 255, 255, 0.85)",
  boxShadow:
    "inset 0 6px 20px rgba(255,255,255,0.95), inset 0 -4px 12px rgba(180,195,220,0.12), inset 2px 0 8px rgba(255,255,255,0.5), inset -2px 0 8px rgba(200,215,240,0.15), 0 10px 40px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.5)",
};

const roles = [
  {
    title: "Home Owner",
    description: "Maintain your home without the hassle",
    icon: Home,
    badge: "Popular",
    signupLink: "/property-owner-signup",
    loginLink: "/login",
    features: ["Track maintenance & repairs", "Find trusted contractors", "Manage multiple properties"],
    accentFrom: "from-blue-500",
    accentTo: "to-cyan-500",
    glowColor: "rgba(59, 130, 246, 0.35)",
    hoverGlow: "rgba(59, 130, 246, 0.25)",
    lightBarColors: "rgba(59, 130, 246, 0.3), rgba(6, 182, 212, 0.5), rgba(59, 130, 246, 0.3)",
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
    badgeBg: "bg-blue-100 text-blue-700",
    btnClass: "bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 text-white shadow-lg shadow-violet-500/25",
    checkColor: "text-blue-500",
    testIdSignup: "button-property-owner-signup",
    testIdLogin: "button-property-owner-login",
  },
  {
    title: "Landlord",
    description: "Manage properties, tenants, and maintenance",
    icon: Building2,
    signupLink: "/login",
    loginLink: "/login",
    features: ["Manage properties & tenants", "Track maintenance cases", "Invite tenants automatically"],
    accentFrom: "from-blue-500",
    accentTo: "to-cyan-500",
    glowColor: "rgba(59, 130, 246, 0.35)",
    hoverGlow: "rgba(59, 130, 246, 0.25)",
    lightBarColors: "rgba(59, 130, 246, 0.3), rgba(6, 182, 212, 0.5), rgba(59, 130, 246, 0.3)",
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
    btnClass: "bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 text-white shadow-lg shadow-violet-500/25",
    checkColor: "text-blue-500",
    testIdSignup: "button-landlord-login",
    testIdLogin: "button-landlord-login-existing",
  },
  {
    title: "Tenant",
    description: "View your unit and submit requests",
    icon: Users,
    signupLink: "/login",
    loginLink: "/login",
    features: ["Submit maintenance requests", "Track case status", "Approve appointments"],
    accentFrom: "from-blue-500",
    accentTo: "to-cyan-500",
    glowColor: "rgba(59, 130, 246, 0.35)",
    hoverGlow: "rgba(59, 130, 246, 0.25)",
    lightBarColors: "rgba(59, 130, 246, 0.3), rgba(6, 182, 212, 0.5), rgba(59, 130, 246, 0.3)",
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
    btnClass: "bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 text-white shadow-lg shadow-violet-500/25",
    checkColor: "text-blue-500",
    testIdSignup: "button-tenant-login",
    testIdLogin: "button-tenant-login-existing",
  },
  {
    title: "Contractor",
    description: "Open marketplace \u2013 thousands of real-time jobs",
    icon: Wrench,
    signupLink: "/contractor-signup",
    loginLink: "/login",
    features: ["Access job marketplace", "No cold leads - real needs", "Direct client connections"],
    accentFrom: "from-blue-500",
    accentTo: "to-cyan-500",
    glowColor: "rgba(59, 130, 246, 0.35)",
    hoverGlow: "rgba(59, 130, 246, 0.25)",
    lightBarColors: "rgba(59, 130, 246, 0.3), rgba(6, 182, 212, 0.5), rgba(59, 130, 246, 0.3)",
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
    btnClass: "bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 text-white shadow-lg shadow-violet-500/25",
    checkColor: "text-blue-500",
    testIdSignup: "button-contractor-signup",
    testIdLogin: "button-contractor-login",
  },
];

const steps = [
  {
    num: "1",
    title: "Sign Up Free",
    desc: "Create your account in under 2 minutes. Add your home details and you're ready to go.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    num: "2",
    title: "Find Trusted Help",
    desc: "Browse verified contractors by specialty. Save your favorites for quick access when you need help.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    num: "3",
    title: "Stay Organized",
    desc: "Track all maintenance and repairs in one place. AI helps you stay on top of your home's needs.",
    gradient: "from-blue-500 to-cyan-500",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-200/30 dark:bg-violet-900/10 blur-3xl" style={{ animation: "pulseGlow 4s ease-in-out infinite" }} />
        <div className="absolute top-60 -left-40 w-80 h-80 rounded-full bg-blue-200/30 dark:bg-blue-900/10 blur-3xl" style={{ animation: "pulseGlow 5s ease-in-out infinite 1s" }} />
        <div className="absolute bottom-40 right-20 w-72 h-72 rounded-full bg-emerald-200/20 dark:bg-emerald-900/10 blur-3xl" style={{ animation: "pulseGlow 6s ease-in-out infinite 2s" }} />
      </div>

      <div className="relative container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-16 landing-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              AllAI Property
            </span>
          </div>
          <Link href="/login">
            <Button variant="outline" className="rounded-full px-6 border-violet-200 hover:border-violet-400 hover:bg-violet-50 dark:border-violet-800 dark:hover:border-violet-600 transition-all duration-300">
              Sign In
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </header>

        <section className="text-center mb-20">
          <div className="landing-fade-in landing-fade-in-delay-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100/80 dark:bg-violet-900/30 border border-violet-200/60 dark:border-violet-800/40 mb-6">
              <Sparkles className="h-4 w-4 text-violet-500" style={{ animation: "spin 8s linear infinite" }} />
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI-Powered Property Management</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 landing-fade-in landing-fade-in-delay-2">
            <span className="text-gray-900 dark:text-gray-100">Your Home,</span>
            <br />
            <span className="landing-gradient-text">Simplified</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-8 landing-fade-in landing-fade-in-delay-3">
            The all-in-one platform for homeowners, landlords, renters, and contractors.
            Track everything. Automate the rest.
          </p>

          <div className="flex items-center justify-center gap-2 landing-fade-in landing-fade-in-delay-3">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-sm text-gray-500">Featured: Home Owner Tools</span>
            <Sparkles className="h-4 w-4 text-blue-500" style={{ animation: "spin 8s linear infinite" }} />
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-24">
          {roles.map((role, index) => {
            const Icon = role.icon;
            return (
              <div
                key={role.title}
                className={`landing-card group relative rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.04] hover:-translate-y-2 landing-fade-in landing-fade-in-delay-${index + 3}`}
                style={FROSTED_CARD_STYLE}
              >
                <div
                  className="landing-card-glow"
                  style={{ boxShadow: `0 20px 60px ${role.glowColor}, 0 8px 24px ${role.hoverGlow}` }}
                />

                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${role.glowColor.replace('0.35', '0.06')} 0%, transparent 60%)`,
                  }}
                />

                <div
                  className="h-1 transition-all duration-300"
                  style={{
                    background: `linear-gradient(90deg, ${role.lightBarColors})`,
                    backgroundSize: "200% 100%",
                    animation: "runningLight 40s linear infinite",
                  }}
                />

                <div className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-14 h-14 rounded-xl ${role.iconBg} flex items-center justify-center shadow-lg landing-float-icon`}
                      style={{ animationDelay: `${index * 0.5}s` }}
                    >
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    {role.badge && (
                      <span className={`${role.badgeBg} text-[11px] font-semibold px-2.5 py-1 rounded-full`}>
                        {role.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{role.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{role.description}</p>

                  <div className="space-y-2 mb-5">
                    <Link href={role.signupLink}>
                      <Button
                        className={`w-full rounded-xl h-11 font-semibold transition-all duration-300 ${role.btnClass}`}
                        data-testid={role.testIdSignup}
                      >
                        Get Started Free
                        <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <Link href={role.loginLink}>
                      <Button
                        variant="ghost"
                        className="w-full rounded-xl h-10 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        data-testid={role.testIdLogin}
                      >
                        Login
                      </Button>
                    </Link>
                  </div>

                  <div className="pt-4 border-t border-gray-100/80 dark:border-gray-800/50 space-y-2">
                    {role.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${role.iconBg} shrink-0`}>
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="mb-24 landing-fade-in landing-fade-in-delay-7">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              How it works
            </h2>
            <p className="text-gray-500 dark:text-gray-400">Get started in 3 simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 max-w-4xl mx-auto relative">
            {steps.map((step, index) => (
              <div key={step.num} className="relative text-center px-6">
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+2.5rem)] right-[calc(-50%+2.5rem)] h-[3px] rounded-full overflow-hidden bg-blue-100/50 dark:bg-blue-900/20">
                    <div className={`h-full step-line-${index + 1} rounded-full`} />
                  </div>
                )}

                <div
                  className={`step-circle-${index + 1} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white`}
                >
                  {step.num}
                </div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-24 landing-fade-in landing-fade-in-delay-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-6">
                Reimagining Property Maintenance with Fully Integrated, Agentic AI.
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
                From diagnosis to resolution—Allai handles every step of real estate maintenance management.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <Button
                  className="rounded-full px-6 h-12 bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold shadow-lg shadow-blue-500/25"
                  onClick={() => window.open("https://allai.chat", "_blank")}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat with Allai
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full px-6 h-12 border-blue-300 hover:border-blue-400 hover:bg-blue-50/50 font-semibold"
                  onClick={() => window.open("tel:+1234567890")}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call Now
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-64 h-64 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-500 flex flex-col items-center justify-center shadow-2xl shadow-blue-500/30">
                <span className="text-5xl mb-3">🏠</span>
                <span className="text-white font-bold text-lg text-center px-4">Smart Property<br />Management</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-24 landing-fade-in landing-fade-in-delay-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { icon: <Search className="h-8 w-8 text-white" />, title: "Triage", desc: "Prevent small issues from ballooning into disasters. Help tenants solve basic problems on their own.", bg: "from-sky-400 to-blue-500" },
              { icon: <Calendar className="h-8 w-8 text-white" />, title: "Schedule", desc: "Eliminate the tedious back-and-forth coordinating on-site repairs.", bg: "from-sky-400 to-blue-500" },
              { icon: <Smile className="h-8 w-8 text-white" />, title: "Relax", desc: "Reduced call volumes and faster resolutions lower your costs and retain satisfied tenants.", bg: "from-sky-400 to-blue-500" },
            ].map((item) => (
              <div key={item.title} className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center shadow-lg border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-shadow">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${item.bg} flex items-center justify-center mx-auto mb-5 shadow-lg`}>
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-24 landing-fade-in landing-fade-in-delay-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-100 mb-16">
            How It Works
          </h2>

          <div className="max-w-5xl mx-auto space-y-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">The tenant identifies an issue.</p>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Instead of contacting you, they interact with our AI-powered agent.</p>
                <p className="text-gray-600 dark:text-gray-400">The agent gathers information, troubleshoots, and escalates if necessary.</p>
              </div>
              <div className="flex justify-center">
                <div className="w-56 h-56 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-500 flex flex-col items-center justify-center shadow-2xl shadow-blue-500/30">
                  <span className="text-5xl mb-3">💬</span>
                  <span className="text-white font-bold text-center px-4">AI Chat Interface</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="flex justify-center md:order-first">
                <div className="w-56 h-56 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-500 flex flex-col items-center justify-center shadow-2xl shadow-blue-500/30">
                  <span className="text-5xl mb-3">⚙️</span>
                  <span className="text-white font-bold text-center px-4">AI Troubleshoots</span>
                </div>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">You're in control.</p>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Decide if an escalation comes to your team, or contacts the technician directly to communicate and schedule the on-site visit.</p>
                <p className="text-gray-600 dark:text-gray-400">The agent automatically follow-ups to be sure the work was done right.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Our AI-powered agent is a trained problem solver, fixing what's wrong and delivering confidence to your tenants and staff.</p>
                <p className="text-gray-600 dark:text-gray-400">Easily recall unit, technician, and tenant histories without sorting through tickets.</p>
              </div>
              <div className="flex justify-center">
                <div className="w-56 h-56 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-500 flex flex-col items-center justify-center shadow-2xl shadow-blue-500/30">
                  <span className="text-5xl mb-3">✅</span>
                  <span className="text-white font-bold text-center px-4">Auto Follow-up</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-24 landing-fade-in landing-fade-in-delay-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">About Us</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Our team blends innovation and expertise to disrupt property maintenance industry with fully integrated, agentic AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {[
              {
                name: "Ghassan Ghorayeb",
                role: "Co-Founder",
                photo: ghassan,
                bullets: [
                  "Retinal Surgeon & Chief of Division",
                  "Co-Founder of RBC, a multimillion-dollar commercial and medical real estate portfolio, driving development of advanced healthcare facilities",
                  "MIT MBA; Published innovator applying AI to healthcare and property technology solutions",
                ],
              },
              {
                name: "Nihal Bhujle",
                role: "Co-Founder",
                photo: nihal,
                bullets: [
                  "Led Digital Product Innovation at UBS and Gartner's CxO global advisory practice",
                  "Co-founder of RBC, a multi-million dollar commercial and residential real estate portfolio, delivering an annualized return of 16% over the last decade to investors",
                  "MIT MBA, BS Finance Wharton School, deep background in corporate finance advisory",
                ],
              },
              {
                name: "Omar Jacques Omran",
                role: "Co-Founder",
                photo: omar,
                bullets: [
                  "Led Technology for 3 large public companies (Six Flags, Welbilt, Middleby, : $3B–10B) generating $500M in net profit increase",
                  "Named 2024 Top Global Innovator",
                  "MIT MBA; 1st prize winner largest global hackathon",
                ],
              },
            ].map((person) => (
              <div key={person.name} className="text-center">
                <div className="w-32 h-32 rounded-full mx-auto mb-4 overflow-hidden border-4 border-gray-100 dark:border-gray-800 shadow-lg">
                  <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{person.name}</h3>
                <p className="text-sm text-blue-500 font-medium mb-4">{person.role}</p>
                <ul className="text-left text-xs text-gray-500 dark:text-gray-400 space-y-2">
                  {person.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 mt-1">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-20 landing-fade-in landing-fade-in-delay-8">
          <div
            className="relative rounded-3xl overflow-hidden p-10 md:p-16 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(59, 130, 246, 0.10) 50%, rgba(14, 165, 233, 0.06) 100%)",
              border: "1px solid rgba(59, 130, 246, 0.15)",
            }}
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-sky-300/15 blur-3xl" style={{ animation: "pulseGlow 4s ease-in-out infinite" }} />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-blue-300/15 blur-3xl" style={{ animation: "pulseGlow 5s ease-in-out infinite 1.5s" }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-cyan-200/10 blur-3xl" style={{ animation: "pulseGlow 6s ease-in-out infinite 3s" }} />
            </div>

            <div className="relative">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Sparkles className="h-6 w-6 text-sky-500" style={{ animation: "spin 8s linear infinite" }} />
                <Zap className="h-5 w-5 text-blue-500" />
                <Shield className="h-5 w-5 text-cyan-500" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                Stop Reacting to Problems.
              </h2>
              <p className="text-xl md:text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-10">
                Stay Ahead of Them Instead.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Button
                  className="rounded-full px-8 h-12 bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 transition-all duration-300"
                  onClick={() => window.open("https://allai.chat", "_blank")}
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Chat with Allai
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full px-8 h-12 border-blue-300 hover:border-blue-400 hover:bg-blue-50/50 font-semibold text-base transition-all duration-300"
                  onClick={() => window.open("tel:+1234567890")}
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call Now
                </Button>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-gray-100 dark:border-gray-800 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <Building2 className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">AllAI Property</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            &copy; {new Date().getFullYear()} AllAI Property. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <Link href="/login" className="hover:text-violet-500 transition-colors">Landlord Portal</Link>
            <span>&middot;</span>
            <Link href="/contractor-signup" className="hover:text-violet-500 transition-colors">Contractor Marketplace</Link>
            <span>&middot;</span>
            <Link href="/property-owner-signup" className="hover:text-violet-500 transition-colors">Homeowner Tools</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
