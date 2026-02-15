import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Link } from "wouter";
import { 
  Wrench, 
  Bell, 
  Trash2, 
  CheckCircle, 
  CalendarClock,
  Users,
  Clock,
  Circle,
  AlertTriangle,
  Check,
  X,
  Pause,
  Send,
  ChevronDown,
  ChevronUp,
  Brain,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import type { SmartCase, Property, Unit } from "@shared/schema";

type WorkOrderCardProps = {
  workOrder: SmartCase & {
    scheduledJobs?: Array<{
      id: string;
      teamId?: string;
      teamName?: string;
      teamColor?: string;
      scheduledStartAt?: string;
      scheduledEndAt?: string;
      durationDays?: number;
      status?: string;
    }>;
  };
  properties?: Property[];
  units?: Unit[];
  teams?: Array<{
    id: string;
    name: string;
    color: string;
    specialty?: string;
  }>;
  customers?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    email?: string;
    orgId?: string;
  }>;
  userRole?: string;
  onStatusChange?: (id: string, status: string) => void;
  onEdit?: (workOrder: any) => void;
  onReminder?: (workOrder: any) => void;
  onDelete?: (id: string) => void;
  onAccept?: (workOrder: any) => void;
  onReviewCounter?: (job: any) => void;
  onPostToMarketplace?: (workOrder: any) => void;
  index?: number;
  showActions?: boolean;
  variant?: "default" | "compact";
};

export default function WorkOrderCard({
  workOrder,
  properties = [],
  units = [],
  teams = [],
  customers = [],
  userRole,
  onStatusChange,
  onEdit,
  onReminder,
  onDelete,
  onAccept,
  onReviewCounter,
  onPostToMarketplace,
  index = 0,
  showActions = true,
  variant = "default",
}: WorkOrderCardProps) {
  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "New": return <Circle className="h-5 w-5 text-white" />;
      case "In Progress": return <Clock className="h-5 w-5 text-white" />;
      case "Resolved": return <Check className="h-5 w-5 text-white" />;
      case "Closed": return <Check className="h-5 w-5 text-white" />;
      case "Scheduled": return <CalendarClock className="h-5 w-5 text-white" />;
      case "On Hold": return <Pause className="h-5 w-5 text-white" />;
      case "In Review": return <AlertTriangle className="h-5 w-5 text-white" />;
      default: return <Circle className="h-5 w-5 text-white" />;
    }
  };

  const isUrgentPriority = (priority: string | null) => {
    const p = priority?.toLowerCase();
    return p === "urgent" || p === "critical" || p === "emergency" || p === "emergent";
  };

  const getPriorityCircleColor = (priority: string | null) => {
    return isUrgentPriority(priority) ? "bg-red-500" : "bg-gray-300";
  };

  const getPriorityBorderClass = (priority: string | null) => {
    return isUrgentPriority(priority) ? "[border-left-color:#ef4444] hover:[border-left-color:#dc2626]" : "[border-left-color:#d1d5db] hover:[border-left-color:#3b82f6]";
  };

  const getPriorityBadge = (priority: string | null) => {
    if (isUrgentPriority(priority)) {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Urgent</Badge>;
    }
    return null;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "New": return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">New</Badge>;
      case "In Progress": return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">In Progress</Badge>;
      case "Resolved": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Resolved</Badge>;
      case "Closed": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Closed</Badge>;
      case "Scheduled": return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">Scheduled</Badge>;
      case "In Review": return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">Reviewing</Badge>;
      case "On Hold": return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">On Hold</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Get property and unit information
  const property = properties.find(p => p.id === workOrder.propertyId);
  const unit = units.find(u => u.id === workOrder.unitId);
  const propertyName = property ? (property.name || `${property.street}, ${property.city}`) : null;
  const unitLabel = unit?.label;

  // Get customer information (for contractors) - using customerId from maintenance request
  const customer = userRole === 'contractor' && workOrder.customerId ? 
    customers.find(c => c.id === workOrder.customerId) : 
    null;
  const customerName = customer ? 
    (customer.firstName && customer.lastName ? 
      `${customer.firstName} ${customer.lastName}` : 
      customer.companyName || customer.firstName || customer.lastName || customer.email) : 
    null;

  // Get team information and schedule from scheduledJobs array
  const teamInfo = workOrder.scheduledJobs?.[0];
  const hasCounterProposal = userRole === 'contractor' && workOrder.scheduledJobs?.some((job: any) => job.status === 'Needs Review');

  // Format scheduled time from scheduledJobs (not from root workOrder)
  const scheduledStartAt = teamInfo?.scheduledStartAt || workOrder.scheduledStartAt;
  const scheduledEndAt = teamInfo?.scheduledEndAt || workOrder.scheduledEndAt;
  const scheduledTime = scheduledStartAt ? format(new Date(scheduledStartAt), 'MMM d, h:mm a') : null;
  const scheduledEndTime = scheduledEndAt ? format(new Date(scheduledEndAt), 'h:mm a') : null;
  const durationDays = teamInfo?.durationDays;

  const isCompact = variant === "compact";
  const [isTriageExpanded, setIsTriageExpanded] = useState(false);

  // Parse AI triage JSON if available
  const aiTriage = workOrder.aiTriageJson ? (
    typeof workOrder.aiTriageJson === 'string' 
      ? JSON.parse(workOrder.aiTriageJson) 
      : workOrder.aiTriageJson
  ) : null;

  return (
    <Card 
      className={`group hover:shadow-lg transition-all duration-200 border border-transparent border-l-4 ${getPriorityBorderClass(workOrder.priority)} ${isCompact ? 'shadow-sm' : ''}`}
      data-testid={`card-case-${index}`}
    >
      <CardHeader className={isCompact ? "p-3 pb-2" : "pb-3"}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className={`${isCompact ? 'w-7 h-7' : 'w-10 h-10'} ${getPriorityCircleColor(workOrder.priority)} rounded-full flex items-center justify-center flex-shrink-0`}>
              {getStatusIcon(workOrder.status)}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className={`${isCompact ? 'text-sm' : 'text-base'} font-semibold leading-tight mb-1`} data-testid={`text-case-title-${index}`}>
                {workOrder.title}
              </CardTitle>
              {workOrder.category && (
                <p className="text-xs text-muted-foreground truncate" data-testid={`text-case-category-${index}`}>
                  {workOrder.category}
                </p>
              )}
              {/* Customer Name (for contractors) */}
              {userRole === 'contractor' && customerName && (
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1 truncate" data-testid={`text-customer-name-${index}`}>
                  Customer: {customerName}
                </p>
              )}
              {/* Property + Unit combined */}
              {(propertyName || unitLabel) && (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1 truncate" data-testid={`text-property-name-${index}`}>
                  {propertyName && unitLabel ? `${propertyName} - ${unitLabel}` : propertyName || `Unit ${unitLabel}`}
                </p>
              )}
              {/* Scheduled Time/Duration */}
              {scheduledTime && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {scheduledTime}
                  {scheduledEndTime && ` - ${scheduledEndTime}`}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end space-y-1 flex-shrink-0">
            {!isCompact && getPriorityBadge(workOrder.priority)}
            {getStatusBadge(workOrder.status)}
            {/* Team Badge */}
            {teamInfo?.teamName && (
              <div 
                className={`flex items-center gap-1 ${isCompact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'} rounded-full text-white ${isCompact ? 'text-[10px]' : 'text-xs'} font-medium`}
                style={{ backgroundColor: teamInfo.teamColor || '#6b7280' }}
              >
                <Users className={isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                <span>{teamInfo.teamName}</span>
              </div>
            )}
            {/* Counter-Proposal Badge */}
            {hasCounterProposal && !isCompact && (
              <div className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full animate-pulse">
                <CalendarClock className="h-3 w-3" />
                <span className="text-xs font-medium">Counter-Proposal</span>
              </div>
            )}
            {!isCompact && (
              <div className="text-xs text-muted-foreground">
                {workOrder.createdAt ? new Date(workOrder.createdAt).toLocaleDateString() : 'Unknown'}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className={isCompact ? "p-3 pt-0" : "pt-0"}>
        {/* Description */}
        {workOrder.description && !isCompact && (
          <div className="mb-3">
            <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-case-description-${index}`}>
              {workOrder.description}
            </p>
          </div>
        )}
        
        {/* AI Triage - Expandable Section */}
        {aiTriage && !isCompact && (
          <Collapsible open={isTriageExpanded} onOpenChange={setIsTriageExpanded} className="mb-3">
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-between h-8 px-2 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded"
              >
                <span className="flex items-center gap-1.5 text-xs text-blue-800 dark:text-blue-200">
                  <Brain className="h-3.5 w-3.5" />
                  AI Triage Analysis
                  {aiTriage.urgency && (
                    <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4">
                      {aiTriage.urgency}
                    </Badge>
                  )}
                </span>
                {isTriageExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
              <div className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
                {aiTriage.rootCause && (
                  <div>
                    <strong>Root Cause:</strong> {aiTriage.rootCause}
                  </div>
                )}
                {aiTriage.estimatedTime && (
                  <div>
                    <strong>Est. Time:</strong> {aiTriage.estimatedTime}
                  </div>
                )}
                {aiTriage.estimatedCost && (
                  <div>
                    <strong>Est. Cost:</strong> {aiTriage.estimatedCost}
                  </div>
                )}
                {aiTriage.suggestedActions && Array.isArray(aiTriage.suggestedActions) && (
                  <div>
                    <strong>Suggested Actions:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {aiTriage.suggestedActions.map((action: string, i: number) => (
                        <li key={i} className="text-blue-700 dark:text-blue-300">{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Legacy AI Assessment if no triage but has notes */}
        {!aiTriage && workOrder.aiReasoningNotes && !isCompact && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-800 dark:text-blue-200 line-clamp-2">
              <strong>AI Assessment:</strong> {workOrder.aiReasoningNotes}
            </p>
          </div>
        )}

        {showActions && !isCompact && (
          <div className="flex items-center space-x-2">
            {/* Status Dropdown */}
            {onStatusChange && (
              <Select 
                value={workOrder.status || "New"} 
                onValueChange={(newStatus) => onStatusChange(workOrder.id, newStatus)}
              >
                <SelectTrigger className="h-8 text-xs flex-1" data-testid={`select-case-status-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="In Review">Reviewing</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            {/* Edit Button */}
            {onEdit && (
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onEdit(workOrder)}
                data-testid={`button-edit-case-${index}`}
                title="Edit Case"
              >
                <Wrench className="h-3 w-3" />
              </Button>
            )}
            
            {/* Reminder Button */}
            {onReminder && (
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onReminder(workOrder)}
                data-testid={`button-remind-case-${index}`}
                title="Add Reminder"
              >
                <Bell className="h-3 w-3" />
              </Button>
            )}
            
            {/* Post to Marketplace Button (Landlord Only for Unassigned Cases) */}
            {onPostToMarketplace && userRole !== 'contractor' && !workOrder.assignedContractorId && !workOrder.postedAt && (
              <Button 
                variant="default" 
                size="sm"
                className="h-8 px-3 bg-purple-600 hover:bg-purple-700"
                onClick={() => onPostToMarketplace(workOrder)}
                data-testid={`button-post-marketplace-${index}`}
                title="Post to Contractor Marketplace"
              >
                <Send className="h-3 w-3 mr-1" />
                Marketplace
              </Button>
            )}
            
            {/* Accept Button (Contractor Only) */}
            {onAccept && userRole === 'contractor' && workOrder.status === 'New' && (
              <Button 
                variant="default" 
                size="sm"
                className="h-8 px-3"
                onClick={() => onAccept(workOrder)}
                data-testid={`button-accept-case-${index}`}
                title="Accept Case"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Accept
              </Button>
            )}
            
            {/* Send Quote Button (Contractor Only) */}
            {userRole === 'contractor' && (
              <Link href={`/quotes?caseId=${workOrder.id}`}>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 px-3 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                  data-testid={`button-send-quote-${index}`}
                  title="Send Quote"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Quote
                </Button>
              </Link>
            )}
            
            {/* Review Counter-Proposal (Contractor Only) */}
            {onReviewCounter && hasCounterProposal && (
              <Button 
                variant="default" 
                size="sm"
                className="h-8 px-3 bg-orange-600 hover:bg-orange-700"
                onClick={() => {
                  const jobNeedingReview = workOrder.scheduledJobs?.find((job: any) => job.status === 'Needs Review');
                  if (jobNeedingReview && onReviewCounter) {
                    onReviewCounter(jobNeedingReview);
                  }
                }}
                data-testid={`button-review-counter-${index}`}
                title="Review Counter-Proposal"
              >
                <CalendarClock className="h-3 w-3 mr-1" />
                Review
              </Button>
            )}
            
            {/* Delete Button */}
            {onDelete && (
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDelete(workOrder.id)}
                data-testid={`button-delete-case-${index}`}
                title="Delete Case"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
