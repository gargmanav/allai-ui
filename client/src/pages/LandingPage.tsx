import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Building2, Wrench, Home, Users, ArrowRight, MessageCircle, Phone, Search, CalendarDays, SmilePlus, MessageSquare, Settings, CheckCircle2, Menu, X } from 'lucide-react';
import { useState } from 'react';

function FounderPhoto({ photo, initials, name }: { photo: string; initials: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="w-36 h-36 rounded-full mx-auto mb-5 overflow-hidden border-4 border-gray-100 shadow-md bg-gradient-to-br from-[#4A9FE5] to-[#2563EB]">
      {!failed ? (
        <img
          src={photo}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
          {initials}
        </div>
      )}
    </div>
  );
}

const roles = [
  {
    title: "Home Owner",
    description: "Maintain your home without the hassle",
    icon: Home,
    badge: "Popular",
    signupLink: "/property-owner-signup",
    loginLink: "/login",
    features: ["Track maintenance & repairs", "Find trusted contractors", "Manage multiple properties"],
    iconBg: "bg-gradient-to-br from-[#4A9FE5] to-[#2563EB]",
    badgeBg: "bg-blue-100 text-blue-700",
    btnClass: "bg-gradient-to-r from-[#4A9FE5] to-[#2563EB] hover:from-[#3B8FD5] hover:to-[#1D4FCC] text-white shadow-lg shadow-blue-500/25",
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
    iconBg: "bg-gradient-to-br from-[#4A9FE5] to-[#2563EB]",
    btnClass: "bg-gradient-to-r from-[#4A9FE5] to-[#2563EB] hover:from-[#3B8FD5] hover:to-[#1D4FCC] text-white shadow-lg shadow-blue-500/25",
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
    iconBg: "bg-gradient-to-br from-[#4A9FE5] to-[#2563EB]",
    btnClass: "bg-gradient-to-r from-[#4A9FE5] to-[#2563EB] hover:from-[#3B8FD5] hover:to-[#1D4FCC] text-white shadow-lg shadow-blue-500/25",
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
    iconBg: "bg-gradient-to-br from-[#4A9FE5] to-[#2563EB]",
    btnClass: "bg-gradient-to-r from-[#4A9FE5] to-[#2563EB] hover:from-[#3B8FD5] hover:to-[#1D4FCC] text-white shadow-lg shadow-blue-500/25",
    testIdSignup: "button-contractor-signup",
    testIdLogin: "button-contractor-login",
  },
];

const howItWorksSteps = [
  {
    title: "AI Chat Interface",
    icon: MessageSquare,
    textSide: "left" as const,
    heading: "The tenant identifies an issue.",
    paragraphs: [
      "Instead of contacting you, they interact with our AI-powered agent.",
      "The agent gathers information, troubleshoots, and escalates if necessary.",
    ],
  },
  {
    title: "AI Troubleshoots",
    icon: Settings,
    textSide: "right" as const,
    heading: "You're in control.",
    paragraphs: [
      "Decide if an escalation comes to your team, or contacts the technician directly to communicate and schedule the on-site visit.",
      "The agent automatically follows up to be sure the work was done right.",
    ],
  },
  {
    title: "Auto Follow-up",
    icon: CheckCircle2,
    textSide: "left" as const,
    heading: "Our AI-powered agent is a trained problem solver,",
    paragraphs: [
      "fixing what's wrong and delivering confidence to your tenants and staff.",
      "Easily recall unit, technician, and tenant histories without sorting through tickets.",
    ],
  },
];

const founders = [
  {
    name: "Ghassan Ghorayeb",
    role: "Co-Founder",
    initials: "GG",
    photo: "https://allai-v3-frontend.onrender.com/_next/image?url=%2Fghassan-profile.jpg&w=384&q=75",
    bullets: [
      "Retinal Surgeon & Chief of Division",
      "Co-Founder of RBC, a multimillion-dollar commercial and medical real estate portfolio, driving development of advanced healthcare facilities",
      "MIT MBA; Published innovator applying AI to healthcare and property technology solutions",
    ],
  },
  {
    name: "Nihal Bhujle",
    role: "Co-Founder",
    initials: "NB",
    photo: "https://allai-v3-frontend.onrender.com/_next/image?url=%2Fnihal-profile.jpg&w=384&q=75",
    bullets: [
      "Led Digital Product Innovation at UBS and Gartner's CxO global advisory practice",
      "Co-founder of RBC, a multi-million dollar commercial and residential real estate portfolio, delivering an annualized return of 16% over the last decade to investors",
      "MIT MBA, BS Finance Wharton School, deep background in corporate finance advisory",
    ],
  },
  {
    name: "Omar Jacques Omran",
    role: "Co-Founder",
    initials: "OO",
    photo: "https://allai-v3-frontend.onrender.com/_next/image?url=%2Fomar-profile.jpg&w=384&q=75",
    bullets: [
      "Led Technology for 3 large public companies (Six Flags, Welbilt, Middleby, : $3B\u201310B) generating $500M in net profit increase",
      "Named 2024 Top Global Innovator",
      "MIT MBA; 1st prize winner largest global hackathon",
    ],
  },
];

function AllaiLogo({ size = "default" }: { size?: "default" | "small" }) {
  const textClass = size === "small" ? "text-lg" : "text-2xl";
  const iconSize = size === "small" ? 24 : 32;
  return (
    <div className="flex items-center gap-2">
      <svg width={iconSize} height={iconSize} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke="#2563EB" strokeWidth="2.5" fill="none" />
        <circle cx="20" cy="20" r="6" fill="#2563EB" />
        <path d="M20 2 C20 2 32 10 32 20 C32 30 20 38 20 38" stroke="#4A9FE5" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`${textClass} font-bold tracking-tight`}>
        <span className="text-gray-900">all</span>
        <span className="text-[#2563EB]">ai</span>
      </span>
    </div>
  );
}

function BlueGradientCard({ title, icon: Icon, className = "" }: { title: string; icon: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div className={`relative w-[280px] h-[220px] rounded-2xl overflow-hidden shadow-xl ${className}`} style={{
      background: "linear-gradient(135deg, #7DD3FC 0%, #4A9FE5 30%, #2563EB 70%, #3B82F6 100%)",
    }}>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)",
      }} />
      <div className="flex flex-col items-center justify-center h-full relative">
        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 shadow-lg">
          <Icon className="h-8 w-8 text-white" />
        </div>
        <span className="text-white font-bold text-lg text-center px-4">{title}</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-white/0 via-white/40 to-white/0" />
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-50 bg-[#F8FAFC]/90 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <AllaiLogo />
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-[#2563EB] transition-colors">How It Works</a>
            <a href="#platform" className="text-sm font-medium text-gray-600 hover:text-[#2563EB] transition-colors">Platform</a>
            <a href="#about" className="text-sm font-medium text-gray-600 hover:text-[#2563EB] transition-colors">About Us</a>
            <Link href="/login">
              <Button variant="outline" className="rounded-full px-6 border-[#2563EB]/30 text-[#2563EB] hover:bg-[#2563EB]/5 hover:border-[#2563EB]/50">
                Sign In
              </Button>
            </Link>
          </nav>
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
            <a href="#how-it-works" className="block text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#platform" className="block text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>Platform</a>
            <a href="#about" className="block text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>About Us</a>
            <Link href="/login">
              <Button variant="outline" className="w-full rounded-full border-[#2563EB]/30 text-[#2563EB]">Sign In</Button>
            </Link>
          </div>
        )}
      </header>

      <section className="container mx-auto px-6 py-16 md:py-24">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
          <div className="flex-1 max-w-xl">
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-tight text-gray-900 mb-6 tracking-tight">
              Reimagining Property Maintenance with Fully Integrated, Agentic AI.
            </h1>
            <p className="text-lg text-gray-500 mb-8 leading-relaxed">
              From diagnosis to resolution—Allai handles every step of real estate maintenance management.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/property-owner-signup">
                <Button className="rounded-full px-7 h-12 bg-[#1E293B] hover:bg-[#0F172A] text-white text-sm font-medium shadow-md">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat with Allai
                </Button>
              </Link>
              <Button variant="outline" className="rounded-full px-7 h-12 border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium">
                <Phone className="h-4 w-4 mr-2" />
                Call Now
              </Button>
            </div>
          </div>
          <div className="flex-shrink-0">
            <BlueGradientCard title="Smart Property Management" icon={Home} />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { icon: Search, title: "Triage", desc: "Prevent small issues from ballooning into disasters. Help tenants solve basic problems on their own." },
            { icon: CalendarDays, title: "Schedule", desc: "Eliminate the tedious back-and-forth coordinating on-site repairs." },
            { icon: SmilePlus, title: "Relax", desc: "Reduced call volumes and faster resolutions lower your costs and retain satisfied tenants." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="w-14 h-14 rounded-full bg-[#EFF6FF] flex items-center justify-center mx-auto mb-5">
                  <Icon className="h-6 w-6 text-[#2563EB]" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="how-it-works" className="container mx-auto px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-20">How It Works</h2>

        <div className="max-w-5xl mx-auto space-y-24">
          {howItWorksSteps.map((step, idx) => {
            const textBlock = (
              <div className="flex-1 space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">{step.heading}</h3>
                {step.paragraphs.map((p, i) => (
                  <p key={i} className="text-gray-500 leading-relaxed">{p}</p>
                ))}
              </div>
            );
            const cardBlock = (
              <div className="flex-shrink-0 flex justify-center">
                <BlueGradientCard title={step.title} icon={step.icon} />
              </div>
            );

            return (
              <div key={idx} className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
                {step.textSide === "left" ? (
                  <>{textBlock}{cardBlock}</>
                ) : (
                  <>{cardBlock}{textBlock}</>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section id="platform" className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Our Platform</h2>
          <p className="text-gray-500">Choose your role and get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.title}
                className="group relative bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="h-1 bg-gradient-to-r from-[#4A9FE5] to-[#2563EB]" />

                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-14 h-14 rounded-xl ${role.iconBg} flex items-center justify-center shadow-lg`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    {role.badge && (
                      <span className={`${role.badgeBg} text-[11px] font-semibold px-2.5 py-1 rounded-full`}>
                        {role.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-1">{role.title}</h3>
                  <p className="text-sm text-gray-500 mb-5">{role.description}</p>

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
                        className="w-full rounded-xl h-10 text-gray-600 hover:text-gray-900 transition-colors"
                        data-testid={role.testIdLogin}
                      >
                        Login
                      </Button>
                    </Link>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-2">
                    {role.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
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
        </div>
      </section>

      <section id="about" className="container mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">About Us</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Our team blends innovation and expertise to disrupt property maintenance industry with fully integrated, agentic AI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto">
          {founders.map((founder) => (
            <div key={founder.name} className="text-center">
              <FounderPhoto photo={founder.photo} initials={founder.initials} name={founder.name} />
              <h3 className="text-lg font-bold text-gray-900">{founder.name}</h3>
              <p className="text-[#2563EB] font-medium text-sm mb-4">{founder.role}</p>
              <ul className="text-left text-sm text-gray-500 space-y-2">
                {founder.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Stop Reacting to Problems.</h2>
          <h3 className="text-xl md:text-2xl font-semibold text-gray-700 mb-10">Stay Ahead of Them Instead.</h3>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/property-owner-signup">
              <Button className="rounded-full px-7 h-12 bg-[#1E293B] hover:bg-[#0F172A] text-white text-sm font-medium shadow-md">
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat with Allai
              </Button>
            </Link>
            <Button variant="outline" className="rounded-full px-7 h-12 border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium">
              <Phone className="h-4 w-4 mr-2" />
              Call Now
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-10">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <AllaiLogo size="small" />
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} AllAI Property. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <Link href="/login" className="hover:text-[#2563EB] transition-colors">Landlord Portal</Link>
              <span>&middot;</span>
              <Link href="/contractor-signup" className="hover:text-[#2563EB] transition-colors">Contractor Marketplace</Link>
              <span>&middot;</span>
              <Link href="/property-owner-signup" className="hover:text-[#2563EB] transition-colors">Homeowner Tools</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
