import { useMemo, useState } from "react";
import { format, parseISO, isToday, isBefore, isAfter, addMinutes } from "date-fns";
import { Clock, Calendar, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  memberId: string;
  name: string;
  color: string;
}

interface Appointment {
  id: string;
  title?: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status?: string;
  contractorId: string;
  teamId?: string;
  address?: string;
  customerName?: string;
  urgency?: string;
  source?: string;
}

interface TeamTimelineProps {
  teamMembers: TeamMember[];
  appointments: Appointment[];
  onViewCalendar?: () => void;
}

const HOUR_WIDTH = 60;
const TIMELINE_START = 6;
const TIMELINE_END = 23;
const TOTAL_HOURS = TIMELINE_END - TIMELINE_START;

const TEAM_COLORS = [
  '#64748B', '#78716C', '#6B7280', '#71717A', '#737373', '#64748B', '#6B7280', '#78716C'
];

export function TeamTimeline({ teamMembers, appointments, onViewCalendar }: TeamTimelineProps) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const { toast } = useToast();
  const [hoveredAppointment, setHoveredAppointment] = useState<string | null>(null);
  
  const timelineMarkers = useMemo(() => {
    const markers = [];
    for (let h = TIMELINE_START; h <= TIMELINE_END; h++) {
      markers.push(h);
    }
    return markers;
  }, []);

  const todaysAppointments = useMemo(() => {
    return appointments.filter(apt => {
      if (!apt.scheduledStartAt) return false;
      const aptDate = parseISO(apt.scheduledStartAt);
      return isToday(aptDate);
    });
  }, [appointments]);

  const getAppointmentsForMember = (member: TeamMember) => {
    return todaysAppointments.filter(apt => 
      apt.teamId === member.id || // Match by teamId for team-based jobs
      apt.teamId === member.memberId ||
      apt.contractorId === member.memberId || 
      apt.contractorId === member.id
    );
  };

  const getAppointmentStyle = (apt: Appointment) => {
    const start = parseISO(apt.scheduledStartAt);
    const end = parseISO(apt.scheduledEndAt);
    
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    
    const clampedStart = Math.max(startHour, TIMELINE_START);
    const clampedEnd = Math.min(endHour, TIMELINE_END);
    
    const left = (clampedStart - TIMELINE_START) * HOUR_WIDTH;
    const width = Math.max((clampedEnd - clampedStart) * HOUR_WIDTH, 50);
    
    return { left, width };
  };

  const getTimeBasedCategory = (apt: Appointment): 'remaining' | 'active' | 'complete' => {
    if (apt.status === 'Completed') return 'complete';
    
    const start = parseISO(apt.scheduledStartAt);
    const end = parseISO(apt.scheduledEndAt);
    
    if (isAfter(now, end)) return 'complete';
    if (isBefore(now, start)) return 'remaining';
    return 'active';
  };

  const getTeamColor = (member: TeamMember, index: number) => {
    return member.color || TEAM_COLORS[index % TEAM_COLORS.length];
  };

  const getCurrentTimePosition = () => {
    if (currentHour < TIMELINE_START || currentHour > TIMELINE_END) return null;
    const hourOffset = currentHour - TIMELINE_START + currentMinute / 60;
    return hourOffset * HOUR_WIDTH;
  };

  const currentTimePos = getCurrentTimePosition();

  const summaryStats = useMemo(() => {
    const total = todaysAppointments.length;
    let remaining = 0;
    let active = 0;
    let complete = 0;
    
    todaysAppointments.forEach(apt => {
      const category = getTimeBasedCategory(apt);
      if (category === 'remaining') remaining++;
      else if (category === 'active') active++;
      else complete++;
    });
    
    return { total, remaining, active, complete };
  }, [todaysAppointments, now]);

  const markCompleteMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const isScheduledJob = appointmentId.startsWith('job-');
      if (isScheduledJob) {
        const jobId = appointmentId.replace('job-', '');
        return apiRequest('PATCH', `/api/scheduled-jobs/${jobId}`, { status: 'Completed' });
      }
      return apiRequest('PATCH', `/api/appointments/${appointmentId}`, { status: 'Completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/team-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-jobs'] });
      toast({ title: "Marked complete", description: "Job has been marked as completed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark as complete", variant: "destructive" });
    }
  });

  if (teamMembers.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl" style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)',
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
        <Calendar className="h-8 w-8 mx-auto mb-3 text-gray-400" />
        <p className="text-gray-500 text-sm">No team members configured</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Today's Appointments
          </h3>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
            <div className="flex flex-col items-center px-2 sm:px-3 py-1 rounded-lg bg-gray-50 border border-gray-100 min-w-fit">
              <span className="text-xs sm:text-sm font-bold text-gray-800">{summaryStats.total}</span>
              <span className="text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-wide">Total</span>
            </div>
            <div 
              className="flex flex-col items-center px-2 sm:px-3 py-1 rounded-lg border border-blue-200/50 min-w-fit"
              style={{ background: 'linear-gradient(135deg, rgba(219, 234, 254, 0.45) 0%, rgba(191, 219, 254, 0.4) 100%)' }}
            >
              <span className="text-xs sm:text-sm font-bold text-blue-700">{summaryStats.remaining}</span>
              <span className="text-[8px] sm:text-[9px] text-blue-500 uppercase tracking-wide">Left</span>
            </div>
            <div className="flex flex-col items-center px-2 sm:px-3 py-1 rounded-lg bg-orange-50 border border-orange-200 min-w-fit">
              <span className="text-xs sm:text-sm font-bold text-orange-600">{summaryStats.active}</span>
              <span className="text-[8px] sm:text-[9px] text-orange-500 uppercase tracking-wide">Active</span>
            </div>
            <div className="flex flex-col items-center px-2 sm:px-3 py-1 rounded-lg bg-green-50 border border-green-200 min-w-fit">
              <span className="text-xs sm:text-sm font-bold text-green-600">{summaryStats.complete}</span>
              <span className="text-[8px] sm:text-[9px] text-green-500 uppercase tracking-wide">Done</span>
            </div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-blue-600 hover:text-blue-700 h-8 sm:h-7 text-xs font-medium self-start sm:self-auto touch-manipulation"
          onClick={onViewCalendar}
        >
          View Calendar
        </Button>
      </div>

      <div 
        className="rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0,0,0,0.05)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.03)'
        }}
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: TOTAL_HOURS * HOUR_WIDTH + 60 }}>
            <div className="flex items-center border-b border-gray-100 bg-gray-50/50">
              <div className="w-14 flex-shrink-0 px-2 py-2 sticky left-0 z-20 bg-gray-50/95 backdrop-blur-sm">
                <Clock className="h-3.5 w-3.5 text-gray-400 mx-auto" />
              </div>
              <div className="flex-1 relative flex">
                {timelineMarkers.map((hour) => (
                  <div 
                    key={hour} 
                    className="flex-shrink-0 text-[10px] text-gray-400 font-medium border-l border-gray-100"
                    style={{ width: HOUR_WIDTH }}
                  >
                    <span className="px-1">
                      {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {teamMembers.map((member, idx) => {
              const memberAppts = getAppointmentsForMember(member);
              const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);
              const teamColor = getTeamColor(member, idx);

              return (
                <div 
                  key={member.id} 
                  className={`flex items-center min-h-[52px] ${idx < teamMembers.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="w-14 flex-shrink-0 px-2 py-2 flex items-center justify-center group/avatar sticky left-0 z-20"
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                    }}
                  >
                    <div 
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg"
                      style={{ 
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(240,245,250,0.7) 50%, rgba(230,238,248,0.6) 100%)',
                        backdropFilter: 'blur(24px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                        border: '1.5px solid rgba(255, 255, 255, 0.8)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04), inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -1px 2px rgba(148,163,184,0.1)',
                        color: '#334155',
                      }}
                      title={member.name}
                    >
                      {initials}
                    </div>
                    <div className="absolute left-full ml-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/avatar:opacity-100 transition-all duration-200 pointer-events-none z-30 whitespace-nowrap px-2 py-1 rounded-md text-xs font-medium text-slate-700"
                      style={{
                        background: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(200,210,220,0.4)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                    >
                      {member.name}
                    </div>
                  </div>

                  <div className="flex-1 relative h-12">
                    <div className="absolute inset-0 flex">
                      {timelineMarkers.map((hour) => (
                        <div 
                          key={hour} 
                          className="flex-shrink-0 border-l border-gray-100"
                          style={{ width: HOUR_WIDTH }}
                        />
                      ))}
                    </div>

                    {currentTimePos !== null && (
                      <div 
                        className="absolute top-0 bottom-0 z-20 pointer-events-none"
                        style={{ 
                          left: currentTimePos,
                          width: '1px',
                          backgroundImage: 'repeating-linear-gradient(to bottom, rgba(239, 68, 68, 0.5) 0px, rgba(239, 68, 68, 0.5) 4px, transparent 4px, transparent 8px)'
                        }}
                      />
                    )}

                    {memberAppts.map((apt) => {
                      const { left, width } = getAppointmentStyle(apt);
                      const category = getTimeBasedCategory(apt);
                      const isUrgent = apt.urgency === 'High' || apt.urgency === 'Emergent';
                      const isHovered = hoveredAppointment === apt.id;

                      // Colors: pastel and more transparent
                      const cardBackground = category === 'complete' 
                        ? 'rgba(220, 252, 231, 0.45)' // pastel green, transparent
                        : category === 'active'
                        ? 'rgba(255, 237, 213, 0.45)' // pastel peach, transparent
                        : 'rgba(219, 234, 254, 0.45)'; // pastel blue, transparent

                      return (
                        <div
                          key={apt.id}
                          className="absolute top-1 bottom-1 cursor-pointer transition-all duration-200"
                          style={{ 
                            left, 
                            width,
                            zIndex: isHovered ? 30 : 10
                          }}
                          onMouseEnter={() => setHoveredAppointment(apt.id)}
                          onMouseLeave={() => setHoveredAppointment(null)}
                        >
                          <div
                            className="h-full flex overflow-hidden"
                            style={{ 
                              background: cardBackground,
                              backdropFilter: 'blur(8px)',
                              border: category === 'active' 
                                ? '1px solid rgba(251, 146, 60, 0.4)' // soft orange
                                : category === 'complete'
                                ? '1px solid rgba(134, 239, 172, 0.35)' // soft green
                                : '1px solid rgba(147, 197, 253, 0.4)', // soft blue
                              boxShadow: isHovered 
                                ? '0 4px 12px rgba(0,0,0,0.15)' 
                                : '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                          >
                            <div 
                              className="w-1 flex-shrink-0"
                              style={{ backgroundColor: teamColor }}
                            />
                            <div className="flex-1 px-2 py-1 flex items-center gap-1 min-w-0">
                              {isUrgent && (
                                <span className="flex-shrink-0 px-1 py-0.5 text-[7px] font-bold bg-amber-100 text-amber-700 rounded">
                                  !
                                </span>
                              )}
                              <span className="text-[10px] font-medium text-gray-700 truncate">
                                {apt.title || apt.customerName || 'Job'}
                              </span>
                              {category === 'complete' && (
                                <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0 ml-auto" />
                              )}
                            </div>
                          </div>

                          {isHovered && (
                            <div 
                              className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-[220px]"
                              style={{ maxWidth: '280px' }}
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-semibold text-gray-900 text-sm">
                                    {apt.title || 'Appointment'}
                                  </h4>
                                  {isUrgent && (
                                    <span className="px-1.5 py-0.5 text-[8px] font-bold bg-amber-100 text-amber-700 rounded">
                                      !
                                    </span>
                                  )}
                                </div>
                                
                                {apt.customerName && (
                                  <div className="text-xs">
                                    <span className="text-gray-500">Customer:</span>{' '}
                                    <span className="text-gray-700">{apt.customerName}</span>
                                  </div>
                                )}
                                
                                {apt.address && (
                                  <div className="text-xs">
                                    <span className="text-gray-500">Location:</span>{' '}
                                    <span className="text-gray-700">{apt.address}</span>
                                  </div>
                                )}
                                
                                <div className="text-xs">
                                  <span className="text-gray-500">Time:</span>{' '}
                                  <span className="text-gray-700">
                                    {format(parseISO(apt.scheduledStartAt), 'h:mm a')} - {format(parseISO(apt.scheduledEndAt), 'h:mm a')}
                                  </span>
                                </div>
                                
                                <div className="text-xs">
                                  <span className="text-gray-500">Status:</span>{' '}
                                  <span className={`font-medium ${
                                    category === 'complete' ? 'text-green-600' :
                                    category === 'active' ? 'text-amber-600' : 'text-blue-600'
                                  }`}>
                                    {category === 'complete' ? 'Completed' : 
                                     category === 'active' ? 'In Progress' : 'Scheduled'}
                                  </span>
                                </div>
                                
                                {category !== 'complete' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full mt-2 h-7 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markCompleteMutation.mutate(apt.id);
                                    }}
                                    disabled={markCompleteMutation.isPending}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Mark Complete
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
