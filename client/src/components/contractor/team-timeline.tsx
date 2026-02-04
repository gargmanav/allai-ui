import { useMemo } from "react";
import { format, parseISO, isToday, differenceInMinutes, startOfDay, addHours } from "date-fns";
import { Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  address?: string;
  customerName?: string;
}

interface TeamTimelineProps {
  teamMembers: TeamMember[];
  appointments: Appointment[];
  onViewCalendar?: () => void;
}

const HOUR_WIDTH = 60;
const TIMELINE_START = 6;
const TIMELINE_END = 20;
const TOTAL_HOURS = TIMELINE_END - TIMELINE_START;

export function TeamTimeline({ teamMembers, appointments, onViewCalendar }: TeamTimelineProps) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
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
      apt.contractorId === member.memberId || 
      apt.contractorId === member.id
    );
  };

  const getAppointmentStyle = (apt: Appointment) => {
    const start = parseISO(apt.scheduledStartAt);
    const end = parseISO(apt.scheduledEndAt);
    const dayStart = startOfDay(start);
    
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    
    const clampedStart = Math.max(startHour, TIMELINE_START);
    const clampedEnd = Math.min(endHour, TIMELINE_END);
    
    const left = (clampedStart - TIMELINE_START) * HOUR_WIDTH;
    const width = Math.max((clampedEnd - clampedStart) * HOUR_WIDTH, 40);
    
    return { left, width };
  };

  // Pastel colors with subtle gradients for softer visual appearance
  const getStatusStyle = (status?: string) => {
    switch (status) {
      case 'Confirmed': return { 
        gradient: 'linear-gradient(135deg, #93c5fd 0%, #a5b4fc 100%)', 
        text: 'text-blue-800',
        border: '1px solid rgba(147, 197, 253, 0.5)'
      };
      case 'Pending': return { 
        gradient: 'linear-gradient(135deg, #fde68a 0%, #fed7aa 100%)', 
        text: 'text-amber-800',
        border: '1px solid rgba(253, 230, 138, 0.5)'
      };
      case 'In Progress': return { 
        gradient: 'linear-gradient(135deg, #fdba74 0%, #f9a8d4 100%)', 
        text: 'text-orange-800',
        border: '1px solid rgba(253, 186, 116, 0.5)'
      };
      case 'Completed': return { 
        gradient: 'linear-gradient(135deg, #86efac 0%, #a7f3d0 100%)', 
        text: 'text-green-800',
        border: '1px solid rgba(134, 239, 172, 0.5)'
      };
      default: return { 
        gradient: 'linear-gradient(135deg, #d1d5db 0%, #e5e7eb 100%)', 
        text: 'text-gray-700',
        border: '1px solid rgba(209, 213, 219, 0.5)'
      };
    }
  };

  const getCurrentTimePosition = () => {
    if (currentHour < TIMELINE_START || currentHour > TIMELINE_END) return null;
    const hourOffset = currentHour - TIMELINE_START + currentMinute / 60;
    return hourOffset * HOUR_WIDTH;
  };

  const currentTimePos = getCurrentTimePosition();

  const summaryStats = useMemo(() => {
    const total = todaysAppointments.length;
    const remaining = todaysAppointments.filter(a => 
      ['Confirmed', 'Pending', 'Scheduled'].includes(a.status || '')
    ).length;
    const active = todaysAppointments.filter(a => a.status === 'In Progress').length;
    const complete = todaysAppointments.filter(a => a.status === 'Completed').length;
    return { total, remaining, active, complete };
  }, [todaysAppointments]);

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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Today's Appointments
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-sm font-bold text-gray-800">{summaryStats.total}</span>
              <span className="text-[9px] text-gray-500 uppercase tracking-wide">Total</span>
            </div>
            <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-blue-50 border border-blue-100">
              <span className="text-sm font-bold text-blue-700">{summaryStats.remaining}</span>
              <span className="text-[9px] text-blue-500 uppercase tracking-wide">Remaining</span>
            </div>
            <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-amber-50 border border-amber-100">
              <span className="text-sm font-bold text-amber-700">{summaryStats.active}</span>
              <span className="text-[9px] text-amber-500 uppercase tracking-wide">Active</span>
            </div>
            <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-green-50 border border-green-100">
              <span className="text-sm font-bold text-green-700">{summaryStats.complete}</span>
              <span className="text-[9px] text-green-500 uppercase tracking-wide">Complete</span>
            </div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-blue-600 hover:text-blue-700 h-7 text-xs font-medium"
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
          <div style={{ minWidth: TOTAL_HOURS * HOUR_WIDTH + 100 }}>
            <div className="flex items-center border-b border-gray-100 bg-gray-50/50">
              <div className="w-24 flex-shrink-0 px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
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

              return (
                <div 
                  key={member.id} 
                  className={`flex items-center min-h-[48px] ${idx < teamMembers.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="w-24 flex-shrink-0 px-3 py-2 flex items-center gap-2">
                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                      style={{ backgroundColor: member.color }}
                    >
                      {initials}
                    </div>
                    <span className="text-xs font-medium text-gray-700 truncate">{member.name.split(' ')[0]}</span>
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
                        className="absolute top-0 bottom-0 z-10"
                        style={{ 
                          left: currentTimePos,
                          width: '2px',
                          background: 'repeating-linear-gradient(to bottom, #f9a8a8 0px, #f9a8a8 4px, transparent 4px, transparent 8px)',
                          boxShadow: '0 0 4px rgba(249, 168, 168, 0.4)'
                        }}
                      >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-rose-300" />
                      </div>
                    )}

                    {memberAppts.map((apt) => {
                      const { left, width } = getAppointmentStyle(apt);
                      const style = getStatusStyle(apt.status);

                      return (
                        <div
                          key={apt.id}
                          className={`absolute top-1 bottom-1 rounded-md ${style.text} text-[10px] font-medium px-2 py-1 overflow-hidden cursor-pointer hover:opacity-95 transition-opacity`}
                          style={{ 
                            left, 
                            width, 
                            background: style.gradient,
                            border: style.border,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                          }}
                          title={`${apt.title || 'Appointment'} - ${apt.status}`}
                        >
                          <div className="truncate">{apt.title || apt.customerName || 'Job'}</div>
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
