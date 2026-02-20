import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, MapPin, DollarSign, AlertTriangle, Zap, Calendar, 
  ChevronRight, Check, X, ArrowUpDown, Search, Filter,
  CalendarClock, TrendingUp, Bell, CheckCircle, Maximize2
} from "lucide-react";
import { format, differenceInDays, isToday, isTomorrow, isThisWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface WorkQueueCase {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  buildingName?: string;
  roomNumber?: string;
  locationText?: string;
  estimatedCost?: number;
  actualCost?: number;
  assignedContractorId?: string;
  customerId?: string;
  customerName?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkQueueProps {
  cases: WorkQueueCase[];
  isLoading: boolean;
  onAcceptCase: (case_: WorkQueueCase) => void;
  onProposeTime: (case_: WorkQueueCase) => void;
  onViewDetails: (case_: WorkQueueCase) => void;
  onExpand?: () => void;
  isExpanded?: boolean;
}

type SortOption = 'newest' | 'oldest' | 'priority' | 'value';
type TimeFilter = 'all' | 'today' | 'this_week';

const isUrgentPriority = (priority: string) => {
  const p = priority?.toLowerCase();
  return p === "urgent" || p === "critical" || p === "emergency" || p === "emergent";
};

const PRIORITY_ORDER: Record<string, number> = {
  'Urgent': 0,
};

const getPriorityOrder = (priority: string): number => {
  return isUrgentPriority(priority) ? 0 : 1;
};

const PRIORITY_STYLES: Record<string, string> = {
  'Urgent': 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300',
};

const STATUS_STYLES: Record<string, string> = {
  'New': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  'Assigned': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  'Scheduled': 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  'In Progress': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  'Resolved': 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  'Closed': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function WorkQueue({ 
  cases, 
  isLoading, 
  onAcceptCase, 
  onProposeTime,
  onViewDetails,
  onExpand,
  isExpanded = false
}: WorkQueueProps) {
  const { toast } = useToast();
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const updateCaseStatus = useMutation({
    mutationFn: async ({ caseId, status }: { caseId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/cases/${caseId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/cases'] });
      toast({ title: "Status Updated", description: "Case status has been updated." });
    },
    onError: () => {
      toast({ title: "Update Failed", description: "Failed to update status.", variant: "destructive" });
    }
  });

  const categories = useMemo(() => {
    const unique = [...new Set(cases.map(c => c.category).filter(Boolean))];
    return unique.sort();
  }, [cases]);

  const statuses = useMemo(() => {
    const unique = [...new Set(cases.map(c => c.status).filter(Boolean))];
    return unique.sort();
  }, [cases]);

  const filteredAndSortedCases = useMemo(() => {
    let result = [...cases];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.title.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.customerName?.toLowerCase().includes(query) ||
        c.locationText?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      result = result.filter(c => c.category === categoryFilter);
    }

    if (timeFilter === 'today') {
      result = result.filter(c => isToday(new Date(c.createdAt)));
    } else if (timeFilter === 'this_week') {
      result = result.filter(c => isThisWeek(new Date(c.createdAt)));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'priority':
          return getPriorityOrder(a.priority) - getPriorityOrder(b.priority);
        case 'value':
          return (b.estimatedCost || 0) - (a.estimatedCost || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [cases, sortBy, timeFilter, statusFilter, categoryFilter, searchQuery]);

  const stats = useMemo(() => {
    const actionable = cases.filter(c => ['New', 'Assigned'].includes(c.status));
    const inProgress = cases.filter(c => c.status === 'In Progress');
    const urgent = cases.filter(c => isUrgentPriority(c.priority) && !['Resolved', 'Closed'].includes(c.status));
    const todayCount = cases.filter(c => isToday(new Date(c.createdAt))).length;
    
    return { actionable: actionable.length, inProgress: inProgress.length, urgent: urgent.length, today: todayCount };
  }, [cases]);

  const getAgeBadge = (createdAt: string) => {
    const date = new Date(createdAt);
    if (isToday(date)) return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Today</Badge>;
    if (isTomorrow(date)) return null;
    const days = differenceInDays(new Date(), date);
    if (days > 3) return <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{days}d old</Badge>;
    return null;
  };

  const getPriorityIcon = (priority: string) => {
    if (isUrgentPriority(priority)) return <AlertTriangle className="h-3 w-3 text-red-600" />;
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading work queue...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
              <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.actionable}</p>
              <p className="text-xs text-muted-foreground">Needs Action</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-lg">
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 dark:bg-red-950 rounded-lg">
              <Zap className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.urgent}</p>
              <p className="text-xs text-muted-foreground">Urgent</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
              <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.today}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Work Queue</CardTitle>
              <CardDescription>{filteredAndSortedCases.length} jobs</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3 h-7">All</TabsTrigger>
                  <TabsTrigger value="today" className="text-xs px-3 h-7">Today</TabsTrigger>
                  <TabsTrigger value="this_week" className="text-xs px-3 h-7">This Week</TabsTrigger>
                </TabsList>
              </Tabs>
              {onExpand && !isExpanded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExpand}
                  className="flex items-center gap-1.5"
                  title="Focus mode with Maya AI"
                >
                  <Maximize2 className="h-4 w-4" />
                  Focus
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search jobs..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[130px] h-8">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="value">Highest Value</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filteredAndSortedCases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No jobs match your filters</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Job</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedCases.map((case_) => (
                  <TableRow 
                    key={case_.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewDetails(case_)}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(case_.priority)}
                          <span className="font-medium truncate max-w-[300px]">{case_.title}</span>
                          {getAgeBadge(case_.createdAt)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {case_.customerName && <span>{case_.customerName}</span>}
                          {case_.locationText && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {case_.locationText}
                            </span>
                          )}
                          {case_.category && (
                            <Badge variant="outline" className="text-xs h-5">{case_.category}</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isUrgentPriority(case_.priority) ? (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />Urgent
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-xs", STATUS_STYLES[case_.status])}>
                        {case_.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {case_.estimatedCost ? (
                        <span className="font-medium">${case_.estimatedCost.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {case_.status === 'New' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="default"
                              className="h-7 px-2 text-xs"
                              onClick={() => onAcceptCase(case_)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Accept
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => onProposeTime(case_)}
                            >
                              <CalendarClock className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {case_.status === 'Scheduled' && (
                          <Button 
                            size="sm" 
                            variant="default"
                            className="h-7 px-2 text-xs"
                            onClick={() => updateCaseStatus.mutate({ caseId: case_.id, status: 'In Progress' })}
                          >
                            Start
                          </Button>
                        )}
                        {case_.status === 'In Progress' && (
                          <Button 
                            size="sm" 
                            variant="default"
                            className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => updateCaseStatus.mutate({ caseId: case_.id, status: 'Resolved' })}
                          >
                            Complete
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-7 px-1"
                          onClick={() => onViewDetails(case_)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
