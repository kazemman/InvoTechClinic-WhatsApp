import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarIcon, Clock, X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const blockScheduleSchema = z.object({
  doctorId: z.string().min(1, 'Please select a doctor'),
  date: z.date(),
  type: z.enum(['time_slot', 'full_day']),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  reason: z.string().optional(),
});

type BlockScheduleForm = z.infer<typeof blockScheduleSchema>;

export default function DoctorSchedule() {
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const doctors = users?.filter((user: any) => user.role === 'doctor') || [];

  const form = useForm<BlockScheduleForm>({
    resolver: zodResolver(blockScheduleSchema),
    defaultValues: {
      doctorId: '',
      date: new Date(),
      type: 'time_slot',
      startTime: '09:00',
      endTime: '09:30',
      reason: '',
    },
  });

  const selectedDate = form.watch('date');
  const blockType = form.watch('type');

  const { data: unavailability = [], isLoading } = useQuery({
    queryKey: ['/api/doctor-unavailability', selectedDoctor, selectedDate],
    queryFn: async () => {
      if (!selectedDoctor || !selectedDate) return [];
      const res = await apiRequest('GET', `/api/doctor-unavailability/${selectedDoctor}?date=${selectedDate.toISOString()}`);
      return res.json();
    },
    enabled: !!selectedDoctor && !!selectedDate,
  });

  const blockMutation = useMutation({
    mutationFn: async (data: BlockScheduleForm) => {
      // Format date as YYYY-MM-DD to avoid timezone issues
      const year = data.date.getFullYear();
      const month = String(data.date.getMonth() + 1).padStart(2, '0');
      const day = String(data.date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      const res = await apiRequest('POST', '/api/doctor-unavailability', {
        ...data,
        date: dateString,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Schedule Updated',
        description: 'Doctor unavailability has been recorded.',
      });
      // Update selectedDoctor to ensure query uses the right doctor
      setSelectedDoctor(variables.doctorId);
      // Invalidate the specific query for this doctor and date
      queryClient.invalidateQueries({ 
        queryKey: ['/api/doctor-unavailability', variables.doctorId, variables.date] 
      });
      // Reset only the fields we want, keep doctor and date selected
      form.reset({
        doctorId: variables.doctorId,
        date: variables.date,
        type: 'time_slot',
        startTime: '09:00',
        endTime: '09:30',
        reason: '',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update schedule',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/doctor-unavailability/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Block Removed',
        description: 'Unavailability block has been removed.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-unavailability'] });
    },
  });

  const onSubmit = (data: BlockScheduleForm) => {
    blockMutation.mutate(data);
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 7; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    slots.push('18:00');
    return slots;
  };

  const timeSlots = generateTimeSlots();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Doctor Unavailability</h1>
        <p className="text-muted-foreground mt-2">Manage doctor unavailability and block unavailable time slots</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Block Unavailability</CardTitle>
            <CardDescription>Select a doctor and mark unavailable time slots or full days</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="doctorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doctor</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedDoctor(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-doctor">
                            <SelectValue placeholder="Select a doctor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {doctors.map((doctor: any) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              Dr. {doctor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Select Date</FormLabel>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        form.setValue('date', date, { shouldValidate: true });
                      }
                    }}
                    className="rounded-md border"
                    data-testid="calendar-date-picker"
                  />
                </div>

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Block Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-block-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="time_slot">Specific Time Slot</SelectItem>
                          <SelectItem value="full_day">Full Day</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {blockType === 'time_slot' && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-start-time">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timeSlots.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
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
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-end-time">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timeSlots.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="E.g., Conference, Personal leave, Training..."
                          {...field}
                          data-testid="input-reason"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={blockMutation.isPending || !selectedDate}
                  data-testid="button-block-schedule"
                >
                  {blockMutation.isPending ? 'Blocking...' : 'Block Schedule'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Blocks</CardTitle>
            <CardDescription>
              {selectedDate && selectedDoctor
                ? `Unavailability for ${selectedDate.toLocaleDateString()}`
                : 'Select a doctor and date to view blocks'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDoctor && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Please select a doctor to view their schedule blocks</AlertDescription>
              </Alert>
            )}

            {selectedDoctor && isLoading && (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            )}

            {selectedDoctor && !isLoading && unavailability.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>No unavailability blocks for this date</p>
                <p className="text-sm">Doctor is available all day</p>
              </div>
            )}

            {selectedDoctor && !isLoading && unavailability.length > 0 && (
              <div className="space-y-3">
                {unavailability.map((block: any) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`block-item-${block.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={block.type === 'full_day' ? 'destructive' : 'secondary'}>
                          {block.type === 'full_day' ? 'Full Day' : 'Time Slot'}
                        </Badge>
                        {block.type === 'time_slot' && (
                          <span className="text-sm font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {block.startTime} - {block.endTime}
                          </span>
                        )}
                      </div>
                      {block.reason && (
                        <p className="text-sm text-muted-foreground mt-1">{block.reason}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(block.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-block-${block.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
