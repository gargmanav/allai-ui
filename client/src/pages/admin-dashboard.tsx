import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Building2, Users, Home, AlertTriangle, Wrench, Search, Activity,
  Eye, LogOut, LayoutDashboard, UserCog, ChevronRight, MoreHorizontal,
  UserX, ShieldCheck, Star, CheckCircle2, XCircle, Loader2, RefreshCw,
  UserPlus, LayoutGrid, List, MapPin, Map as MapIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

// ─── Types ──────────────────────────────────────────────────────────────────

type PlatformStats = { orgCount: number; userCount: number; activeUserCount: number; contractorCount: number; propertyCount: number; openCaseCount: number };
type OrganizationDetail = { id: string; name: string; ownerName: string; ownerEmail: string; createdAt: string; _count: { properties: number; tenants: number; cases: number } };
type UserDetail = { id: string; email: string; firstName: string | null; lastName: string | null; primaryRole: string | null; createdAt: string; daysSinceLogin: number | null; activityStatus: 'very_active' | 'active' | 'inactive' | 'dormant' | 'never_logged_in' };
type ContractorDetail = { userId: string; email: string; firstName: string | null; lastName: string | null; phone: string | null; createdAt: string; profileId: string; bio: string | null; isAvailable: boolean; specialties: string[]; totalJobs: number; completedJobs: number; activeJobs: number; favoriteCount: number; daysSinceLogin: number | null; activityStatus: string; marketplaceActive: boolean };
type PropertyRow = { id: string; name: string; type: string; street: string; city: string; state: string; zipCode: string; orgId: string; orgName: string | null; createdAt: string; openCases: number };
type CaseRow = { id: string; title: string; status: string; priority: string; category: string | null; orgId: string; orgName: string | null; propertyId: string | null; createdAt: string };
type ActivityEvent = { id: string; type: 'user_signup' | 'org_created' | 'case_opened'; title: string; subtitle: string; createdAt: string; priority?: string };

type ViewState = 'overview' | 'users' | 'organizations' | 'contractors' | 'properties' | 'cases' | 'activity';
type ViewMode = 'grid' | 'list' | 'map';

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = { background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)', borderRadius: '16px' };
const CARD_LIFT: React.CSSProperties = { ...CARD, boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)', transform: 'translateY(-2px)' };

// ─── Role / activity meta ────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  platform_super_admin: { label: 'Super Admin', color: '#6d28d9', bg: '#ede9fe' },
  org_admin:            { label: 'Landlord',    color: '#1d4ed8', bg: '#dbeafe' },
  property_owner:       { label: 'Homeowner',   color: '#065f46', bg: '#d1fae5' },
  contractor:           { label: 'Contractor',  color: '#92400e', bg: '#fef3c7' },
  tenant:               { label: 'Tenant',      color: '#374151', bg: '#f3f4f6' },
  unassigned:           { label: 'No Role',     color: '#6b7280', bg: '#f3f4f6' },
};

const ACTIVITY_META: Record<string, { label: string; color: string; bg: string }> = {
  very_active:    { label: 'Very Active',     color: '#065f46', bg: '#d1fae5' },
  active:         { label: 'Active',          color: '#1d4ed8', bg: '#dbeafe' },
  inactive:       { label: 'Inactive',        color: '#92400e', bg: '#fef3c7' },
  dormant:        { label: 'Dormant',         color: '#991b1b', bg: '#fee2e2' },
  never_logged_in:{ label: 'Never Logged In', color: '#6b7280', bg: '#f3f4f6' },
};

const STATUS_META: Record<string, { color: string; bg: string }> = {
  New:         { color: '#1d4ed8', bg: '#dbeafe' },
  'In Progress':{ color: '#92400e', bg: '#fef3c7' },
  'On Hold':   { color: '#6b7280', bg: '#f3f4f6' },
  Pending:     { color: '#92400e', bg: '#fef3c7' },
  Resolved:    { color: '#065f46', bg: '#d1fae5' },
  Closed:      { color: '#6b7280', bg: '#f3f4f6' },
};

const PRIORITY_META: Record<string, { color: string; bg: string }> = {
  Urgent: { color: '#991b1b', bg: '#fee2e2' },
  High:   { color: '#92400e', bg: '#fef3c7' },
  Normal: { color: '#374151', bg: '#f3f4f6' },
  Low:    { color: '#6b7280', bg: '#f3f4f6' },
};

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ color, background: bg }} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium">{label}</span>;
}
function RoleBadge({ role }: { role: string | null }) {
  const m = ROLE_META[role || 'unassigned'] || { label: role || 'Unknown', color: '#6b7280', bg: '#f3f4f6' };
  return <Badge label={m.label} color={m.color} bg={m.bg} />;
}
function ActivityBadge({ status }: { status: string }) {
  const m = ACTIVITY_META[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return <Badge label={m.label} color={m.color} bg={m.bg} />;
}
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { color: '#6b7280', bg: '#f3f4f6' };
  return <Badge label={status} color={m.color} bg={m.bg} />;
}
function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] || { color: '#6b7280', bg: '#f3f4f6' };
  return <Badge label={priority} color={m.color} bg={m.bg} />;
}

function Avatar({ name, email, size = 'sm' }: { name?: string; email: string; size?: 'sm' | 'md' }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : email[0].toUpperCase();
  const sz = size === 'md' ? 'w-8 h-8 text-xs' : 'w-7 h-7 text-xs';
  return <div className={`${sz} rounded-full flex items-center justify-center text-white font-semibold shrink-0`} style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>{initials}</div>;
}

// ─── Stat card — uniform style, active state = violet left border ──────────────

function StatCard({ label, value, sub, icon: Icon, activeView, currentView, onClick }: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; activeView?: ViewState; currentView?: ViewState; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  const isActive = activeView && currentView === activeView;
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => clickable && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: isActive ? '#faf5ff' : '#ffffff',
        boxShadow: hov ? '0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)' : '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        borderRadius: '16px',
        borderLeft: isActive ? '3px solid #7c3aed' : '3px solid transparent',
        transform: hov ? 'translateY(-2px)' : undefined,
        transition: 'all 0.18s ease',
      }}
      className={`p-5 select-none ${clickable ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
          <p className="text-3xl font-bold text-slate-800">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isActive ? '#ede9fe' : '#f1f5f9' }}>
          <Icon className="h-5 w-5" style={{ color: isActive ? '#7c3aed' : '#94a3b8' }} />
        </div>
      </div>
    </div>
  );
}

// ─── View mode toggle ─────────────────────────────────────────────────────────

function ViewToggle({ mode, setMode, showMap = true }: { mode: ViewMode; setMode: (m: ViewMode) => void; showMap?: boolean }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#f1f5f9' }}>
      {[
        { id: 'grid', icon: LayoutGrid, label: 'Grid' },
        { id: 'list', icon: List, label: 'List' },
        ...(showMap ? [{ id: 'map', icon: MapIcon, label: 'Map' }] : []),
      ].map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => setMode(id as ViewMode)} title={label}
          className="p-1.5 rounded-md transition-all"
          style={mode === id ? { background: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#6d28d9' } : { color: '#94a3b8' }}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

// ─── Map placeholder ──────────────────────────────────────────────────────────

function MapPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-2xl" style={CARD}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#ede9fe' }}>
        <MapIcon className="h-8 w-8" style={{ color: '#7c3aed' }} />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">Map View</h3>
      <p className="text-sm text-slate-400">{label} map visualization coming soon</p>
    </div>
  );
}

// ─── Hoverable card wrapper ───────────────────────────────────────────────────

function HoverCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ ...(hov ? CARD_LIFT : CARD), transition: 'all 0.18s ease' }} className={className}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {children}
    </div>
  );
}

// ─── Activity icon ────────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  if (type === 'user_signup') return <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0"><UserPlus className="h-4 w-4 text-violet-500" /></div>;
  if (type === 'org_created') return <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-blue-500" /></div>;
  return <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0"><Wrench className="h-4 w-4 text-orange-400" /></div>;
}

// ─── Shared filter bar ────────────────────────────────────────────────────────

const INP_CLS = "text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300";
const INP_STYLE: React.CSSProperties = { background: '#f8f9fa', border: '1px solid #e5e7eb' };

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const [currentView, setCurrentView] = useState<ViewState>('overview');

  // Per-view modes
  const [usersMode,   setUsersMode]   = useState<ViewMode>('list');
  const [orgsMode,    setOrgsMode]    = useState<ViewMode>('grid');
  const [contractorsMode, setContractorsMode] = useState<ViewMode>('grid');
  const [propsMode,   setPropsMode]   = useState<ViewMode>('grid');
  const [casesMode,   setCasesMode]   = useState<ViewMode>('list');

  // Search / filter
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [userSearch,    setUserSearch]    = useState('');
  const [userRoleFilter,setUserRoleFilter]= useState('all');
  const [userActivityFilter, setUserActivityFilter] = useState('all');
  const [userSort,      setUserSort]      = useState<'name'|'role'|'joined'|'activity'>('joined');
  const [orgSearch,     setOrgSearch]     = useState('');
  const [orgSort,       setOrgSort]       = useState<'name'|'properties'|'tenants'|'cases'>('cases');
  const [contractorSearch, setContractorSearch] = useState('');
  const [contractorMarketFilter, setContractorMarketFilter] = useState('all');
  const [propSearch,    setPropSearch]    = useState('');
  const [caseSearch,    setCaseSearch]    = useState('');
  const [casePriorityFilter, setCasePriorityFilter] = useState('all');
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');

  // Modals
  const [roleModal, setRoleModal] = useState<{ user: UserDetail; newRole: string } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserDetail | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setTimeout(() => { window.location.href = '/api/login'; }, 500);
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({ queryKey: ['/api/admin/stats'] });
  const { data: organizations = [], isLoading: orgsLoading }  = useQuery<OrganizationDetail[]>({ queryKey: ['/api/admin/organizations'] });
  const { data: allUsers = [],      isLoading: usersLoading, refetch: refetchUsers } = useQuery<UserDetail[]>({ queryKey: ['/api/admin/users'] });
  const { data: contractors = [],   isLoading: contractorsLoading } = useQuery<ContractorDetail[]>({ queryKey: ['/api/admin/contractors'] });
  const { data: allProperties = [], isLoading: propsLoading } = useQuery<PropertyRow[]>({ queryKey: ['/api/admin/properties'] });
  const { data: allCases = [],      isLoading: casesLoading } = useQuery<CaseRow[]>({ queryKey: ['/api/admin/cases'] });
  const { data: activityFeed = [],  isLoading: activityLoading } = useQuery<ActivityEvent[]>({ queryKey: ['/api/admin/activity'] });
  const { data: impersonationStatus } = useQuery<{ isImpersonating: boolean; orgId?: string; orgName?: string }>({ queryKey: ['/api/admin/impersonation-status'] });

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const impersonateMutation = useMutation({
    mutationFn: (orgId: string) => apiRequest('POST', `/api/admin/impersonate/${orgId}`).then(r => r.json()),
    onSuccess: () => { window.location.href = '/dashboard'; },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });
  const stopImpersonationMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/stop-impersonation').then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/impersonation-status'] }); toast({ title: 'Returned to Super Admin view' }); },
  });
  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiRequest('PATCH', `/api/admin/users/${userId}/role`, { role }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] }); toast({ title: 'Role updated' }); setRoleModal(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to change role.', variant: 'destructive' }),
  });
  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => apiRequest('PATCH', `/api/admin/users/${userId}/deactivate`).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] }); toast({ title: 'User deactivated' }); setDeactivateTarget(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to deactivate.', variant: 'destructive' }),
  });

  // ─── Derived ────────────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return allUsers.filter(u => {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const matchSearch = !q || name.includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = userRoleFilter === 'all' ? true : userRoleFilter === 'unassigned' ? !u.primaryRole : u.primaryRole === userRoleFilter;
      const matchActivity = userActivityFilter === 'all' || u.activityStatus === userActivityFilter;
      return matchSearch && matchRole && matchActivity;
    }).sort((a, b) => {
      if (userSort === 'name') return `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`);
      if (userSort === 'role') return (a.primaryRole || '').localeCompare(b.primaryRole || '');
      if (userSort === 'activity') return (a.daysSinceLogin ?? 999999) - (b.daysSinceLogin ?? 999999);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [allUsers, userSearch, userRoleFilter, userActivityFilter, userSort]);

  const filteredOrgs = useMemo(() => {
    const q = orgSearch.toLowerCase();
    return organizations
      .filter(o => !q || o.name.toLowerCase().includes(q) || (o.ownerEmail || '').toLowerCase().includes(q))
      .sort((a, b) => {
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
      const matchMarket = contractorMarketFilter === 'all' || (contractorMarketFilter === 'active' && c.marketplaceActive) || (contractorMarketFilter === 'inactive' && !c.marketplaceActive);
      return matchSearch && matchMarket;
    });
  }, [contractors, contractorSearch, contractorMarketFilter]);

  const filteredProperties = useMemo(() => {
    const q = propSearch.toLowerCase();
    return allProperties.filter(p => !q || p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || (p.orgName || '').toLowerCase().includes(q));
  }, [allProperties, propSearch]);

  const filteredCases = useMemo(() => {
    const q = caseSearch.toLowerCase();
    return allCases.filter(c => {
      const matchSearch = !q || c.title.toLowerCase().includes(q) || (c.orgName || '').toLowerCase().includes(q);
      const matchPriority = casePriorityFilter === 'all' || c.priority === casePriorityFilter;
      return matchSearch && matchPriority;
    });
  }, [allCases, caseSearch, casePriorityFilter]);

  const filteredActivity = useMemo(() =>
    activityTypeFilter === 'all' ? activityFeed : activityFeed.filter(e => e.type === activityTypeFilter),
  [activityFeed, activityTypeFilter]);

  const usersByRole = useMemo(() => {
    const map: Record<string, { total: number; active: number }> = {};
    allUsers.forEach(u => {
      const key = u.primaryRole || 'unassigned';
      if (!map[key]) map[key] = { total: 0, active: 0 };
      map[key].total++;
      if (u.activityStatus === 'very_active' || u.activityStatus === 'active') map[key].active++;
    });
    return map;
  }, [allUsers]);

  const dormantCount = allUsers.filter(u => u.activityStatus === 'dormant').length;
  const neverLoggedInCount = allUsers.filter(u => u.activityStatus === 'never_logged_in').length;
  const noRoleCount = allUsers.filter(u => !u.primaryRole).length;

  const searchResults = useMemo(() => {
    if (globalSearch.length < 2) return { users: [], orgs: [] };
    const q = globalSearch.toLowerCase();
    return {
      users: allUsers.filter(u => { const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase(); return name.includes(q) || u.email.toLowerCase().includes(q); }).slice(0, 5),
      orgs:  organizations.filter(o => o.name.toLowerCase().includes(q) || (o.ownerEmail || '').toLowerCase().includes(q)).slice(0, 5),
    };
  }, [globalSearch, allUsers, organizations]);

  const adminName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Admin';

  if (isLoading || !isAuthenticated) return null;

  // ─── Nav ────────────────────────────────────────────────────────────────────
  const NAV = [
    { section: 'PLATFORM', items: [
      { id: 'overview',   label: 'Dashboard',     icon: LayoutDashboard },
      { id: 'activity',   label: 'Activity Feed', icon: Activity },
    ]},
    { section: 'MANAGE', items: [
      { id: 'users',         label: 'Users',         icon: Users,     count: allUsers.length },
      { id: 'organizations', label: 'Organizations', icon: Building2, count: organizations.length },
      { id: 'contractors',   label: 'Contractors',   icon: Wrench,    count: contractors.length },
      { id: 'properties',   label: 'Properties',     icon: Home,      count: allProperties.length },
      { id: 'cases',         label: 'Active Cases',  icon: AlertTriangle, count: allCases.length },
    ]},
  ];

  const VIEW_TITLES: Record<ViewState, string> = {
    overview: 'Dashboard', activity: 'Activity Feed',
    users: 'Users', organizations: 'Organizations', contractors: 'Contractors',
    properties: 'Properties', cases: 'Active Cases',
  };

  function navTo(view: ViewState) { setCurrentView(view); }

  // ─── Shared filter row ────────────────────────────────────────────────────

  function FilterRow({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl" style={CARD}>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    );
  }

  function SearchInput({ value, onChange, placeholder, width = 'w-56' }: { value: string; onChange: (v: string) => void; placeholder: string; width?: string }) {
    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`pl-9 pr-3 h-8 ${width} ${INP_CLS}`} style={INP_STYLE} />
      </div>
    );
  }

  // ─── Org card ─────────────────────────────────────────────────────────────

  function OrgCardGrid({ org }: { org: OrganizationDetail }) {
    return (
      <HoverCard className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{org.name[0].toUpperCase()}</div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 leading-tight">{org.name}</p>
              <p className="text-xs text-slate-400 truncate">{org.ownerEmail}</p>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full shrink-0 mt-2 ${org._count.cases > 0 ? 'bg-emerald-400' : 'bg-slate-200'}`} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ label: 'Properties', value: org._count.properties }, { label: 'Tenants', value: org._count.tenants }, { label: 'Cases', value: org._count.cases }].map(m => (
            <div key={m.label} className="text-center py-2 rounded-lg" style={{ background: '#f8f9fa' }}>
              <p className="text-lg font-bold text-slate-800">{m.value}</p>
              <p className="text-[10px] text-slate-400">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid #f0f0f0' }}>
          <p className="text-[10px] text-slate-400">Created {format(new Date(org.createdAt), 'MMM yyyy')}</p>
          <button onClick={() => impersonateMutation.mutate(org.id)} disabled={impersonateMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ border: '1px solid #ddd6fe', color: '#6d28d9', background: '#faf5ff' }}>
            <Eye className="h-3 w-3" /> View Screens
          </button>
        </div>
      </HoverCard>
    );
  }

  function OrgTableRow({ org }: { org: OrganizationDetail }) {
    return (
      <TableRow className="hover:bg-violet-50/20 transition-colors" style={{ borderBottom: '1px solid #f5f5f5' }}>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{org.name[0].toUpperCase()}</div>
            <div><p className="text-sm font-medium text-slate-700">{org.name}</p><p className="text-xs text-slate-400">{org.ownerEmail}</p></div>
          </div>
        </TableCell>
        <TableCell className="text-sm text-slate-600">{org._count.properties}</TableCell>
        <TableCell className="text-sm text-slate-600">{org._count.tenants}</TableCell>
        <TableCell><span style={org._count.cases > 0 ? { color: '#1d4ed8', background: '#dbeafe' } : { color: '#6b7280', background: '#f3f4f6' }} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium">{org._count.cases}</span></TableCell>
        <TableCell className="text-sm text-slate-400">{format(new Date(org.createdAt), 'MMM d, yyyy')}</TableCell>
        <TableCell className="text-right">
          <button onClick={() => impersonateMutation.mutate(org.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ border: '1px solid #ddd6fe', color: '#6d28d9', background: '#faf5ff' }}>
            <Eye className="h-3 w-3" /> View
          </button>
        </TableCell>
      </TableRow>
    );
  }

  function ContractorCardGrid({ c }: { c: ContractorDetail }) {
    const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;
    return (
      <HoverCard className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar name={name !== c.email ? name : undefined} email={c.email} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
            <p className="text-xs text-slate-400 truncate">{c.email}</p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={c.marketplaceActive ? { background: '#d1fae5', color: '#065f46' } : { background: '#f3f4f6', color: '#6b7280' }}>
            {c.marketplaceActive ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
            {c.marketplaceActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        {c.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.specialties.slice(0, 3).map((s, i) => <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>{s}</span>)}
            {c.specialties.length > 3 && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: '#f3f4f6', color: '#6b7280' }}>+{c.specialties.length - 3}</span>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[{ label: 'Total', value: c.totalJobs }, { label: 'Active', value: c.activeJobs }].map(m => (
            <div key={m.label} className="text-center py-1.5 rounded-lg" style={{ background: '#f8f9fa' }}>
              <p className="text-sm font-bold text-slate-800">{m.value}</p>
              <p className="text-[10px] text-slate-400">{m.label}</p>
            </div>
          ))}
          <div className="text-center py-1.5 rounded-lg" style={{ background: '#f8f9fa' }}>
            <div className="flex items-center justify-center gap-0.5"><Star className="h-3 w-3 text-amber-400 fill-amber-400" /><p className="text-sm font-bold text-slate-800">{c.favoriteCount}</p></div>
            <p className="text-[10px] text-slate-400">Favorited</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid #f0f0f0' }}>
          <ActivityBadge status={c.activityStatus} />
          <p className="text-[10px] text-slate-400">{c.daysSinceLogin === null ? 'Never' : c.daysSinceLogin === 0 ? 'Today' : `${c.daysSinceLogin}d ago`}</p>
        </div>
      </HoverCard>
    );
  }

  function PropertyCardGrid({ p }: { p: PropertyRow }) {
    return (
      <HoverCard className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#d1fae5' }}>
            <Home className="h-5 w-5" style={{ color: '#065f46' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
            <p className="text-xs text-slate-400 truncate">{p.street}, {p.city}, {p.state}</p>
          </div>
          {p.openCases > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>{p.openCases} cases</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#6b7280' }}>{p.type?.replace(/_/g, ' ')}</span>
          <span className="text-slate-300">·</span>
          <span className="truncate">{p.orgName}</span>
        </div>
        <div className="pt-1 flex items-center justify-between" style={{ borderTop: '1px solid #f0f0f0' }}>
          <p className="text-[10px] text-slate-400">Added {format(new Date(p.createdAt), 'MMM yyyy')}</p>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <MapPin className="h-3 w-3" />{p.city}, {p.state}
          </div>
        </div>
      </HoverCard>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f5f6fa' }}>

      {/* ── Sidebar ── */}
      <aside className="w-64 flex flex-col shrink-0 z-20" style={{ background: '#ffffff', borderRight: '1px solid #ebebeb' }}>
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid #f0f0f0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">AllAI Property</p>
              <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#7c3aed' }}>Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {NAV.map(section => (
            <div key={section.section}>
              <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase px-3 mb-1">{section.section}</p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const active = currentView === item.id;
                  return (
                    <button key={item.id} onClick={() => navTo(item.id as ViewState)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                      style={active ? { background: 'rgba(109,40,217,0.06)', color: '#6d28d9' } : { color: '#64748b' }}>
                      <item.icon className="h-4 w-4" style={active ? { color: '#7c3aed' } : { color: '#94a3b8' }} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {'count' in item && (item as any).count > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={active ? { background: '#ede9fe', color: '#6d28d9' } : { background: '#f1f5f9', color: '#64748b' }}>
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

        <div className="px-4 py-4" style={{ borderTop: '1px solid #f0f0f0' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 group">
            <Avatar name={adminName} email={user?.email || ''} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{adminName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
            <button onClick={() => { window.location.href = '/api/logout'; }} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <LogOut className="h-3.5 w-3.5 text-slate-400 hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-14 flex items-center gap-4 px-6 shrink-0 z-10" style={{ background: '#ffffff', borderBottom: '1px solid #ebebeb' }}>
          <span className="text-sm font-semibold text-slate-700">{VIEW_TITLES[currentView]}</span>

          {/* Global search */}
          <div className="flex-1 max-w-sm relative" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              placeholder="Search users, orgs..."
              value={globalSearch}
              onChange={e => { setGlobalSearch(e.target.value); setSearchOpen(true); }}
              onFocus={() => globalSearch.length >= 2 && setSearchOpen(true)}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setGlobalSearch(''); } }}
              className={`w-full pl-9 pr-3 h-8 ${INP_CLS}`} style={INP_STYLE}
            />
            {searchOpen && globalSearch.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 overflow-hidden z-50" style={{ ...CARD, maxHeight: 320, overflowY: 'auto' }}>
                {searchResults.users.length === 0 && searchResults.orgs.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400">No results for "{globalSearch}"</div>
                ) : (
                  <>
                    {searchResults.users.length > 0 && (
                      <>
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400" style={{ background: '#f8f9fa' }}>Users</div>
                        {searchResults.users.map(u => {
                          const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
                          return (
                            <button key={u.id} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50 transition-colors text-left"
                              onClick={() => { navTo('users'); setUserSearch(u.email); setSearchOpen(false); setGlobalSearch(''); }}>
                              <Avatar name={name || undefined} email={u.email} size="sm" />
                              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700 truncate">{name || u.email}</p><p className="text-xs text-slate-400 truncate">{u.email}</p></div>
                              <RoleBadge role={u.primaryRole} />
                            </button>
                          );
                        })}
                      </>
                    )}
                    {searchResults.orgs.length > 0 && (
                      <>
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400" style={{ background: '#f8f9fa' }}>Organizations</div>
                        {searchResults.orgs.map(o => (
                          <button key={o.id} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50 transition-colors text-left"
                            onClick={() => { navTo('organizations'); setOrgSearch(o.name); setSearchOpen(false); setGlobalSearch(''); }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{o.name[0].toUpperCase()}</div>
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700 truncate">{o.name}</p><p className="text-xs text-slate-400 truncate">{o.ownerEmail}</p></div>
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#ede9fe', border: '1px solid #ddd6fe' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold" style={{ color: '#6d28d9' }}>Platform Admin</span>
            </div>
            <Avatar name={adminName} email={user?.email || ''} size="sm" />
          </div>
        </header>

        {/* Impersonation banner */}
        {impersonationStatus?.isImpersonating && (
          <div className="flex items-center justify-between px-6 py-2.5 text-white text-sm shrink-0" style={{ background: 'linear-gradient(90deg, #7c3aed, #4f46e5)' }}>
            <div className="flex items-center gap-2"><Eye className="h-4 w-4" /><span>Viewing as <strong>{impersonationStatus.orgName}</strong></span></div>
            <button onClick={() => stopImpersonationMutation.mutate()} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <LogOut className="h-3 w-3" /> Return to Admin
            </button>
          </div>
        )}

        {/* ── Content ── */}
        <main className="flex-1 overflow-auto p-6">

          {/* ════ OVERVIEW ════ */}
          {currentView === 'overview' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Welcome back, {user?.firstName || 'Admin'} 👋</h1>
                <p className="text-sm text-slate-500 mt-0.5">Here's what's happening across your platform today.</p>
              </div>

              {/* 6 stat cards — uniform style, violet active border */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Organizations" value={statsLoading ? '—' : stats?.orgCount ?? 0} icon={Building2} activeView="organizations" currentView={currentView} onClick={() => navTo('organizations')} />
                <StatCard label="Total Users"   value={statsLoading ? '—' : stats?.userCount ?? 0} icon={Users} activeView="users" currentView={currentView} onClick={() => { navTo('users'); setUserRoleFilter('all'); setUserActivityFilter('all'); }} />
                <StatCard label="Active Users"  value={statsLoading ? '—' : stats?.activeUserCount ?? 0} sub="Last 30 days" icon={Activity} onClick={() => { navTo('users'); setUserActivityFilter('very_active'); }} />
                <StatCard label="Contractors"   value={statsLoading ? '—' : stats?.contractorCount ?? 0} sub={`${contractors.filter(c => c.marketplaceActive).length} active`} icon={Wrench} activeView="contractors" currentView={currentView} onClick={() => navTo('contractors')} />
                <StatCard label="Properties"    value={statsLoading ? '—' : stats?.propertyCount ?? 0} icon={Home} activeView="properties" currentView={currentView} onClick={() => navTo('properties')} />
                <StatCard label="Active Cases"  value={statsLoading ? '—' : stats?.openCaseCount ?? 0} icon={AlertTriangle} activeView="cases" currentView={currentView} onClick={() => navTo('cases')} />
              </div>

              {/* Alert chips */}
              {(neverLoggedInCount > 0 || dormantCount > 0 || noRoleCount > 0) && (
                <div className="flex flex-wrap gap-2">
                  {neverLoggedInCount > 0 && <button onClick={() => { navTo('users'); setUserActivityFilter('never_logged_in'); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium" style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}><AlertTriangle className="h-3.5 w-3.5" />{neverLoggedInCount} never logged in<ChevronRight className="h-3.5 w-3.5" /></button>}
                  {dormantCount > 0 && <button onClick={() => { navTo('users'); setUserActivityFilter('dormant'); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}><XCircle className="h-3.5 w-3.5" />{dormantCount} dormant<ChevronRight className="h-3.5 w-3.5" /></button>}
                  {noRoleCount > 0 && <button onClick={() => { navTo('users'); setUserRoleFilter('unassigned'); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151' }}><AlertTriangle className="h-3.5 w-3.5" />{noRoleCount} with no role<ChevronRight className="h-3.5 w-3.5" /></button>}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Role distribution */}
                <div className="lg:col-span-2 p-5" style={CARD}>
                  <h2 className="text-sm font-bold text-slate-700 mb-4">User Distribution by Role</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(usersByRole).map(([role, data]) => {
                      const key = role === 'null' ? 'unassigned' : role;
                      const m = ROLE_META[key] || { label: key, color: '#6b7280', bg: '#f3f4f6' };
                      const pct = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;
                      return (
                        <button key={role} onClick={() => { navTo('users'); setUserRoleFilter(key); }} className="text-left p-3 rounded-xl border border-slate-100 hover:border-violet-200 transition-all" style={{ background: '#fafafa' }}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mb-2" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                          <div className="flex items-end justify-between"><span className="text-2xl font-bold text-slate-800">{data.total}</span><span className="text-xs text-slate-400">{pct}% active</span></div>
                          <div className="mt-2 h-1 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #4f46e5)' }} /></div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Activity mini feed */}
                <div className="p-5" style={CARD}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-700">Recent Activity</h2>
                    <button onClick={() => navTo('activity')} className="text-xs font-medium" style={{ color: '#7c3aed' }}>View all →</button>
                  </div>
                  {activityLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div> : (
                    <div className="space-y-3">
                      {activityFeed.slice(0, 6).map((event, i) => (
                        <div key={`${event.id}-${i}`} className="flex items-start gap-3">
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

              {/* Most active orgs */}
              <div className="p-5" style={CARD}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-700">Most Active Organizations</h2>
                  <button onClick={() => navTo('organizations')} className="text-xs font-medium" style={{ color: '#7c3aed' }}>Manage all →</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...organizations].sort((a, b) => b._count.cases - a._count.cases).slice(0, 6).map(org => (
                    <div key={org.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-violet-200 transition-all" style={{ background: '#fafafa' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{org.name[0].toUpperCase()}</div>
                      <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">{org.name}</p><p className="text-[10px] text-slate-400">{org._count.properties} props · {org._count.cases} cases</p></div>
                      <button onClick={() => impersonateMutation.mutate(org.id)} className="text-[10px] font-semibold shrink-0" style={{ color: '#7c3aed' }}>View</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════ USERS ════ */}
          {currentView === 'users' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div><h1 className="text-xl font-bold text-slate-800">Users</h1><p className="text-sm text-slate-500">{filteredUsers.length} of {allUsers.length}</p></div>
                <button onClick={() => refetchUsers()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
              </div>
              <FilterRow right={<ViewToggle mode={usersMode} setMode={setUsersMode} showMap={false} />}>
                <SearchInput value={userSearch} onChange={setUserSearch} placeholder="Search users..." />
                <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} className={`h-8 px-3 ${INP_CLS} text-slate-700`} style={INP_STYLE}>
                  <option value="all">All Roles</option>
                  {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={userActivityFilter} onChange={e => setUserActivityFilter(e.target.value)} className={`h-8 px-3 ${INP_CLS} text-slate-700`} style={INP_STYLE}>
                  <option value="all">All Activity</option>
                  {Object.entries(ACTIVITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={userSort} onChange={e => setUserSort(e.target.value as any)} className={`h-8 px-3 ${INP_CLS} text-slate-700`} style={INP_STYLE}>
                  <option value="joined">Newest first</option>
                  <option value="name">By name</option>
                  <option value="role">By role</option>
                  <option value="activity">By activity</option>
                </select>
              </FilterRow>

              {usersMode === 'map' ? <MapPlaceholder label="User" /> : (
                <div className="rounded-2xl overflow-hidden" style={CARD}>
                  {usersLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> : (
                    <>
                      {usersMode === 'grid' ? (
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {filteredUsers.map(u => {
                            const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                            return (
                              <HoverCard key={u.id} className="p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={name !== u.email ? name : undefined} email={u.email} size="md" />
                                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-700 truncate">{name}</p><p className="text-xs text-slate-400 truncate">{u.email}</p></div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <RoleBadge role={u.primaryRole} />
                                  <ActivityBadge status={u.activityStatus} />
                                </div>
                                <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid #f0f0f0' }}>
                                  <p className="text-[10px] text-slate-400">{u.daysSinceLogin === null ? 'Never logged in' : u.daysSinceLogin === 0 ? 'Active today' : `${u.daysSinceLogin}d ago`}</p>
                                  <button onClick={() => setRoleModal({ user: u, newRole: u.primaryRole || 'tenant' })} className="text-[10px] font-semibold" style={{ color: '#7c3aed' }}>Change Role</button>
                                </div>
                              </HoverCard>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
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
                                  <TableRow key={u.id} className="hover:bg-violet-50/20" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <TableCell><div className="flex items-center gap-3"><Avatar name={name !== u.email ? name : undefined} email={u.email} size="sm" /><div><p className="text-sm font-medium text-slate-700">{name}</p><p className="text-xs text-slate-400">{u.email}</p></div></div></TableCell>
                                    <TableCell><RoleBadge role={u.primaryRole} /></TableCell>
                                    <TableCell><ActivityBadge status={u.activityStatus} /></TableCell>
                                    <TableCell className="text-sm text-slate-500">{u.daysSinceLogin === null ? 'Never' : u.daysSinceLogin === 0 ? 'Today' : `${u.daysSinceLogin}d ago`}</TableCell>
                                    <TableCell className="text-sm text-slate-500">{format(new Date(u.createdAt), 'MMM d, yyyy')}</TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild><button className="p-1.5 rounded-lg hover:bg-slate-100"><MoreHorizontal className="h-4 w-4 text-slate-400" /></button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                          <DropdownMenuItem onClick={() => setRoleModal({ user: u, newRole: u.primaryRole || 'tenant' })}><UserCog className="h-4 w-4 mr-2 text-slate-500" /> Change Role</DropdownMenuItem>
                                          {u.primaryRole === 'org_admin' && <DropdownMenuItem onClick={() => { const org = organizations.find(o => o.ownerEmail === u.email); if (org) impersonateMutation.mutate(org.id); }}><Eye className="h-4 w-4 mr-2 text-slate-500" /> View as this Org</DropdownMenuItem>}
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-red-600" onClick={() => setDeactivateTarget(u)}><UserX className="h-4 w-4 mr-2" /> Deactivate</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                          {filteredUsers.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No users match your filters</div>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ ORGANIZATIONS ════ */}
          {currentView === 'organizations' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <div><h1 className="text-xl font-bold text-slate-800">Organizations</h1><p className="text-sm text-slate-500">{filteredOrgs.length} of {organizations.length}</p></div>
              <FilterRow right={<ViewToggle mode={orgsMode} setMode={setOrgsMode} />}>
                <SearchInput value={orgSearch} onChange={setOrgSearch} placeholder="Search organizations..." width="w-64" />
                <select value={orgSort} onChange={e => setOrgSort(e.target.value as any)} className={`h-8 px-3 ${INP_CLS} text-slate-700`} style={INP_STYLE}>
                  <option value="cases">Most Cases</option>
                  <option value="properties">Most Properties</option>
                  <option value="tenants">Most Tenants</option>
                  <option value="name">Name A–Z</option>
                </select>
              </FilterRow>
              {orgsLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> :
               orgsMode === 'map' ? <MapPlaceholder label="Organization" /> :
               orgsMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrgs.map(org => <OrgCardGrid key={org.id} org={org} />)}
                  {filteredOrgs.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No organizations found</div>}
                </div>
               ) : (
                <div className="rounded-2xl overflow-hidden" style={CARD}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                        <TableHead className="text-xs font-semibold text-slate-500">Organization</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 text-center">Properties</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 text-center">Tenants</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 text-center">Cases</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500">Created</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 text-right">Action</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>{filteredOrgs.map(org => <OrgTableRow key={org.id} org={org} />)}</TableBody>
                    </Table>
                    {filteredOrgs.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No organizations found</div>}
                  </div>
                </div>
               )
              }
            </div>
          )}

          {/* ════ CONTRACTORS ════ */}
          {currentView === 'contractors' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <div><h1 className="text-xl font-bold text-slate-800">Contractor Marketplace</h1><p className="text-sm text-slate-500">{filteredContractors.length} of {contractors.length}</p></div>
              <FilterRow right={<ViewToggle mode={contractorsMode} setMode={setContractorsMode} showMap={false} />}>
                <SearchInput value={contractorSearch} onChange={setContractorSearch} placeholder="Search contractors..." />
                <select value={contractorMarketFilter} onChange={e => setContractorMarketFilter(e.target.value)} className={`h-8 px-3 ${INP_CLS} text-slate-700`} style={INP_STYLE}>
                  <option value="all">All Status</option>
                  <option value="active">Marketplace Active</option>
                  <option value="inactive">Marketplace Inactive</option>
                </select>
              </FilterRow>
              {contractorsLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> :
               contractorsMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredContractors.map(c => <ContractorCardGrid key={c.userId} c={c} />)}
                  {filteredContractors.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No contractors found</div>}
                </div>
               ) : (
                <div className="rounded-2xl overflow-hidden" style={CARD}>
                  <Table>
                    <TableHeader><TableRow style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                      <TableHead className="text-xs font-semibold text-slate-500">Contractor</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Specialties</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 text-center">Jobs</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 text-center">Favorites</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Activity</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredContractors.map(c => {
                        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;
                        return (
                          <TableRow key={c.userId} className="hover:bg-violet-50/20" style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <TableCell><div className="flex items-center gap-3"><Avatar name={name !== c.email ? name : undefined} email={c.email} size="sm" /><div><p className="text-sm font-medium text-slate-700">{name}</p><p className="text-xs text-slate-400">{c.email}</p></div></div></TableCell>
                            <TableCell><div className="flex flex-wrap gap-1">{c.specialties.slice(0, 2).map((s, i) => <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>{s}</span>)}{c.specialties.length > 2 && <span className="text-[10px] text-slate-400">+{c.specialties.length - 2}</span>}</div></TableCell>
                            <TableCell><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={c.marketplaceActive ? { background: '#d1fae5', color: '#065f46' } : { background: '#f3f4f6', color: '#6b7280' }}>{c.marketplaceActive ? 'Active' : 'Inactive'}</span></TableCell>
                            <TableCell className="text-center text-sm text-slate-600">{c.totalJobs}</TableCell>
                            <TableCell className="text-center"><div className="flex items-center justify-center gap-1"><Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />{c.favoriteCount}</div></TableCell>
                            <TableCell><ActivityBadge status={c.activityStatus} /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {filteredContractors.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No contractors found</div>}
                </div>
               )
              }
            </div>
          )}

          {/* ════ PROPERTIES ════ */}
          {currentView === 'properties' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <div><h1 className="text-xl font-bold text-slate-800">Properties</h1><p className="text-sm text-slate-500">{filteredProperties.length} of {allProperties.length} across all organizations</p></div>
              <FilterRow right={<ViewToggle mode={propsMode} setMode={setPropsMode} />}>
                <SearchInput value={propSearch} onChange={setPropSearch} placeholder="Search by name, city, org..." width="w-64" />
              </FilterRow>
              {propsLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> :
               propsMode === 'map' ? <MapPlaceholder label="Property" /> :
               propsMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProperties.map(p => <PropertyCardGrid key={p.id} p={p} />)}
                  {filteredProperties.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No properties found</div>}
                </div>
               ) : (
                <div className="rounded-2xl overflow-hidden" style={CARD}>
                  <Table>
                    <TableHeader><TableRow style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                      <TableHead className="text-xs font-semibold text-slate-500">Property</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Type</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Location</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Organization</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 text-center">Open Cases</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Added</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredProperties.map(p => (
                        <TableRow key={p.id} className="hover:bg-violet-50/20" style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <TableCell><div className="flex items-center gap-3"><div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#d1fae5' }}><Home className="h-3.5 w-3.5" style={{ color: '#065f46' }} /></div><p className="text-sm font-medium text-slate-700">{p.name}</p></div></TableCell>
                          <TableCell><span className="text-xs text-slate-500">{p.type?.replace(/_/g, ' ')}</span></TableCell>
                          <TableCell className="text-sm text-slate-500">{p.city}, {p.state}</TableCell>
                          <TableCell className="text-sm text-slate-500">{p.orgName}</TableCell>
                          <TableCell className="text-center">{p.openCases > 0 ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>{p.openCases}</span> : <span className="text-slate-300">—</span>}</TableCell>
                          <TableCell className="text-sm text-slate-400">{format(new Date(p.createdAt), 'MMM d, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredProperties.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No properties found</div>}
                </div>
               )
              }
            </div>
          )}

          {/* ════ CASES ════ */}
          {currentView === 'cases' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <div><h1 className="text-xl font-bold text-slate-800">Active Cases</h1><p className="text-sm text-slate-500">{filteredCases.length} of {allCases.length} open cases platform-wide</p></div>
              <FilterRow right={<ViewToggle mode={casesMode} setMode={setCasesMode} showMap={false} />}>
                <SearchInput value={caseSearch} onChange={setCaseSearch} placeholder="Search by title or org..." width="w-64" />
                <select value={casePriorityFilter} onChange={e => setCasePriorityFilter(e.target.value)} className={`h-8 px-3 ${INP_CLS} text-slate-700`} style={INP_STYLE}>
                  <option value="all">All Priorities</option>
                  {Object.keys(PRIORITY_META).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </FilterRow>
              {casesLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> :
               casesMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCases.map(c => (
                    <HoverCard key={c.id} className="p-5 space-y-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-tight mb-1">{c.title}</p>
                        <p className="text-xs text-slate-400">{c.orgName}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={c.status} />
                        <PriorityBadge priority={c.priority} />
                        {c.category && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: '#f3f4f6', color: '#6b7280' }}>{c.category}</span>}
                      </div>
                      <p className="text-[10px] text-slate-400 pt-1" style={{ borderTop: '1px solid #f0f0f0' }}>Opened {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</p>
                    </HoverCard>
                  ))}
                  {filteredCases.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400 text-sm">No active cases found</div>}
                </div>
               ) : (
                <div className="rounded-2xl overflow-hidden" style={CARD}>
                  <Table>
                    <TableHeader><TableRow style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                      <TableHead className="text-xs font-semibold text-slate-500">Title</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Priority</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Category</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Organization</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Opened</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredCases.map(c => (
                        <TableRow key={c.id} className="hover:bg-violet-50/20" style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <TableCell className="text-sm font-medium text-slate-700 max-w-xs"><p className="truncate">{c.title}</p></TableCell>
                          <TableCell><StatusBadge status={c.status} /></TableCell>
                          <TableCell><PriorityBadge priority={c.priority} /></TableCell>
                          <TableCell className="text-sm text-slate-500">{c.category || '—'}</TableCell>
                          <TableCell className="text-sm text-slate-500">{c.orgName}</TableCell>
                          <TableCell className="text-sm text-slate-400">{format(new Date(c.createdAt), 'MMM d, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredCases.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No active cases found</div>}
                </div>
               )
              }
            </div>
          )}

          {/* ════ ACTIVITY ════ */}
          {currentView === 'activity' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between">
                <div><h1 className="text-xl font-bold text-slate-800">Activity Feed</h1><p className="text-sm text-slate-500">Recent platform events</p></div>
                <div className="flex items-center gap-2">
                  {(['all', 'user_signup', 'org_created', 'case_opened'] as const).map(t => (
                    <button key={t} onClick={() => setActivityTypeFilter(t)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={activityTypeFilter === t ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#ffffff' } : { background: '#ffffff', border: '1px solid #e5e7eb', color: '#64748b' }}>
                      {t === 'all' ? 'All' : t === 'user_signup' ? 'Signups' : t === 'org_created' ? 'Orgs' : 'Cases'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl" style={CARD}>
                {activityLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> :
                 filteredActivity.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">No activity</div> : (
                  <div className="divide-y divide-slate-50">
                    {filteredActivity.map((event, i) => (
                      <div key={`${event.id}-${i}`} className="flex items-start gap-4 px-5 py-4 hover:bg-violet-50/20">
                        <ActivityIcon type={event.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700">{event.subtitle}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{event.title}</p>
                        </div>
                        <p className="text-xs text-slate-400 shrink-0 mt-0.5">{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Role change modal */}
      <Dialog open={!!roleModal} onOpenChange={() => setRoleModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>Update the platform role for <strong>{roleModal?.user.email}</strong>.</DialogDescription>
          </DialogHeader>
          {roleModal && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8f9fa' }}>
                <Avatar name={`${roleModal.user.firstName || ''} ${roleModal.user.lastName || ''}`.trim()} email={roleModal.user.email} size="md" />
                <div><p className="text-sm font-semibold text-slate-700">{`${roleModal.user.firstName || ''} ${roleModal.user.lastName || ''}`.trim() || roleModal.user.email}</p><p className="text-xs text-slate-400">{roleModal.user.email}</p></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">New Role</label>
                <Select value={roleModal.newRole} onValueChange={v => setRoleModal({ ...roleModal, newRole: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ROLE_META).filter(([k]) => k !== 'unassigned').map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <button className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => setRoleModal(null)}>Cancel</button>
                <button className="flex-1 h-10 rounded-lg text-sm font-medium text-white flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  onClick={() => changeRoleMutation.mutate({ userId: roleModal.user.id, role: roleModal.newRole })}
                  disabled={changeRoleMutation.isPending || roleModal.newRole === (roleModal.user.primaryRole || 'tenant')}>
                  {changeRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Role'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate confirm */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>This will revoke all active sessions for <strong>{deactivateTarget?.email}</strong>.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}>
              {deactivateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
