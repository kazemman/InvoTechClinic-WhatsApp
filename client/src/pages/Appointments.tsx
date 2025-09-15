import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { insertAppointmentSchema, type InsertAppointment } from '@shared/schema';
import { z } from 'zod';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatTime, dateToLocalDateTimeString, localDateTimeStringToDate, roundToNearestThirtyMinutes, isThirtyMinuteInterval } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, User, CalendarPlus, Search, X, AlertTriangle, CheckCircle, Users, MapPin } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Appointments() {
  const [selectedTab, setSelectedTab] = useState('today');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [timeConflictError, setTimeConflictError] = useState<string>('');
  
  // Helper function to convert Date to local YYYY-MM-DD format without UTC conversion
  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate today and tomorrow dates using local timezone
  const todayDate = new Date();
  const tomorrowDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + 1);
  const selectedDate = selectedTab === 'today' ? toLocalDateString(todayDate) : toLocalDateString(tomorrowDate);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertAppointment>({
    resolver: zodResolver(insertAppointmentSchema.extend({
      appointmentDate: z.date().refine((date) => {
        return isThirtyMinuteInterval(date);
      }, {
        message: 'Appointment time must be on the hour (:00) or half-hour (:30)'
      })
    })),
    defaultValues: {
      patientId: '',
      doctorId: '',
      appointmentDate: roundToNearestThirtyMinutes(new Date()),
      appointmentType: '',
      notes: '',
    },
  });

  // Watch form values for real-time conflict checking
  const watchedDoctorId = form.watch('doctorId');
  const watchedAppointmentDate = form.watch('appointmentDate');

  // Get all appointments for conflict checking (not just today/tomorrow)
  const { data: allAppointments } = useQuery({
    queryKey: ['/api/appointments/all'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/appointments/all');
      return res.json();
    },
  });

  // Check for appointment conflicts in real-time
  const appointmentConflict = useMemo(() => {
    if (!watchedDoctorId || !watchedAppointmentDate || !allAppointments) {
      return null;
    }

    const selectedDateTime = new Date(watchedAppointmentDate);
    const selectedTime = selectedDateTime.getTime();

    // Find conflicting appointments for the same doctor at the same time
    const conflict = allAppointments.find((appointment: any) => {
      // Only check active appointments (not cancelled or completed)
      if (['cancelled', 'completed'].includes(appointment.status)) {
        return false;
      }

      // Check if same doctor and same time slot
      const appointmentDateTime = new Date(appointment.appointmentDate);
      const appointmentTime = appointmentDateTime.getTime();

      return (
        appointment.doctorId === watchedDoctorId &&
        appointmentTime === selectedTime
      );
    });

    return conflict;
  }, [watchedDoctorId, watchedAppointmentDate, allAppointments]);

  // Generate time slots for availability overview
  const generateTimeSlots = () => {
    const slots = [];
    const startHour = 8; // 8 AM
    const endHour = 18; // 6 PM
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const datetime = new Date(selectedDate + 'T' + time + ':00');
        slots.push({
          time,
          datetime,
          displayTime: datetime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Get slot occupancy for the day
  const getSlotOccupancy = (slotTime: string) => {
    if (!appointments) return [];
    
    return appointments.filter((appointment: any) => {
      if (['cancelled', 'completed'].includes(appointment.status)) return false;
      
      const appointmentTime = formatTime(appointment.appointmentDate);
      return appointmentTime === slotTime;
    });
  };

  // Check if appointments have conflicts (same doctor, same time)
  const hasConflict = (appointment: any) => {
    if (!allAppointments) return false;
    
    const appointmentTime = new Date(appointment.appointmentDate).getTime();
    const conflicts = allAppointments.filter((other: any) => {
      if (other.id === appointment.id) return false;
      if (['cancelled', 'completed'].includes(other.status)) return false;
      
      const otherTime = new Date(other.appointmentDate).getTime();
      return (
        other.doctorId === appointment.doctorId &&
        otherTime === appointmentTime
      );
    });
    
    return conflicts.length > 0;
  };

  // Get time slot end time for better display
  const getTimeSlotRange = (appointmentDate: string) => {
    const start = new Date(appointmentDate);
    const end = new Date(start.getTime() + 30 * 60000); // Add 30 minutes
    
    return {
      start: formatTime(start),
      end: formatTime(end)
    };
  };

  const { data: doctors } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      const users = await res.json();
      return users.filter((user: any) => user.role === 'doctor');
    },
  });

  // Update conflict error state when conflict status changes
  useEffect(() => {
    if (appointmentConflict) {
      const conflictDoctor = doctors?.find((d: any) => d.id === appointmentConflict.doctorId);
      const conflictTime = formatTime(appointmentConflict.appointmentDate);
      const conflictDate = formatDate(appointmentConflict.appointmentDate);
      setTimeConflictError(
        `This time slot (${conflictTime} on ${conflictDate}) is already booked for Dr. ${conflictDoctor?.name || 'Unknown'}. Please select a different time.`
      );
    } else {
      setTimeConflictError('');
    }
  }, [appointmentConflict, doctors]);

  const { data: appointments } = useQuery({
    queryKey: ['/api/appointments', selectedDate],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/appointments?date=${selectedDate}`);
      return res.json();
    },
  });

  const { data: patientSearchResults } = useQuery({
    queryKey: ['/api/patients/search', patientSearchQuery],
    queryFn: async () => {
      if (!patientSearchQuery.trim()) return [];
      const res = await apiRequest('GET', `/api/patients/search?q=${encodeURIComponent(patientSearchQuery)}`);
      return res.json();
    },
    enabled: patientSearchQuery.length > 2,
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: InsertAppointment) => {
      const res = await apiRequest('POST', '/api/appointments', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Appointment Scheduled',
        description: 'The appointment has been successfully scheduled.',
      });
      form.reset({
        patientId: '',
        doctorId: '',
        appointmentDate: roundToNearestThirtyMinutes(new Date()),
        appointmentType: '',
        notes: '',
      });
      // Clear patient selection state and conflict error
      setSelectedPatient(null);
      setPatientSearchQuery('');
      setShowPatientResults(false);
      setTimeConflictError('');
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: (error) => {
      toast({
        title: 'Scheduling Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<InsertAppointment>) => {
      const res = await apiRequest('PUT', `/api/appointments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Appointment Updated',
        description: 'The appointment has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/all'] });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const selectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setPatientSearchQuery('');
    setShowPatientResults(false);
    form.setValue('patientId', patient.id);
  };

  const clearSelectedPatient = () => {
    setSelectedPatient(null);
    setPatientSearchQuery('');
    setShowPatientResults(false);
    form.setValue('patientId', '');
  };

  const onSubmit = (data: InsertAppointment) => {
    // Prevent submission if there's an appointment conflict
    if (appointmentConflict) {
      toast({
        title: 'Cannot Schedule Appointment',
        description: 'Please resolve the time conflict before scheduling.',
        variant: 'destructive',
      });
      return;
    }
    createAppointmentMutation.mutate(data);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'scheduled': return 'badge-waiting';
      case 'confirmed': return 'badge-in-progress';
      case 'in_progress': return 'badge-in-progress';
      case 'completed': return 'badge-completed';
      case 'cancelled': return 'badge-urgent';
      default: return 'badge-waiting';
    }
  };

  const updateAppointmentStatus = (id: string, status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled') => {
    updateAppointmentMutation.mutate({ id, status });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Schedule and manage patient appointments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointment Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5" />
              Schedule Appointment
            </CardTitle>
            <CardDescription>
              Book new appointments with automatic conflict prevention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Patient *</FormLabel>
                      <div className="space-y-2">
                        {selectedPatient ? (
                          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                {selectedPatient.photoUrl && <AvatarImage src={selectedPatient.photoUrl} />}
                                <AvatarFallback className="text-sm">
                                  {selectedPatient.firstName.charAt(0)}{selectedPatient.lastName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm" data-testid="text-selected-patient">
                                  {selectedPatient.firstName} {selectedPatient.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">{selectedPatient.phone}</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={clearSelectedPatient}
                              data-testid="button-clear-patient"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="relative">
                              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                              <Input
                                placeholder="Search by name, phone, or ID number..."
                                value={patientSearchQuery}
                                onChange={(e) => {
                                  setPatientSearchQuery(e.target.value);
                                  setShowPatientResults(e.target.value.length > 2);
                                }}
                                className="pl-10"
                                data-testid="input-patient-search"
                              />
                            </div>
                            
                            {showPatientResults && patientSearchResults && patientSearchResults.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-auto">
                                {patientSearchResults.map((patient: any) => (
                                  <div
                                    key={patient.id}
                                    className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                                    onClick={() => selectPatient(patient)}
                                    data-testid={`patient-search-result-${patient.id}`}
                                  >
                                    <Avatar className="w-8 h-8">
                                      {patient.photoUrl && <AvatarImage src={patient.photoUrl} />}
                                      <AvatarFallback className="text-sm">
                                        {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">
                                        {patient.firstName} {patient.lastName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {patient.phone} • ID: {patient.idNumber}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {showPatientResults && patientSearchResults && patientSearchResults.length === 0 && patientSearchQuery.length > 2 && (
                              <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg p-3 text-sm text-muted-foreground text-center">
                                No patients found matching "{patientSearchQuery}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="doctorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doctor *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-doctor">
                            <SelectValue placeholder="Select doctor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {doctors?.map((doctor: any) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              {doctor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date & Time *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="datetime-local"
                          step="1800"
                          value={field.value instanceof Date ? 
                            dateToLocalDateTimeString(field.value) : ''}
                          onChange={(e) => {
                            const selectedDate = localDateTimeStringToDate(e.target.value);
                            // Always round to nearest 30-minute interval to ensure consistency
                            field.onChange(roundToNearestThirtyMinutes(selectedDate));
                          }}
                          data-testid="input-appointment-datetime"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Appointments can only be scheduled at 30-minute intervals (:00 or :30)
                      </p>
                      {appointmentConflict && (
                        <Alert className="mt-2 border-destructive/50 text-destructive" data-testid="alert-time-conflict">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            {timeConflictError}
                          </AlertDescription>
                        </Alert>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appointmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appointment Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-appointment-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="General Checkup">General Checkup</SelectItem>
                          <SelectItem value="Follow-up">Follow-up</SelectItem>
                          <SelectItem value="Consultation">Consultation</SelectItem>
                          <SelectItem value="Annual Physical">Annual Physical</SelectItem>
                          <SelectItem value="Pediatric Consultation">Pediatric Consultation</SelectItem>
                          <SelectItem value="Specialist Referral">Specialist Referral</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          value={field.value || ''} 
                          placeholder="Additional notes..."
                          data-testid="input-appointment-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createAppointmentMutation.isPending || !!appointmentConflict}
                  data-testid="button-schedule-appointment"
                >
                  {createAppointmentMutation.isPending ? 'Scheduling...' : 
                   appointmentConflict ? 'Time Slot Conflict' : 'Schedule Appointment'}
                </Button>
                {appointmentConflict && (
                  <p className="text-xs text-muted-foreground text-center mt-2" data-testid="text-conflict-help">
                    Please resolve the time conflict before scheduling
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Appointments Schedule
            </CardTitle>
            <CardDescription>
              Manage and track appointment status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="today" data-testid="tab-today">Today</TabsTrigger>
                <TabsTrigger value="tomorrow" data-testid="tab-tomorrow">Tomorrow</TabsTrigger>
              </TabsList>
              <TabsContent value={selectedTab} className="mt-0">
            {/* Time Slot Availability Overview */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Time Slot Overview for {selectedTab === 'today' ? 'Today' : 'Tomorrow'}
              </h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">
                {timeSlots.map((slot) => {
                  const occupancy = getSlotOccupancy(slot.time);
                  const isOccupied = occupancy.length > 0;
                  const hasMultipleBookings = occupancy.length > 1;
                  
                  return (
                    <div
                      key={slot.time}
                      className={`time-grid-slot text-xs ${
                        hasMultipleBookings
                          ? 'conflict'
                          : isOccupied
                          ? 'occupied'
                          : 'available'
                      }`}
                      title={`${slot.displayTime} - ${hasMultipleBookings ? 'Conflict!' : isOccupied ? 'Booked' : 'Available'}`}
                      data-testid={`time-slot-${slot.time}`}
                    >
                      {slot.displayTime.replace(' ', '').toLowerCase()}
                      {hasMultipleBookings && (
                        <AlertTriangle className="w-3 h-3 mx-auto mt-1" />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-200 border border-green-300 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-200 border border-blue-300 rounded"></div>
                  <span>Booked</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-200 border border-red-300 rounded"></div>
                  <span>Conflict</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {appointments && appointments.length > 0 ? (
                appointments.map((appointment: any) => {
                  const isConflicted = hasConflict(appointment);
                  const timeRange = getTimeSlotRange(appointment.appointmentDate);
                  
                  return (
                    <div 
                      key={appointment.id} 
                      className={`appointment-slot status-${appointment.status} ${isConflicted ? 'has-conflict' : ''} rounded-lg overflow-hidden`}
                      data-testid={`appointment-card-${appointment.id}`}
                    >
                      <div className="flex items-stretch">
                        {/* Time Slot Indicator */}
                        <div className="time-slot-indicator">
                          <div className="text-lg font-bold text-foreground">
                            {formatTime(appointment.appointmentDate)}
                          </div>
                          <div className="time-slot-duration">
                            30 min slot
                          </div>
                          {isConflicted && (
                            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 mt-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span className="text-xs">Conflict!</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Appointment Content */}
                        <div className="appointment-content">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold text-foreground" data-testid={`text-patient-${appointment.id}`}>
                                {appointment.patient?.firstName} {appointment.patient?.lastName}
                              </span>
                              <Badge 
                                className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeClass(appointment.status)}`}
                                data-testid={`badge-status-${appointment.id}`}
                              >
                                {appointment.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span>{appointment.appointmentType}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Users className="w-4 h-4" />
                              <span>Dr. {appointment.doctor?.name}</span>
                            </div>
                          </div>
                          
                          {appointment.notes && (
                            <div className="text-sm text-muted-foreground mt-2 p-2 bg-muted/50 rounded border-l-2 border-muted-foreground/20">
                              <span className="font-medium">Notes:</span> {appointment.notes}
                            </div>
                          )}
                          
                          {isConflicted && (
                            <div className="flex items-center gap-2 mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-sm text-orange-700 dark:text-orange-300">
                              <AlertTriangle className="w-4 h-4" />
                              <span>Time conflict detected with another appointment</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Appointment Actions */}
                        <div className="appointment-actions">
                          <div className="flex flex-col gap-2">
                            {appointment.status === 'scheduled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                                data-testid={`button-confirm-${appointment.id}`}
                                className="text-xs"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Confirm
                              </Button>
                            )}
                            {(appointment.status === 'confirmed' || appointment.status === 'scheduled') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                                data-testid={`button-cancel-${appointment.id}`}
                                className="text-xs"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <div className="text-muted-foreground" data-testid="text-no-appointments">
                    <p className="font-medium">No appointments scheduled</p>
                    <p className="text-sm">for {formatDate(selectedDate)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    All time slots are available for booking
                  </p>
                </div>
              )}
            </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
