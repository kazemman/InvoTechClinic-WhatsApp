import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { insertAppointmentSchema, type InsertAppointment } from '@shared/schema';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatTime, dateToLocalDateTimeString, localDateTimeStringToDate, roundToNearest30Minutes, getNextAvailable30MinuteSlot } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, User, CalendarPlus, Search, X, Send, Loader2 } from 'lucide-react';

function getSouthAfricanPublicHolidays(year: number): Date[] {
  const holidays = [
    new Date(year, 0, 1),
    new Date(year, 2, 21),
    new Date(year, 3, 27),
    new Date(year, 4, 1),
    new Date(year, 5, 16),
    new Date(year, 7, 9),
    new Date(year, 8, 24),
    new Date(year, 11, 16),
    new Date(year, 11, 25),
    new Date(year, 11, 26),
  ];
  
  const easterSunday = getEasterSunday(year);
  holidays.push(
    new Date(easterSunday.getTime() - 2 * 24 * 60 * 60 * 1000),
    new Date(easterSunday.getTime() + 1 * 24 * 60 * 60 * 1000)
  );
  
  return holidays;
}

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function isSouthAfricanPublicHoliday(date: Date): boolean {
  const holidays = getSouthAfricanPublicHolidays(date.getFullYear());
  return holidays.some(holiday => 
    holiday.getFullYear() === date.getFullYear() &&
    holiday.getMonth() === date.getMonth() &&
    holiday.getDate() === date.getDate()
  );
}

function isValidAppointmentDateTime(date: Date): { valid: boolean; error?: string } {
  const dayOfWeek = date.getDay();
  
  if (dayOfWeek === 0) {
    return { valid: false, error: 'Appointments are not available on Sundays' };
  }
  
  if (isSouthAfricanPublicHoliday(date)) {
    return { valid: false, error: 'Appointments are not available on public holidays' };
  }
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const openTime = 8 * 60;
    const closeTime = 17 * 60;
    
    if (timeInMinutes < openTime || timeInMinutes >= closeTime) {
      return { valid: false, error: 'Monday-Friday appointments are from 8:00 AM to 5:00 PM' };
    }
  } else if (dayOfWeek === 6) {
    const openTime = 8 * 60;
    const closeTime = 13 * 60;
    
    if (timeInMinutes < openTime || timeInMinutes >= closeTime) {
      return { valid: false, error: 'Saturday appointments are from 8:00 AM to 1:00 PM' };
    }
  }
  
  return { valid: true };
}

export default function Appointments() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [selectedWeeklyReminder, setSelectedWeeklyReminder] = useState<string | null>(null);
  const [selectedDailyReminder, setSelectedDailyReminder] = useState<string | null>(null);
  const [processingSendId, setProcessingSendId] = useState<string | null>(null);
  const [weeklyReminderMessage, setWeeklyReminderMessage] = useState("Hello [name and Lastname]! ⏰ Friendly reminder: You have an upcoming appointment in one week on Tuesday at 13:00 with Dr [name]. You can respond if you wish to reschedule.");
  const [dailyReminderMessage, setDailyReminderMessage] = useState("Hello [name and Last name] ⏰ Friendly reminder: You have an upcoming appointment tomorrow at [time]with Dr [name]. Please arrive 15 minutes before so you can be attended to on time.");
  const [dateTimeError, setDateTimeError] = useState<string | null>(null);
  const [appointmentDateOnly, setAppointmentDateOnly] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper functions for quick date selection
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const setToday = () => setSelectedDate(getTodayDate());
  const setTomorrow = () => setSelectedDate(getTomorrowDate());

  const isToday = selectedDate === getTodayDate();
  const isTomorrow = selectedDate === getTomorrowDate();

  // Helper functions for reminder status
  const getReminderStatus = (appointmentId: string, reminderType: 'weekly' | 'daily') => {
    if (!reminderStatuses) return null;
    const status = reminderStatuses.find((s: any) => s.appointmentId === appointmentId);
    if (!status) return null;
    return reminderType === 'weekly' ? status.weeklyReminder : status.dailyReminder;
  };

  const isReminderSent = (appointmentId: string, reminderType: 'weekly' | 'daily') => {
    const reminder = getReminderStatus(appointmentId, reminderType);
    // Check if reminder exists and has been sent (webhookResponse exists, even if empty string)
    return !!(reminder && reminder.hasOwnProperty('webhookResponse'));
  };

  const form = useForm<InsertAppointment>({
    resolver: zodResolver(insertAppointmentSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      appointmentDate: getNextAvailable30MinuteSlot(),
      appointmentType: '',
      notes: '',
    },
  });

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

  const { data: doctors, error: doctorsError, isLoading: doctorsLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      const users = await res.json();
      return users.filter((user: any) => user.role === 'doctor');
    },
  });

  const selectedDoctor = form.watch('doctorId');
  
  const { data: slotsResponse, isLoading: slotsLoading } = useQuery({
    queryKey: ['/api/appointments/available-slots', selectedDoctor, appointmentDateOnly],
    queryFn: async () => {
      if (!selectedDoctor || !appointmentDateOnly) return null;
      const res = await apiRequest('GET', `/api/appointments/available-slots?doctorId=${selectedDoctor}&date=${appointmentDateOnly}`);
      return res.json();
    },
    enabled: !!selectedDoctor && !!appointmentDateOnly,
  });

  const availableSlots = slotsResponse?.availableSlots || [];

  // Get weekly reminder candidates (appointments in 7 days)
  const { data: weeklyReminderCandidates, isLoading: loadingWeeklyReminders } = useQuery({
    queryKey: ['api', 'appointments', 'reminders', 'weekly'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/appointments/reminders/weekly');
      return res.json();
    },
  });

  // Get daily reminder candidates (appointments tomorrow)
  const { data: dailyReminderCandidates, isLoading: loadingDailyReminders } = useQuery({
    queryKey: ['api', 'appointments', 'reminders', 'daily'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/appointments/reminders/daily');
      return res.json();
    },
  });

  // Get reminder statuses for all candidates
  const { data: reminderStatuses } = useQuery({
    queryKey: ['api', 'appointments', 'reminders', 'statuses'],
    queryFn: async () => {
      const allAppointmentIds = [
        ...(weeklyReminderCandidates?.map((apt: any) => apt.id) || []),
        ...(dailyReminderCandidates?.map((apt: any) => apt.id) || [])
      ];
      
      if (allAppointmentIds.length === 0) return [];
      
      const res = await apiRequest('POST', '/api/appointments/reminders/statuses', { 
        appointmentIds: allAppointmentIds 
      });
      return res.json();
    },
    enabled: !!(weeklyReminderCandidates || dailyReminderCandidates),
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
      // Preserve doctor selection for convenience, but reset other fields
      const currentDoctorId = form.getValues('doctorId');
      form.reset({
        patientId: '',
        doctorId: currentDoctorId, // Keep the same doctor selected
        appointmentDate: getNextAvailable30MinuteSlot(),
        appointmentType: '',
        notes: '',
      });
      // Clear patient selection state
      setSelectedPatient(null);
      setPatientSearchQuery('');
      setShowPatientResults(false);
      // Clear time slot selection
      setSelectedTimeSlot('');
      setAppointmentDateOnly(new Date().toISOString().split('T')[0]);
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/available-slots'] });
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
    // Debug logging
    console.log('🔍 Form submission data:', data);
    console.log('🔍 Current form values:', form.getValues());
    
    // Check if required fields are filled
    if (!data.patientId) {
      console.error('❌ Missing patientId in form data');
      toast({
        title: 'Missing Patient',
        description: 'Please select a patient before booking the appointment.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!data.doctorId) {
      console.error('❌ Missing doctorId in form data');
      toast({
        title: 'Missing Doctor',
        description: 'Please select a doctor before booking the appointment.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!data.appointmentType) {
      console.error('❌ Missing appointmentType in form data');
      toast({
        title: 'Missing Appointment Type',
        description: 'Please select an appointment type before booking.',
        variant: 'destructive',
      });
      return;
    }
    
    const validation = isValidAppointmentDateTime(data.appointmentDate);
    if (!validation.valid) {
      toast({
        title: 'Invalid Date/Time',
        description: validation.error || 'Please select a valid appointment date and time.',
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

  // Send appointment reminders mutation
  const sendRemindersMutation = useMutation({
    mutationFn: async ({ appointmentIds, reminderType, customMessage }: { appointmentIds: string[], reminderType: 'weekly' | 'daily', customMessage?: string }) => {
      const res = await apiRequest('POST', `/api/appointments/reminders/${reminderType}`, { appointmentIds, customMessage });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Reminder sent!",
        description: "Appointment reminder has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['api', 'appointments', 'reminders'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'appointments', 'reminders', 'statuses'] });
      setSelectedWeeklyReminder(null);
      setSelectedDailyReminder(null);
      setProcessingSendId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send reminder",
        description: error.message || "An error occurred while sending the reminder.",
        variant: "destructive",
      });
      setProcessingSendId(null);
    },
  });

  // Check if any reminder is being processed
  const isAnyProcessing = () => {
    return processingSendId !== null;
  };

  const isProcessingReminder = (appointmentId: string) => {
    return processingSendId === appointmentId;
  };

  const sendWeeklyReminder = () => {
    if (!selectedWeeklyReminder) {
      toast({
        title: "No appointment selected",
        description: "Please select an appointment to send weekly reminder.",
        variant: "destructive",
      });
      return;
    }
    setProcessingSendId(selectedWeeklyReminder);
    sendRemindersMutation.mutate({ 
      appointmentIds: [selectedWeeklyReminder], 
      reminderType: 'weekly',
      customMessage: weeklyReminderMessage
    });
  };

  const sendDailyReminder = () => {
    if (!selectedDailyReminder) {
      toast({
        title: "No appointment selected",
        description: "Please select an appointment to send daily reminder.",
        variant: "destructive",
      });
      return;
    }
    setProcessingSendId(selectedDailyReminder);
    sendRemindersMutation.mutate({ 
      appointmentIds: [selectedDailyReminder], 
      reminderType: 'daily',
      customMessage: dailyReminderMessage
    });
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
                      {doctorsLoading && <p className="text-sm text-muted-foreground">Loading doctors...</p>}
                      {doctorsError && <p className="text-sm text-red-500">Error loading doctors: {(doctorsError as Error).message}</p>}
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={doctorsLoading || !!doctorsError}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-doctor">
                            <SelectValue placeholder={doctorsLoading ? "Loading..." : "Select doctor"} />
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

                <div className="space-y-4">
                  <FormItem>
                    <FormLabel>Appointment Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={appointmentDateOnly}
                        onChange={(e) => {
                          setAppointmentDateOnly(e.target.value);
                          setSelectedTimeSlot('');
                        }}
                        data-testid="input-appointment-date"
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      Monday-Friday: 8:00 AM - 5:00 PM • Saturday: 8:00 AM - 1:00 PM
                    </p>
                  </FormItem>

                  <FormField
                    control={form.control}
                    name="appointmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Time Slots *</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            {!selectedDoctor && (
                              <p className="text-sm text-muted-foreground">
                                Please select a doctor first to see available time slots
                              </p>
                            )}
                            {selectedDoctor && slotsLoading && (
                              <p className="text-sm text-muted-foreground">
                                Loading available slots...
                              </p>
                            )}
                            {selectedDoctor && !slotsLoading && availableSlots && availableSlots.length === 0 && (
                              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                                No available slots for this date. Please select another date.
                              </p>
                            )}
                            {selectedDoctor && !slotsLoading && availableSlots && availableSlots.length > 0 && (
                              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2 border rounded-lg">
                                {availableSlots.map((slot: string) => (
                                  <Button
                                    key={slot}
                                    type="button"
                                    variant={selectedTimeSlot === slot ? "default" : "outline"}
                                    size="sm"
                                    className="h-9"
                                    onClick={() => {
                                      setSelectedTimeSlot(slot);
                                      const [hours, minutes] = slot.split(':');
                                      const appointmentDateTime = new Date(appointmentDateOnly);
                                      appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                      field.onChange(appointmentDateTime);
                                      setDateTimeError(null);
                                    }}
                                    data-testid={`button-timeslot-${slot}`}
                                  >
                                    {slot}
                                  </Button>
                                ))}
                              </div>
                            )}
                            {dateTimeError && (
                              <p className="text-sm text-red-500 font-medium">
                                {dateTimeError}
                              </p>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="appointmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appointment Type *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          console.log('🔍 Appointment type selected:', value);
                          field.onChange(value);
                        }} 
                        value={field.value}
                      >
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
                  disabled={createAppointmentMutation.isPending || !!dateTimeError}
                  data-testid="button-schedule-appointment"
                >
                  {createAppointmentMutation.isPending ? 'Scheduling...' : 'Schedule Appointment'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Appointments Schedule
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <Button
                    variant={isToday ? "default" : "outline"}
                    size="sm"
                    onClick={setToday}
                    data-testid="button-today"
                    className="flex items-center gap-1"
                  >
                    <Calendar className="w-4 h-4" />
                    Today
                  </Button>
                  <Button
                    variant={isTomorrow ? "default" : "outline"}
                    size="sm"
                    onClick={setTomorrow}
                    data-testid="button-tomorrow"
                    className="flex items-center gap-1"
                  >
                    <Calendar className="w-4 h-4" />
                    Tomorrow
                  </Button>
                </div>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                  data-testid="input-date-filter"
                />
              </div>
            </div>
            <CardDescription className="flex items-center justify-between">
              <span>Manage and track appointment status</span>
              <span className="text-sm font-medium">
                Viewing: {formatDate(selectedDate)}
                {isToday && " (Today)"}
                {isTomorrow && " (Tomorrow)"}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointments && appointments.length > 0 ? (
                appointments.map((appointment: any) => (
                  <div key={appointment.id} className="border rounded-lg p-4 hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-lg font-bold text-foreground">
                            {formatTime(appointment.appointmentDate)}
                          </div>
                        </div>
                        <div className="flex-1">
                          {/* Patient name prominently displayed */}
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-5 h-5 text-primary" />
                            <span className="text-lg font-semibold text-foreground" data-testid={`text-patient-${appointment.id}`}>
                              {appointment.patient?.firstName} {appointment.patient?.lastName}
                            </span>
                          </div>
                          {/* Appointment type prominently displayed */}
                          <div className="text-base font-medium text-foreground mb-1">
                            {appointment.appointmentType}
                          </div>
                          {/* Doctor name as secondary information */}
                          <div className="text-sm text-muted-foreground">
                            Dr. {appointment.doctor?.name}
                          </div>
                          {appointment.notes && (
                            <div className="text-sm text-muted-foreground mt-2 italic">
                              {appointment.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeClass(appointment.status)}`}
                          data-testid={`badge-status-${appointment.id}`}
                        >
                          {appointment.status.replace('_', ' ')}
                        </Badge>
                        <div className="flex gap-1">
                          {appointment.status === 'scheduled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                              data-testid={`button-confirm-${appointment.id}`}
                            >
                              Confirm
                            </Button>
                          )}
                          {(appointment.status === 'confirmed' || appointment.status === 'scheduled') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                              data-testid={`button-cancel-${appointment.id}`}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-appointments">
                  No appointments scheduled for {formatDate(selectedDate)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointment Reminders Section - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Appointment Reminders
          </CardTitle>
          <CardDescription>
            Send automatic reminders to patients with upcoming appointments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 1-Week Reminders */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <h3 className="text-lg font-semibold">1-Week Reminders</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Send reminders to patients with appointments in 7 days
              </p>
              
              {/* Message field for weekly reminders */}
              <div className="space-y-2">
                <label htmlFor="weekly-message" className="text-sm font-medium">
                  Reminder Message
                </label>
                <Textarea
                  id="weekly-message"
                  value={weeklyReminderMessage}
                  onChange={(e) => setWeeklyReminderMessage(e.target.value)}
                  rows={3}
                  className="text-sm"
                  data-testid="textarea-weekly-reminder-message"
                />
              </div>
              
              <div className="border rounded-lg p-4 min-h-[200px]">
                {loadingWeeklyReminders ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading weekly reminders...</span>
                  </div>
                ) : weeklyReminderCandidates?.length > 0 ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {weeklyReminderCandidates.map((appointment: any) => (
                        <div key={appointment.id} className={`flex items-center justify-between p-3 border rounded-lg ${selectedWeeklyReminder === appointment.id ? 'border-blue-500 bg-blue-50/50' : ''}`}>
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              id={`radio-weekly-${appointment.id}`}
                              name="weekly-reminder"
                              checked={selectedWeeklyReminder === appointment.id}
                              onChange={() => setSelectedWeeklyReminder(appointment.id)}
                              disabled={isReminderSent(appointment.id, 'weekly') || isAnyProcessing()}
                              className="h-4 w-4 text-blue-600"
                              data-testid={`radio-weekly-reminder-${appointment.id}`}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {appointment.patient?.firstName} {appointment.patient?.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(appointment.appointmentDate).toLocaleDateString()} at {new Date(appointment.appointmentDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {appointment.appointmentType} • Dr. {appointment.doctor?.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isReminderSent(appointment.id, 'weekly') ? (
                              <Badge variant="secondary" data-testid={`badge-sent-weekly-${appointment.id}`}>
                                <Send className="h-3 w-3 mr-1" />
                                Sent
                              </Badge>
                            ) : isProcessingReminder(appointment.id) ? (
                              <Badge variant="outline" data-testid={`badge-sending-weekly-${appointment.id}`}>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Sending...
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t">
                      <div className="text-sm text-muted-foreground">
                        {selectedWeeklyReminder ? 
                          `Selected: ${weeklyReminderCandidates.find((a: any) => a.id === selectedWeeklyReminder)?.patient?.firstName} ${weeklyReminderCandidates.find((a: any) => a.id === selectedWeeklyReminder)?.patient?.lastName}` 
                          : 'No appointment selected'
                        }
                      </div>
                      <Button 
                        size="sm"
                        onClick={sendWeeklyReminder}
                        disabled={!selectedWeeklyReminder || isAnyProcessing() || Boolean(selectedWeeklyReminder && isReminderSent(selectedWeeklyReminder, 'weekly'))}
                        data-testid="button-send-weekly-reminder"
                      >
                        {isAnyProcessing() ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Send Weekly Reminder
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No appointments in 7 days</p>
                  </div>
                )}
              </div>
            </div>

            {/* 24-Hour Reminders */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <h3 className="text-lg font-semibold">24-Hour Reminders</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Send reminders to patients with appointments tomorrow
              </p>
              
              {/* Message field for daily reminders */}
              <div className="space-y-2">
                <label htmlFor="daily-message" className="text-sm font-medium">
                  Reminder Message
                </label>
                <Textarea
                  id="daily-message"
                  value={dailyReminderMessage}
                  onChange={(e) => setDailyReminderMessage(e.target.value)}
                  rows={3}
                  className="text-sm"
                  data-testid="textarea-daily-reminder-message"
                />
              </div>
              
              <div className="border rounded-lg p-4 min-h-[200px]">
                {loadingDailyReminders ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading daily reminders...</span>
                  </div>
                ) : dailyReminderCandidates?.length > 0 ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {dailyReminderCandidates.map((appointment: any) => (
                        <div key={appointment.id} className={`flex items-center justify-between p-3 border rounded-lg ${selectedDailyReminder === appointment.id ? 'border-orange-500 bg-orange-50/50' : ''}`}>
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              id={`radio-daily-${appointment.id}`}
                              name="daily-reminder"
                              checked={selectedDailyReminder === appointment.id}
                              onChange={() => setSelectedDailyReminder(appointment.id)}
                              disabled={isReminderSent(appointment.id, 'daily') || isAnyProcessing()}
                              className="h-4 w-4 text-orange-600"
                              data-testid={`radio-daily-reminder-${appointment.id}`}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {appointment.patient?.firstName} {appointment.patient?.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(appointment.appointmentDate).toLocaleDateString()} at {new Date(appointment.appointmentDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {appointment.appointmentType} • Dr. {appointment.doctor?.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isReminderSent(appointment.id, 'daily') ? (
                              <Badge variant="secondary" data-testid={`badge-sent-daily-${appointment.id}`}>
                                <Send className="h-3 w-3 mr-1" />
                                Sent
                              </Badge>
                            ) : isProcessingReminder(appointment.id) ? (
                              <Badge variant="outline" data-testid={`badge-sending-daily-${appointment.id}`}>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Sending...
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t">
                      <div className="text-sm text-muted-foreground">
                        {selectedDailyReminder ? 
                          `Selected: ${dailyReminderCandidates.find((a: any) => a.id === selectedDailyReminder)?.patient?.firstName} ${dailyReminderCandidates.find((a: any) => a.id === selectedDailyReminder)?.patient?.lastName}` 
                          : 'No appointment selected'
                        }
                      </div>
                      <Button 
                        size="sm"
                        onClick={sendDailyReminder}
                        disabled={!selectedDailyReminder || isAnyProcessing() || Boolean(selectedDailyReminder && isReminderSent(selectedDailyReminder, 'daily'))}
                        data-testid="button-send-daily-reminder"
                      >
                        {isAnyProcessing() ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Send Daily Reminder
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No appointments tomorrow</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}