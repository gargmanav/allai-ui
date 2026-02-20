import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Calendar, Users, Clock, MapPin } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, parseISO } from 'date-fns';

interface TeamMember {
  id: string;
  name: string;
  role?: string | null;
  color: string;
  specialty?: string;
}

interface Appointment {
  id: string;
  title?: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status?: string | null;
  contractorId: string;
  address?: string | null;
  customerName?: string;
}

interface TeamCalendarProps {
  teamMembers: TeamMember[];
  appointments: Appointment[];
  onAppointmentClick?: (appointment: Appointment) => void;
}

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => i);
const WORK_HOURS = { start: 7, end: 19 };

export function TeamCalendar({ teamMembers, appointments, onAppointmentClick }: TeamCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [visibleMembers, setVisibleMembers] = useState<Set<string>>(new Set(teamMembers.map(m => m.id)));

  const weekDays = useMemo(() => 
    Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  );

  const filteredAppointments = useMemo(() => 
    appointments.filter(apt => visibleMembers.has(apt.contractorId)),
    [appointments, visibleMembers]
  );

  const getAppointmentsForDayAndMember = (day: Date, memberId: string) => {
    return filteredAppointments.filter(apt => {
      const aptDate = parseISO(apt.scheduledStartAt);
      return isSameDay(aptDate, day) && apt.contractorId === memberId;
    });
  };

  const toggleMember = (memberId: string) => {
    setVisibleMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const selectAllMembers = () => {
    setVisibleMembers(new Set(teamMembers.map(m => m.id)));
  };

  const deselectAllMembers = () => {
    setVisibleMembers(new Set());
  };

  const getMemberColor = (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    return member?.color || '#3B82F6';
  };

  const formatTimeRange = (start: string, end: string) => {
    return `${format(parseISO(start), 'h:mm a')} - ${format(parseISO(end), 'h:mm a')}`;
  };

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex gap-4 h-[700px]">
      <Card className="w-64 flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2 mb-3">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={selectAllMembers}>
              All
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={deselectAllMembers}>
              None
            </Button>
          </div>
          <ScrollArea className="h-[550px]">
            <div className="space-y-2 pr-2">
              {teamMembers.map(member => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => toggleMember(member.id)}
                >
                  <Checkbox
                    checked={visibleMembers.has(member.id)}
                    onCheckedChange={() => toggleMember(member.id)}
                  />
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: member.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    {member.role && (
                      <p className="text-xs text-gray-500 truncate">{member.role}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
            </CardTitle>
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[620px]">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-8 border-b sticky top-0 bg-white dark:bg-gray-900 z-10">
                <div className="p-2 text-center text-xs font-medium text-gray-500 border-r">
                  Team
                </div>
                {weekDays.map((day, i) => (
                  <div
                    key={i}
                    className={`p-2 text-center border-r last:border-r-0 ${
                      isSameDay(day, new Date()) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="text-xs text-gray-500">{format(day, 'EEE')}</div>
                    <div className={`text-lg font-semibold ${
                      isSameDay(day, new Date()) ? 'text-blue-600' : ''
                    }`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              {teamMembers.filter(m => visibleMembers.has(m.id)).map((member) => (
                <div key={member.id} className="grid grid-cols-8 border-b">
                  <div className="p-2 border-r flex items-center gap-2 bg-gray-50 dark:bg-gray-800">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: member.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      {member.specialty && (
                        <p className="text-xs text-gray-500 truncate">{member.specialty}</p>
                      )}
                    </div>
                  </div>

                  {weekDays.map((day, i) => {
                    const dayAppointments = getAppointmentsForDayAndMember(day, member.id);
                    return (
                      <div
                        key={i}
                        className={`p-1 border-r last:border-r-0 min-h-[80px] ${
                          isSameDay(day, new Date()) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        {dayAppointments.map((apt) => (
                          <button
                            key={apt.id}
                            className="w-full text-left mb-1 p-1.5 rounded text-xs transition-all hover:shadow-md cursor-pointer"
                            style={{
                              backgroundColor: `${getMemberColor(apt.contractorId)}20`,
                              borderLeft: `3px solid ${getMemberColor(apt.contractorId)}`
                            }}
                            onClick={() => onAppointmentClick?.(apt)}
                          >
                            <div className="font-medium truncate">{apt.title || 'Appointment'}</div>
                            <div className="flex items-center gap-1 text-gray-500 mt-0.5">
                              <Clock className="h-3 w-3" />
                              <span className="truncate">{format(parseISO(apt.scheduledStartAt), 'h:mm a')}</span>
                            </div>
                            {apt.customerName && (
                              <div className="text-gray-600 truncate mt-0.5">{apt.customerName}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}

              {teamMembers.filter(m => visibleMembers.has(m.id)).length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Select team members to view their schedules</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
