import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { insertCheckInSchema, type InsertCheckIn } from '@shared/schema';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { formatTime } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, ClipboardCheck, Clock, User, AlertCircle } from 'lucide-react';
import { z } from 'zod';

export default function CheckIn() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extended form schema with conditional payment amount validation
  const checkInFormSchema = insertCheckInSchema.extend({
    doctorId: z.string().min(1, 'Doctor is required'),
    priority: z.number().default(0),
    paymentAmount: z.coerce.number().optional()
  }).superRefine((data, ctx) => {
    // Require payment amount for cash and both payment methods
    if ((data.paymentMethod === 'cash' || data.paymentMethod === 'both') && !data.paymentAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment amount is required for cash payments',
        path: ['paymentAmount'],
      });
    }
    
    // Validate positive amount when provided
    if (data.paymentAmount !== undefined && data.paymentAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment amount must be greater than 0',
        path: ['paymentAmount'],
      });
    }
    
    // Validate medical aid eligibility
    if ((data.paymentMethod === 'medical_aid' || data.paymentMethod === 'both')) {
      const patient = selectedPatient;
      if (!patient?.medicalAidScheme || !patient?.medicalAidNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selected patient is not eligible for medical aid payment',
          path: ['paymentMethod'],
        });
      }
    }
  });

  const form = useForm<InsertCheckIn & { doctorId: string; priority: number; paymentAmount?: number }>({
    resolver: zodResolver(checkInFormSchema),
    defaultValues: {
      patientId: '',
      appointmentId: '',
      paymentMethod: 'cash',
      isWalkIn: false,
      doctorId: '',
      priority: 0,
      paymentAmount: undefined,
    },
  });

  const selectedPaymentMethod = form.watch('paymentMethod');
  const showPaymentAmount = selectedPaymentMethod === 'cash' || selectedPaymentMethod === 'both';

  const { data: searchResults } = useQuery({
    queryKey: ['/api/patients/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await apiRequest('GET', `/api/patients/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length > 2,
  });

  const { data: todayAppointments } = useQuery({
    queryKey: ['/api/appointments', new Date().toISOString().split('T')[0]],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await apiRequest('GET', `/api/appointments?date=${today}`);
      return res.json();
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      const users = await res.json();
      return users.filter((user: any) => user.role === 'doctor');
    },
  });


  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: string; status: string }) => {
      const res = await apiRequest('PUT', `/api/appointments/${appointmentId}`, { status });
      return res.json();
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (data: InsertCheckIn & { doctorId: string; priority: number; paymentAmount?: number }) => {
      const res = await apiRequest('POST', '/api/checkins', data);
      return res.json();
    },
    onSuccess: async (checkIn) => {
      // If this was an appointment check-in, update the appointment status
      if (checkIn.appointmentId) {
        try {
          await updateAppointmentMutation.mutateAsync({
            appointmentId: checkIn.appointmentId,
            status: 'confirmed'
          });
        } catch (error) {
          console.error('Failed to update appointment status:', error);
        }
      }

      toast({
        title: 'Check-in Successful',
        description: `Patient has been checked in and added to the queue.`,
      });
      form.reset();
      setSelectedPatient(null);
      setSearchQuery('');
      queryClient.invalidateQueries({ queryKey: ['/api/checkins'] });
      queryClient.invalidateQueries({ queryKey: ['/api/queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    },
    onError: (error: any) => {
      console.error('Check-in error:', error);
      
      // Handle specific validation errors
      let errorMessage = error.message || 'Failed to check in patient';
      
      if (error.message?.includes('payment amount')) {
        errorMessage = 'Please enter a valid payment amount for cash payments';
      } else if (error.message?.includes('medical aid')) {
        errorMessage = 'This patient is not eligible for medical aid payment';
      } else if (error.message?.includes('required')) {
        errorMessage = 'Please fill in all required fields';
      }
      
      toast({
        title: 'Check-in Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const selectPatient = (patient: any, appointmentId?: string, doctorId?: string) => {
    const previousPatient = selectedPatient;
    setSelectedPatient(patient);
    form.setValue('patientId', patient.id);
    setSearchQuery('');

    // Check if patient has medical aid
    const patientHasMedicalAid = patient?.medicalAidScheme && patient?.medicalAidNumber;
    const currentPaymentMethod = form.getValues('paymentMethod');
    
    // Reset payment method if switching to patient without medical aid and current method requires medical aid
    if (!patientHasMedicalAid && (currentPaymentMethod === 'medical_aid' || currentPaymentMethod === 'both')) {
      form.setValue('paymentMethod', 'cash');
      form.setValue('paymentAmount', undefined);
      
      // Show toast notification when auto-resetting payment method
      if (previousPatient) {
        toast({
          title: 'Payment Method Reset',
          description: 'Payment method changed to Cash as this patient is not eligible for medical aid.',
          variant: 'default',
        });
      }
    }

    if (appointmentId && doctorId) {
      // Selecting from appointment list
      form.setValue('appointmentId', appointmentId);
      form.setValue('doctorId', doctorId);
      form.setValue('isWalkIn', false);
    } else {
      // Check if patient has an appointment today
      const todayAppointment = todayAppointments?.find((apt: any) => 
        apt.patientId === patient.id && apt.status !== 'cancelled'
      );

      if (todayAppointment) {
        form.setValue('appointmentId', todayAppointment.id);
        form.setValue('doctorId', todayAppointment.doctorId);
        form.setValue('isWalkIn', false);
      } else {
        form.setValue('appointmentId', '');
        form.setValue('isWalkIn', true);
      }
    }
  };

  // Check if patient has medical aid
  const patientHasMedicalAid = selectedPatient?.medicalAidScheme && selectedPatient?.medicalAidNumber;

  const selectAppointment = (appointment: any) => {
    selectPatient(appointment.patient, appointment.id, appointment.doctorId);
  };

  const onSubmit = (data: InsertCheckIn & { doctorId: string; priority: number; paymentAmount?: number }) => {
    // Include all form data including payment amount
    checkInMutation.mutate(data);
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return '💵';
      case 'medical_aid': return '🏥';
      case 'both': return '💳';
      default: return '💵';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Check-in</h1>
          <p className="text-muted-foreground">Quick check-in process with appointment linking</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Check-in Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Patient Check-in
            </CardTitle>
            <CardDescription>
              Fast patient check-in process with automatic queue management
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Patient Search */}
            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search patient by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-patient-search"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPatient(null);
                    form.reset();
                  }}
                  data-testid="button-clear-search"
                >
                  Clear
                </Button>
              </div>

              {/* Search Results */}
              {searchResults && searchResults.length > 0 && (
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {searchResults.map((patient: any) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                      onClick={() => selectPatient(patient)}
                      data-testid={`patient-search-result-${patient.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {patient.photoUrl && <AvatarImage src={patient.photoUrl} />}
                          <AvatarFallback>
                            {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                          <p className="text-sm text-muted-foreground">{patient.phone}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Today's Appointments List - Always visible */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">Today's Available Appointments</h3>
                {todayAppointments && todayAppointments.length > 0 ? (
                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    {todayAppointments
                      .filter((appointment: any) => appointment.status !== 'cancelled' && appointment.status !== 'completed')
                      .map((appointment: any) => (
                      <div
                        key={appointment.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                        onClick={() => selectAppointment(appointment)}
                        data-testid={`appointment-item-${appointment.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            {appointment.patient?.photoUrl && <AvatarImage src={appointment.patient.photoUrl} />}
                            <AvatarFallback>
                              {appointment.patient?.firstName?.charAt(0)}{appointment.patient?.lastName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">
                              {appointment.patient?.firstName} {appointment.patient?.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">{appointment.patient?.phone}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(appointment.appointmentDate)}
                              <span className="mx-1">•</span>
                              <User className="w-3 h-3" />
                              {appointment.doctor?.name}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge 
                            variant={appointment.status === 'scheduled' ? 'secondary' : 
                                   appointment.status === 'confirmed' ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {appointment.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {appointment.appointmentType}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg" data-testid="text-no-appointments">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No appointments scheduled for today</p>
                  </div>
                )}
              </div>

              {/* Selected Patient */}
              {selectedPatient && (
                <div className="border rounded-lg p-4 bg-accent/10">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      {selectedPatient.photoUrl && <AvatarImage src={selectedPatient.photoUrl} />}
                      <AvatarFallback>
                        {selectedPatient.firstName.charAt(0)}{selectedPatient.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-lg" data-testid="text-selected-patient">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </p>
                      <div className="flex items-center gap-4">
                        <p className="text-muted-foreground">{selectedPatient.phone}</p>
                        {form.getValues('isWalkIn') && (
                          <Badge variant="secondary" className="text-xs">
                            🚶 Walk-in Patient
                          </Badge>
                        )}
                        {!form.getValues('isWalkIn') && (
                          <Badge variant="outline" className="text-xs">
                            📅 Appointment Patient
                          </Badge>
                        )}
                        {patientHasMedicalAid && (
                          <Badge variant="default" className="text-xs">
                            🏥 Medical Aid
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Check-in Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="doctorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Doctor *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-method">
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">💵 Cash</SelectItem>
                          <SelectItem value="medical_aid" disabled={!patientHasMedicalAid}>
                            🏥 Medical Aid {!patientHasMedicalAid && '(Not Available)'}
                          </SelectItem>
                          <SelectItem value="both" disabled={!patientHasMedicalAid}>
                            💳 Both (Cash + Medical Aid) {!patientHasMedicalAid && '(Medical Aid Not Available)'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {!patientHasMedicalAid && selectedPatient && (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Patient does not have medical aid on file
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Amount Field - Show for cash and both */}
                {showPaymentAmount && (
                  <FormField
                    control={form.control}
                    name="paymentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Amount (R) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            data-testid="input-payment-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Level</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Normal</SelectItem>
                          <SelectItem value="1">High</SelectItem>
                          <SelectItem value="2">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={checkInMutation.isPending || !selectedPatient}
                  data-testid="button-check-in"
                >
                  {checkInMutation.isPending ? 'Checking In...' : 'Check In Patient'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
