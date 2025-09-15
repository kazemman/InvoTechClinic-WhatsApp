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
import { Search, ClipboardCheck, Clock, User, CreditCard } from 'lucide-react';

export default function CheckIn() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertCheckIn & { doctorId: string; priority: number }>({
    resolver: zodResolver(insertCheckInSchema.extend({
      doctorId: insertCheckInSchema.shape.patientId,
      priority: insertCheckInSchema.shape.patientId.transform(() => 0)
    })),
    defaultValues: {
      patientId: '',
      appointmentId: '',
      paymentMethod: 'cash',
      isWalkIn: false,
      doctorId: '',
      priority: 0,
    },
  });

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

  const { data: recentCheckIns } = useQuery({
    queryKey: ['/api/checkins', new Date().toISOString().split('T')[0]],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await apiRequest('GET', `/api/checkins?date=${today}`);
      return res.json();
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (data: InsertCheckIn & { doctorId: string; priority: number }) => {
      const res = await apiRequest('POST', '/api/checkins', data);
      return res.json();
    },
    onSuccess: (checkIn) => {
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
    },
    onError: (error) => {
      toast({
        title: 'Check-in Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const selectPatient = (patient: any) => {
    setSelectedPatient(patient);
    form.setValue('patientId', patient.id);
    setSearchQuery('');

    // Check if patient has an appointment today
    const todayAppointment = todayAppointments?.find((apt: any) => 
      apt.patientId === patient.id && apt.status !== 'cancelled'
    );

    if (todayAppointment) {
      form.setValue('appointmentId', todayAppointment.id);
      form.setValue('doctorId', todayAppointment.doctorId);
      form.setValue('isWalkIn', false);
    } else {
      form.setValue('isWalkIn', true);
    }
  };

  const onSubmit = (data: InsertCheckIn & { doctorId: string; priority: number }) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Check-in Form */}
        <Card className="lg:col-span-2">
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
                      <p className="text-muted-foreground">{selectedPatient.phone}</p>
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
                          <SelectItem value="medical_aid">🏥 Medical Aid</SelectItem>
                          <SelectItem value="both">💳 Both (Cash + Medical Aid)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

        {/* Today's Check-ins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Today's Check-ins
            </CardTitle>
            <CardDescription>
              Recent patient check-ins and queue status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCheckIns && recentCheckIns.length > 0 ? (
                recentCheckIns.slice(0, 8).map((checkIn: any) => (
                  <div key={checkIn.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        {checkIn.patient?.photoUrl && <AvatarImage src={checkIn.patient.photoUrl} />}
                        <AvatarFallback className="text-xs">
                          {checkIn.patient?.firstName?.charAt(0)}{checkIn.patient?.lastName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm" data-testid={`text-checkin-patient-${checkIn.id}`}>
                          {checkIn.patient?.firstName} {checkIn.patient?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(checkIn.checkInTime)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs">
                        {getPaymentMethodIcon(checkIn.paymentMethod)}
                      </div>
                      {checkIn.isWalkIn && (
                        <Badge variant="secondary" className="text-xs">
                          Walk-in
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-checkins">
                  No check-ins today
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
