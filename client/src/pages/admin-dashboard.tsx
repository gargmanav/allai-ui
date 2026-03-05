import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, Users, Home, AlertTriangle, Wrench, Search, Activity,
  TrendingUp, ExternalLink, Clock, CheckCircle2, XCircle, Star, Eye, LogOut,
  LayoutDashboard, UserCog, Settings, Bell, ChevronRight, MoreHorizontal,
  UserCheck, UserX, ShieldCheck, Zap, ArrowUpDown, UserPlus, FolderOpen,
  Loader2, RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

// ─── Types ─────────────────────────────────────────────────────────────────

type PlatformStats = {
  orgCount: number; userCount: number; activeUserCount: number;
  contractorCount: number; propertyCount: number; openCaseCount: number;
};

type OrganizationDetail = {
  id: string; name: string; ownerName: string; ownerEmail: string; createdAt: string;
  _count: { properties: number; tenants: number; cases: number };
};

type UserDetail = {
  id: string; email: string; firstName: string | null; lastName: string | null;
  primaryRole: string; createdAt: string; lastLoginAt: string | null;
  daysSinceLogin: number | null;
  activityStatus: 'very_active' | 'active' | 'inactive' | 'dormant' | 'never_logged_in';
};

type ContractorDetail = {
  userId: string; email: string; firstName: string | null; lastName: string | null;
  phone: string | null; createdAt: string; profileId: string; bio: string | null;
  isAvailable: boolean; specialties: string[]; totalJobs: number; completedJobs: number;
  activeJobs: number; favoriteCount: number; daysSinceLogin: number | null;
  activityStatus: string; marketplaceActive: boolean;
};

type ActivityEvent = {
  id: string; type: 'user_signup' | 'org_created' | 'case_opened';
  title: string; subtitle: string; createdAt: string; priority?: string;
};

type ViewState = 'overview' | 'users' | 'organizations' | 'contractors' | 'activity';

// ─── Style constants ────────────────────────────────────────────────────────

const FROSTED = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.97) 0%, rgba(248,250,255,0.94) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.4)',
};

const SIDEBAR_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(246,244,255,0.98) 100%)',
  backdropFilter: 'blur(40px)',
  borderRight: '1px solid rgba(139,92,246,0.12)',
  boxShadow: '4px 0 24px rgba(139,92,246,0.06)',
};

// ─── Role & activity helpers ────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  platform_super_admin: { label: 'Super Admin', color: 'text-purple-700', bg: 'bg-purple-100' },
  org_admin:            { label: 'Landlord',    color: 'text-blue-700',   bg: 'bg-blue-100' },
  property_owner:       { label: 'Homeowner',   color: 'text-emerald-700',bg: 'bg-emerald-100' },
  contractor:           { label: 'Contractor',  color: 'text-orange-700', bg: 'bg-orange-100' },
  tenant:               { label: 'Tenant',      color: 'text-slate-700',  bg: 'bg-slate-100' },
};

const ACTIVITY_META: Record<string, { label: string; color: string; bg: string }> = {
  very_active:    { label: 'Very Active',     color: 'text-emerald-700', bg: 'bg-emerald-100' },
  active:         { label: 'Active',          color: 'text-blue-700',    bg: 'bg-blue-100' },
  inactive:       { label: 'Inactive',        color: 'text-amber-700',   bg: 'bg-amber-100' },
  dormant:        { label: 'Dormant',         color: 'text-red-700',     bg: 'bg-red-100' },
  never_logged_in:{ label: 'Never Logged In', color: 'text-slate-500',   bg: 'bg-slate-100' },
};

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] || { label: role, color: 'text-slate-600', bg: 'bg-slate-100' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.bg} ${m.color}`}>{m.label}</span>;
}

function ActivityBadge({ status }: { status: string }) {
  const m = ACTIVITY_META[status] || { label: status, color: 'text-slate-600', bg: 'bg-slate-100' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.bg} ${m.color}`}>{m.label}</span>;
}

function Avatar({ name, email, size = 'sm' }: { name?: string; email: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : email[0].toUpperCase();
  const sz = size === 'lg' ? 'w-10 h-10 text-sm' : size === 'md' ? 'w-8 h-8 text-xs' : 'w-7 h-7 text-xs';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center text-white font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, gradient }: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; gradient: string;
}) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={FROSTED}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
          <p className="text-3xl font-bold text-slate-800">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // View state
  const [currentView, setCurrentView] = useState<ViewState>('overview');

  // Search / filter state
  const [globalSearch, setGlobalSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userActivityFilter, setUserActivityFilter] = useState('all');
  const [userSort, setUserSort] = useState<'name' | 'role' | 'joined' | 'activity'>('joined');
  const [orgSearch, setOrgSearch] = useState('');
  const [orgSort, setOrgSort] = useState<'name' | 'properties' | 'tenants' | 'cases'>('cases');
  const [contractorSearch, setContractorSearch] = useState('');
  const [contractorMarketFilter, setContractorMarketFilter] = useState('all');
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');

  // Modal state
  const [roleModal, setRoleModal] = useState<{ user: UserDetail; newRole: string } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserDetail | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<UserDetail | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: 'Unauthorized', description: 'Please log in.', variant: 'destructive' });
      setTimeout(() => { window.location.href = '/api/login'; }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({ queryKey: ['/api/admin/stats'] });
  const { data: organizations = [], isLoading: orgsLoading } = useQuery<OrganizationDetail[]>({ queryKey: ['/api/admin/organizations'] });
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<UserDetail[]>({ queryKey: ['/api/admin/users'] });
  const { data: contractors = [], isLoading: contractorsLoading } = useQuery<ContractorDetail[]>({ queryKey: ['/api/admin/contractors'] });
  const { data: activityFeed = [], isLoading: activityLoading } = useQuery<ActivityEvent[]>({ queryKey: ['/api/admin/activity'] });
  const { data: impersonationStatus } = useQuery<{ isImpersonating: boolean; orgId?: string; orgName?: string }>({ queryKey: ['/api/admin/impersonation-status'] });

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const impersonateMutation = useMutation({
    mutationFn: (orgId: string) => apiRequest('POST', `/api/admin/impersonate/${orgId}`).then(r => r.json()),
    onSuccess: () => { window.location.href = '/dashboard'; },
    onError: () => toast({ title: 'Failed', description: 'Could not switch to org view', variant: 'destructive' }),
  });

  const stopImpersonationMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/stop-impersonation').then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/impersonation-status'] });
      toast({ title: 'Returned to Super Admin view' });
      setLocation('/admin-dashboard');
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiRequest('PATCH', `/api/admin/users/${userId}/role`, { role }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Role updated', description: 'The user role has been changed.' });
      setRoleModal(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to change role.', variant: 'destructive' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => apiRequest('PATCH', `/api/admin/users/${userId}/deactivate`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'User deactivated', description: 'Their sessions have been revoked.' });
      setDeactivateTarget(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to deactivate user.', variant: 'destructive' }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => apiRequest('PATCH', `/api/admin/users/${userId}/reactivate`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'User reactivated' });
      setReactivateTarget(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to reactivate user.', variant: 'destructive' }),
  });

  // ─── Computed ──────────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter(u => {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const matchSearch = !q || name.includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = userRoleFilter === 'all' || u.primaryRole === userRoleFilter;
      const matchActivity = userActivityFilter === 'all' || u.activityStatus === userActivityFilter;
      return matchSearch && matchRole && matchActivity;
    }).sort((a, b) => {
      if (userSort === 'name') return `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`);
      if (userSort === 'role') return a.primaryRole.localeCompare(b.primaryRole);
      if (userSort === 'activity') return (a.daysSinceLogin ?? 999999) - (b.daysSinceLogin ?? 999999);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [users, userSearch, userRoleFilter, userActivityFilter, userSort]);

  const filteredOrgs = useMemo(() => {
    const q = orgSearch.toLowerCase();
    return organizations.filter(o =>
      !q || o.name.toLowerCase().includes(q) || o.ownerEmail?.toLowerCase().includes(q)
    ).sort((a, b) => {
      if (orgSort === 'name') return a.name.localeCompare(b.name);
      if (orgSort === 'properties') return b._count.properties - a._count.properties;
      if (orgSort === 'tenants') return b._count.tenants - a._count.tenants;
      return b._count.cases - a._count.cases;
    });
  }, [organizations, orgSearch, orgSort]);

  const filteredContractors = useMemo(() => {
    const q = contractorSearch.toLowerCase();
    return contractors.filter(c => {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const matchSearch = !q || name.includes(q) || c.email.toLowerCase().includes(q);
      const matchMarket = contractorMarketFilter === 'all' ||
        (contractorMarketFilter === 'active' && c.marketplaceActive) ||
        (contractorMarketFilter === 'inactive' && !c.marketplaceActive);
      return matchSearch && matchMarket;
    });
  }, [contractors, contractorSearch, contractorMarketFilter]);

  const filteredActivity = useMemo(() => {
    if (activityTypeFilter === 'all') return activityFeed;
    return activityFeed.filter(e => e.type === activityTypeFilter);
  }, [activityFeed, activityTypeFilter]);

  const usersByRole = useMemo(() => {
    const map: Record<string, { total: number; active: number }> = {};
    users.forEach(u => {
      if (!map[u.primaryRole]) map[u.primaryRole] = { total: 0, active: 0 };
      map[u.primaryRole].total++;
      if (u.activityStatus === 'very_active' || u.activityStatus === 'active') map[u.primaryRole].active++;
    });
    return map;
  }, [users]);

  const dormantCount = users.filter(u => u.activityStatus === 'dormant' || u.activityStatus === 'never_logged_in').length;
  const neverLoggedInCount = users.filter(u => u.activityStatus === 'never_logged_in').length;

  const adminName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Admin';

  if (isLoading || !isAuthenticated) return null;

  // ─── Navigation items ───────────────────────────────────────────────────────
  const NAV = [
    { section: 'PLATFORM', items: [
      { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'activity', label: 'Activity Feed', icon: Activity },
    ]},
    { section: 'MANAGE', items: [
      { id: 'users', label: 'Users', icon: Users, count: users.length },
      { id: 'organizations', label: 'Organizations', icon: Building2, count: organizations.length },
      { id: 'contractors', label: 'Contractors', icon: Wrench, count: contractors.length },
    ]},
  ];

  const VIEW_TITLES: Record<ViewState, string> = {
    overview: 'Dashboard',
    activity: 'Activity Feed',
    users: 'Users',
    organizations: 'Organizations',
    contractors: 'Contractors',
  };

  // ─── Activity icon helper ───────────────────────────────────────────────────
  function ActivityIcon({ type }: { type: string }) {
    if (type === 'user_signup') return <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center"><UserPlus className="h-4 w-4 text-violet-600" /></div>;
    if (type === 'org_created') return <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Building2 className="h-4 w-4 text-blue-600" /></div>;
    return <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><Wrench className="h-4 w-4 text-orange-500" /></div>;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8f7ff 0%, #f0f4ff 50%, #f5f3ff 100%)' }}>

      {/* ── Sidebar ── */}
      <aside className="w-64 flex flex-col shrink-0 z-20" style={SIDEBAR_STYLE}>
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-violet-100/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">AllAI Property</p>
              <p className="text-[10px] font-semibold text-violet-500 tracking-wider uppercase">Super Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {NAV.map(section => (
            <div key={section.section}>
              <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase px-3 mb-1">{section.section}</p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const active = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id as ViewState)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'text-violet-700'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                      style={active ? {
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.06) 100%)',
                        boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.15)',
                      } : {}}
                    >
                      <item.icon className={`h-4 w-4 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {'count' in item && (item as any).count > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'}`}>
                          {(item as any).count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Admin profile */}
        <div className="px-4 py-4 border-t border-violet-100/60">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors group">
            <Avatar name={adminName} email={user?.email || ''} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{adminName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => { window.location.href = '/api/logout'; }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-400 hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Topbar ── */}
        <header className="h-14 flex items-center gap-4 px-6 shrink-0 border-b border-white/60 bg-white/70 backdrop-blur-xl z-10">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="text-slate-600 font-semibold">{VIEW_TITLES[currentView]}</span>
          </div>

          {/* Global search */}
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              placeholder="Search users, orgs..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-8 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300 text-slate-700 placeholder-slate-400"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-violet-700">Platform Admin</span>
            </div>
            <Avatar name={adminName} email={user?.email || ''} size="sm" />
          </div>
        </header>

        {/* ── Impersonation Banner ── */}
        {impersonationStatus?.isImpersonating && (
          <div className="flex items-center justify-between px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>Viewing as <strong>{impersonationStatus.orgName}</strong> — Navigate to any page to see their data</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => stopImpersonationMutation.mutate()}
              disabled={stopImpersonationMutation.isPending}
              className="h-7 text-xs border-white/40 text-white hover:bg-white/20 bg-transparent"
            >
              <LogOut className="h-3 w-3 mr-1" />
              Return to Admin
            </Button>
          </div>
        )}

        {/* ── Content ── */}
        <main className="flex-1 overflow-auto p-6">

          {/* ═══════════ OVERVIEW ═══════════ */}
          {currentView === 'overview' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* Greeting */}
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Welcome back, {user?.firstName || 'Admin'} 👋</h1>
                <p className="text-sm text-slate-500 mt-0.5">Here's what's happening across your platform today.</p>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard label="Organizations" value={statsLoading ? '—' : stats?.orgCount ?? 0} icon={Building2} gradient="from-blue-500 to-blue-600" />
                <StatCard label="Total Users" value={statsLoading ? '—' : stats?.userCount ?? 0} icon={Users} gradient="from-violet-500 to-purple-600" />
                <StatCard label="Active Users" value={statsLoading ? '—' : stats?.activeUserCount ?? 0} sub="Last 30 days" icon={Activity} gradient="from-emerald-500 to-teal-600" />
                <StatCard label="Contractors" value={statsLoading ? '—' : stats?.contractorCount ?? 0} sub={`${contractors.filter(c => c.marketplaceActive).length} active`} icon={Wrench} gradient="from-orange-500 to-amber-500" />
                <StatCard label="Properties" value={statsLoading ? '—' : stats?.propertyCount ?? 0} icon={Home} gradient="from-teal-500 to-cyan-600" />
                <StatCard label="Active Cases" value={statsLoading ? '—' : stats?.openCaseCount ?? 0} icon={AlertTriangle} gradient="from-rose-500 to-red-600" />
              </div>

              {/* Alerts strip */}
              {(dormantCount > 0 || neverLoggedInCount > 0) && (
                <div className="flex flex-wrap gap-3">
                  {neverLoggedInCount > 0 && (
                    <button
                      onClick={() => { setCurrentView('users'); setUserActivityFilter('never_logged_in'); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {neverLoggedInCount} user{neverLoggedInCount > 1 ? 's' : ''} never logged in
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {dormantCount > 0 && (
                    <button
                      onClick={() => { setCurrentView('users'); setUserActivityFilter('dormant'); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      {dormantCount} dormant user{dormantCount > 1 ? 's' : ''}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* User distribution */}
                <div className="lg:col-span-2 rounded-2xl p-5" style={FROSTED}>
                  <h2 className="text-sm font-bold text-slate-700 mb-4">User Distribution by Role</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(usersByRole).map(([role, data]) => {
                      const m = ROLE_META[role] || { label: role, color: 'text-slate-700', bg: 'bg-slate-100' };
                      const pct = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;
                      return (
                        <button
                          key={role}
                          onClick={() => { setCurrentView('users'); setUserRoleFilter(role); }}
                          className="text-left p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition-all group"
                        >
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.bg} ${m.color} mb-2`}>{m.label}</span>
                          <div className="flex items-end justify-between">
                            <span className="text-2xl font-bold text-slate-800">{data.total}</span>
                            <span className="text-xs text-slate-400">{pct}% active</span>
                          </div>
                          <div className="mt-2 h-1 rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-blue-400" style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recent activity mini feed */}
                <div className="rounded-2xl p-5" style={FROSTED}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-700">Recent Activity</h2>
                    <button onClick={() => setCurrentView('activity')} className="text-xs text-violet-500 hover:text-violet-700 font-medium transition-colors">View all →</button>
                  </div>
                  {activityLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-violet-400" /></div>
                  ) : (
                    <div className="space-y-3">
                      {activityFeed.slice(0, 6).map(event => (
                        <div key={`${event.id}-${event.type}`} className="flex items-start gap-3">
                          <ActivityIcon type={event.type} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{event.subtitle}</p>
                            <p className="text-[10px] text-slate-400">{event.title} · {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Top orgs quick list */}
              <div className="rounded-2xl p-5" style={FROSTED}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-700">Most Active Organizations</h2>
                  <button onClick={() => setCurrentView('organizations')} className="text-xs text-violet-500 hover:text-violet-700 font-medium transition-colors">Manage all →</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...organizations].sort((a, b) => b._count.cases - a._count.cases).slice(0, 6).map(org => (
                    <div key={org.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/20 transition-all">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                        {org.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{org.name}</p>
                        <p className="text-[10px] text-slate-400">{org._count.properties} props · {org._count.cases} cases</p>
                      </div>
                      <button
                        onClick={() => impersonateMutation.mutate(org.id)}
                        className="shrink-0 text-[10px] font-medium text-violet-600 hover:text-violet-800 transition-colors"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ USERS ═══════════ */}
          {currentView === 'users' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Users</h1>
                  <p className="text-sm text-slate-500">{filteredUsers.length} of {users.length} users</p>
                </div>
                <Button size="sm" onClick={() => refetchUsers()} variant="outline" className="gap-2 h-8 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>

              {/* Filters */}
              <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={FROSTED}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="pl-9 pr-3 h-8 w-56 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300"
                  />
                </div>
                <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} className="h-8 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300 text-slate-700">
                  <option value="all">All Roles</option>
                  {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={userActivityFilter} onChange={e => setUserActivityFilter(e.target.value)} className="h-8 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300 text-slate-700">
                  <option value="all">All Activity</option>
                  {Object.entries(ACTIVITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={userSort} onChange={e => setUserSort(e.target.value as any)} className="h-8 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300 text-slate-700">
                  <option value="joined">Sort: Newest</option>
                  <option value="name">Sort: Name</option>
                  <option value="role">Sort: Role</option>
                  <option value="activity">Sort: Activity</option>
                </select>
              </div>

              {/* Table */}
              <div className="rounded-2xl overflow-hidden" style={FROSTED}>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-100 bg-slate-50/60">
                          <TableHead className="text-xs font-semibold text-slate-500">User</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500">Role</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500">Activity</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500">Last Login</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500">Joined</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map(u => {
                          const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                          return (
                            <TableRow key={u.id} className="border-b border-slate-50 hover:bg-violet-50/20 transition-colors">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar name={name !== u.email ? name : undefined} email={u.email} size="sm" />
                                  <div>
                                    <p className="text-sm font-medium text-slate-700">{name}</p>
                                    <p className="text-xs text-slate-400">{u.email}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell><RoleBadge role={u.primaryRole} /></TableCell>
                              <TableCell><ActivityBadge status={u.activityStatus} /></TableCell>
                              <TableCell className="text-sm text-slate-500">
                                {u.daysSinceLogin === null ? 'Never' : u.daysSinceLogin === 0 ? 'Today' : `${u.daysSinceLogin}d ago`}
                              </TableCell>
                              <TableCell className="text-sm text-slate-500">{format(new Date(u.createdAt), 'MMM d, yyyy')}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => setRoleModal({ user: u, newRole: u.primaryRole })}>
                                      <UserCog className="h-4 w-4 mr-2 text-slate-500" /> Change Role
                                    </DropdownMenuItem>
                                    {u.primaryRole === 'org_admin' && (
                                      <DropdownMenuItem onClick={() => {
                                        const org = organizations.find(o => o.ownerEmail === u.email);
                                        if (org) impersonateMutation.mutate(org.id);
                                      }}>
                                        <Eye className="h-4 w-4 mr-2 text-slate-500" /> View as this Org
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-700"
                                      onClick={() => setDeactivateTarget(u)}
                                    >
                                      <UserX className="h-4 w-4 mr-2" /> Deactivate
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {filteredUsers.length === 0 && (
                      <div className="text-center py-12 text-slate-400 text-sm">No users match your filters</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ ORGANIZATIONS ═══════════ */}
          {currentView === 'organizations' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Organizations</h1>
                  <p className="text-sm text-slate-500">{filteredOrgs.length} of {organizations.length} orgs</p>
                </div>
              </div>

              {/* Filters */}
              <div className="rounded-2xl p-4 flex items-center gap-3" style={FROSTED}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    placeholder="Search organizations..."
                    value={orgSearch}
                    onChange={e => setOrgSearch(e.target.value)}
                    className="pl-9 pr-3 h-8 w-64 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300"
                  />
                </div>
                <select value={orgSort} onChange={e => setOrgSort(e.target.value as any)} className="h-8 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300 text-slate-700">
                  <option value="cases">Sort: Most Cases</option>
                  <option value="properties">Sort: Most Properties</option>
                  <option value="tenants">Sort: Most Tenants</option>
                  <option value="name">Sort: Name</option>
                </select>
              </div>

              {/* Org cards grid */}
              {orgsLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrgs.map(org => {
                    const isActive = org._count.cases > 0;
                    return (
                      <div key={org.id} className="rounded-2xl p-5 space-y-4 hover:shadow-md transition-shadow" style={FROSTED}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 shrink-0">
                              {org.name[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 leading-tight">{org.name}</p>
                              <p className="text-xs text-slate-400 truncate">{org.ownerEmail}</p>
                            </div>
                          </div>
                          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${isActive ? 'bg-emerald-400' : 'bg-slate-300'}`} title={isActive ? 'Active' : 'No recent activity'} />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Properties', value: org._count.properties, icon: Home },
                            { label: 'Tenants', value: org._count.tenants, icon: Users },
                            { label: 'Cases', value: org._count.cases, icon: Wrench },
                          ].map(m => (
                            <div key={m.label} className="text-center py-2 rounded-lg bg-slate-50">
                              <p className="text-lg font-bold text-slate-800">{m.value}</p>
                              <p className="text-[10px] text-slate-400">{m.label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <p className="text-[10px] text-slate-400">Created {format(new Date(org.createdAt), 'MMM yyyy')}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => impersonateMutation.mutate(org.id)}
                            disabled={impersonateMutation.isPending}
                            className="h-7 text-xs gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
                          >
                            <Eye className="h-3 w-3" /> View Screens
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredOrgs.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No organizations found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════ CONTRACTORS ═══════════ */}
          {currentView === 'contractors' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-slate-800">Contractor Marketplace</h1>
                <p className="text-sm text-slate-500">{filteredContractors.length} of {contractors.length} contractors</p>
              </div>

              <div className="rounded-2xl p-4 flex items-center gap-3" style={FROSTED}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    placeholder="Search contractors..."
                    value={contractorSearch}
                    onChange={e => setContractorSearch(e.target.value)}
                    className="pl-9 pr-3 h-8 w-56 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300"
                  />
                </div>
                <select value={contractorMarketFilter} onChange={e => setContractorMarketFilter(e.target.value)} className="h-8 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300 text-slate-700">
                  <option value="all">All Status</option>
                  <option value="active">Marketplace Active</option>
                  <option value="inactive">Marketplace Inactive</option>
                </select>
              </div>

              {contractorsLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredContractors.map(c => {
                    const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;
                    return (
                      <div key={c.userId} className="rounded-2xl p-5 space-y-3 hover:shadow-md transition-shadow" style={FROSTED}>
                        <div className="flex items-start gap-3">
                          <Avatar name={name !== c.email ? name : undefined} email={c.email} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
                            <p className="text-xs text-slate-400 truncate">{c.email}</p>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.marketplaceActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {c.marketplaceActive ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                            {c.marketplaceActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {c.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {c.specialties.slice(0, 3).map((s, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-100">{s}</span>
                            ))}
                            {c.specialties.length > 3 && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-500">+{c.specialties.length - 3}</span>}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="text-center py-1.5 rounded-lg bg-slate-50">
                            <p className="text-sm font-bold text-slate-800">{c.totalJobs}</p>
                            <p className="text-[10px] text-slate-400">Total</p>
                          </div>
                          <div className="text-center py-1.5 rounded-lg bg-slate-50">
                            <p className="text-sm font-bold text-slate-800">{c.activeJobs}</p>
                            <p className="text-[10px] text-slate-400">Active</p>
                          </div>
                          <div className="text-center py-1.5 rounded-lg bg-slate-50">
                            <div className="flex items-center justify-center gap-0.5">
                              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                              <p className="text-sm font-bold text-slate-800">{c.favoriteCount}</p>
                            </div>
                            <p className="text-[10px] text-slate-400">Favorited</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <ActivityBadge status={c.activityStatus} />
                          <p className="text-[10px] text-slate-400">
                            {c.daysSinceLogin === null ? 'Never logged in' : c.daysSinceLogin === 0 ? 'Active today' : `${c.daysSinceLogin}d ago`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {filteredContractors.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No contractors found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════ ACTIVITY ═══════════ */}
          {currentView === 'activity' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Activity Feed</h1>
                  <p className="text-sm text-slate-500">Recent platform events</p>
                </div>
                <div className="flex items-center gap-2">
                  {(['all', 'user_signup', 'org_created', 'case_opened'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setActivityTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activityTypeFilter === t
                          ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-500 hover:border-violet-200 hover:text-violet-600'
                      }`}
                    >
                      {t === 'all' ? 'All' : t === 'user_signup' ? 'Signups' : t === 'org_created' ? 'Orgs' : 'Cases'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl divide-y divide-slate-50" style={FROSTED}>
                {activityLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
                ) : filteredActivity.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No activity to show</div>
                ) : (
                  filteredActivity.map((event, i) => (
                    <div key={`${event.id}-${event.type}-${i}`} className="flex items-start gap-4 px-5 py-4 hover:bg-violet-50/20 transition-colors">
                      <ActivityIcon type={event.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700">{event.subtitle}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{event.title}</p>
                        {event.priority && (
                          <span className={`mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            event.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                            event.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>{event.priority}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 shrink-0 mt-0.5">{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ═══════════ ROLE CHANGE MODAL ═══════════ */}
      <Dialog open={!!roleModal} onOpenChange={() => setRoleModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the platform role for <strong>{roleModal?.user.email}</strong>. This affects what dashboards and features they can access.
            </DialogDescription>
          </DialogHeader>
          {roleModal && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <Avatar name={`${roleModal.user.firstName || ''} ${roleModal.user.lastName || ''}`.trim()} email={roleModal.user.email} size="md" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{`${roleModal.user.firstName || ''} ${roleModal.user.lastName || ''}`.trim() || roleModal.user.email}</p>
                  <p className="text-xs text-slate-400">{roleModal.user.email}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">New Role</label>
                <Select
                  value={roleModal.newRole}
                  onValueChange={v => setRoleModal({ ...roleModal, newRole: v })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setRoleModal(null)}>Cancel</Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 text-white"
                  onClick={() => changeRoleMutation.mutate({ userId: roleModal.user.id, role: roleModal.newRole })}
                  disabled={changeRoleMutation.isPending || roleModal.newRole === roleModal.user.primaryRole}
                >
                  {changeRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Role'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════ DEACTIVATE CONFIRM ═══════════ */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke all active sessions for <strong>{deactivateTarget?.email}</strong> and disable their org membership. They won't be able to log in until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
            >
              {deactivateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
