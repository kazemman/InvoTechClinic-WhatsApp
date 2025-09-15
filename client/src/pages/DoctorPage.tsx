import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertConsultationSchema, type InsertConsultation } from '@shared/schema';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatTime } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  UserRound, Search, Users, FileText, 
  Stethoscope, History, Pill, FileImage
} from 'lucide-react';

export default function DoctorPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/me');
      return res.json();
    },
  });

  const { data: myQueue } = useQuery({
    queryKey: ['/api/queue', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const res = await apiRequest('GET', `/api/queue?doctorId=${currentUser.id}`);
      return res.json();
    },
    enabled: !!currentUser?.id,
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

  const { data: patientConsultations } = useQuery({
    queryKey: ['/api/consultations/patient', selectedPatient?.id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/consultations/patient/${selectedPatient.id}`);
      return res.json();
    },
    enabled: !!selectedPatient?.id,
  });

  const form = useForm<InsertConsultation>({
    resolver: zodResolver(insertConsultationSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      queueId: undefined,
      notes: '',
      diagnosis: '',
      prescription: '',
      referralLetters: '',
      attachments: '',
    },
  });

  const createConsultationMutation = useMutation({
    mutationFn: async (data: InsertConsultation) => {
      const res = await apiRequest('POST', '/api/consultations', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Consultation Completed',
        description: 'Patient consultation has been recorded successfully.',
      });
      form.reset();
      setSelectedPatient(null);
      setSelectedQueueItem(null);
      queryClient.invalidateQueries({ queryKey: ['/api/queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/consultations'] });
    },
    onError: (error) => {
      toast({
        title: 'Consultation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const selectPatientFromQueue = (queueItem: any) => {
    setSelectedQueueItem(queueItem);
    setSelectedPatient(queueItem.patient);
    form.setValue('patientId', queueItem.patientId);
    form.setValue('doctorId', currentUser?.id || '');
    form.setValue('queueId', queueItem.id);
  };

  const selectPatientFromSearch = (patient: any) => {
    setSelectedPatient(patient);
    setSelectedQueueItem(null);
    form.setValue('patientId', patient.id);
    form.setValue('doctorId', currentUser?.id || '');
    form.setValue('queueId', undefined);
    setSearchQuery('');
  };

  const onSubmit = (data: InsertConsultation) => {
    // Filter out undefined or empty queueId
    const consultationData = {
      ...data,
      queueId: data.queueId && data.queueId.trim() ? data.queueId : undefined
    };
    
    // Remove undefined fields to avoid sending them to the API
    Object.keys(consultationData).forEach(key => {
      if (consultationData[key as keyof InsertConsultation] === undefined) {
        delete consultationData[key as keyof InsertConsultation];
      }
    });
    
    createConsultationMutation.mutate(consultationData);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'waiting': return 'badge-waiting';
      case 'in_progress': return 'badge-in-progress';
      case 'completed': return 'badge-completed';
      default: return 'badge-waiting';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Doctor's Page</h1>
          <p className="text-muted-foreground">Patient consultation and medical records management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              My Queue
            </CardTitle>
            <CardDescription>
              Patients waiting for consultation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myQueue && myQueue.length > 0 ? (
                myQueue.map((queueItem: any, index: number) => (
                  <div
                    key={queueItem.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedQueueItem?.id === queueItem.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => selectPatientFromQueue(queueItem)}
                    data-testid={`queue-item-${queueItem.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-primary">
                        #{index + 1}
                      </div>
                      <Avatar className="w-10 h-10">
                        {queueItem.patient?.photoUrl && <AvatarImage src={queueItem.patient.photoUrl} />}
                        <AvatarFallback className="text-sm">
                          {queueItem.patient?.firstName?.charAt(0)}{queueItem.patient?.lastName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {queueItem.patient?.firstName} {queueItem.patient?.lastName}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeClass(queueItem.status)}`}>
                            {queueItem.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.floor((Date.now() - new Date(queueItem.enteredAt).getTime()) / 60000)}m wait
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-queue">
                  <Users className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No patients in queue</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Patient Search & Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Patient Search & Consultation
            </CardTitle>
            <CardDescription>
              Search patients and manage consultations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Patient Search */}
            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search patients by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-patient-search"
                  />
                </div>
              </div>

              {/* Search Results */}
              {searchResults && searchResults.length > 0 && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {searchResults.map((patient: any) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                      onClick={() => selectPatientFromSearch(patient)}
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
            </div>

            {/* Selected Patient Details */}
            {selectedPatient && (
              <Tabs defaultValue="consultation" className="space-y-4">
                <div className="border rounded-lg p-4 bg-accent/10">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="w-16 h-16">
                      {selectedPatient.photoUrl && <AvatarImage src={selectedPatient.photoUrl} />}
                      <AvatarFallback className="text-lg">
                        {selectedPatient.firstName.charAt(0)}{selectedPatient.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-semibold" data-testid="text-selected-patient">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </h3>
                      <p className="text-muted-foreground">{selectedPatient.phone}</p>
                      <p className="text-sm text-muted-foreground">
                        DOB: {formatDate(selectedPatient.dateOfBirth)}
                      </p>
                    </div>
                  </div>
                  
                  {selectedPatient.medicalAidScheme && (
                    <div className="border-t pt-3">
                      <p className="text-sm"><strong>Medical Aid:</strong> {selectedPatient.medicalAidScheme}</p>
                      {selectedPatient.medicalAidNumber && (
                        <p className="text-sm"><strong>Number:</strong> {selectedPatient.medicalAidNumber}</p>
                      )}
                    </div>
                  )}
                </div>

                <TabsList>
                  <TabsTrigger value="consultation">New Consultation</TabsTrigger>
                  <TabsTrigger value="history">Medical History</TabsTrigger>
                </TabsList>

                <TabsContent value="consultation">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Consultation Notes *</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                value={field.value || ''}
                                placeholder="Patient symptoms, examination findings..."
                                className="min-h-[100px]"
                                data-testid="input-consultation-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="diagnosis"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Diagnosis</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                value={field.value || ''}
                                placeholder="Medical diagnosis and assessment..."
                                data-testid="input-diagnosis"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="prescription"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prescription</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                value={field.value || ''}
                                placeholder="Medications, dosage, instructions..."
                                data-testid="input-prescription"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="referralLetters"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Referral Letters</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                value={field.value || ''}
                                placeholder="Specialist referrals, recommendations..."
                                data-testid="input-referrals"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="attachments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Attachments & Notes</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                value={field.value || ''}
                                placeholder="File references, additional notes..."
                                data-testid="input-attachments"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={createConsultationMutation.isPending}
                        data-testid="button-save-consultation"
                      >
                        {createConsultationMutation.isPending ? 'Saving...' : 'Complete Consultation'}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="history">
                  <div className="space-y-4">
                    {patientConsultations && patientConsultations.length > 0 ? (
                      patientConsultations.map((consultation: any) => (
                        <Card key={consultation.id}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">
                                Consultation - {formatDate(consultation.consultationDate)}
                              </CardTitle>
                              <span className="text-sm text-muted-foreground">
                                {formatTime(consultation.consultationDate)}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {consultation.notes && (
                              <div>
                                <h4 className="font-medium flex items-center gap-2 mb-2">
                                  <FileText className="w-4 h-4" />
                                  Notes
                                </h4>
                                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                  {consultation.notes}
                                </p>
                              </div>
                            )}

                            {consultation.diagnosis && (
                              <div>
                                <h4 className="font-medium flex items-center gap-2 mb-2">
                                  <Stethoscope className="w-4 h-4" />
                                  Diagnosis
                                </h4>
                                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                  {consultation.diagnosis}
                                </p>
                              </div>
                            )}

                            {consultation.prescription && (
                              <div>
                                <h4 className="font-medium flex items-center gap-2 mb-2">
                                  <Pill className="w-4 h-4" />
                                  Prescription
                                </h4>
                                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                  {consultation.prescription}
                                </p>
                              </div>
                            )}

                            {consultation.referralLetters && (
                              <div>
                                <h4 className="font-medium flex items-center gap-2 mb-2">
                                  <FileImage className="w-4 h-4" />
                                  Referrals
                                </h4>
                                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                  {consultation.referralLetters}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground" data-testid="text-no-history">
                        <History className="w-8 h-8 mx-auto mb-2" />
                        <p>No previous consultations</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
