import { useState, useCallback } from 'react';
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
  Stethoscope, History, Pill, FileImage,
  Upload, X, Download, Eye, Trash2, File, Plus
} from 'lucide-react';

export default function DoctorPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<any[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingAllergies, setIsEditingAllergies] = useState(false);
  const [allergiesValue, setAllergiesValue] = useState('');
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

  // Query to get medical attachments for a specific consultation
  const getMedicalAttachments = async (consultationId: string) => {
    const res = await apiRequest('GET', `/api/medical-attachments/${consultationId}`);
    return res.json();
  };

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    try {
      const response = await apiRequest('GET', `/api/medical-attachments/file/${attachmentId}`);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Could not download the file',
        variant: 'destructive',
      });
    }
  };

  const form = useForm<InsertConsultation>({
    resolver: zodResolver(insertConsultationSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      queueId: undefined,
      notes: '',
      diagnosis: '',
      prescription: '',
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
      // Invalidate patient consultations specifically
      if (selectedPatient?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/consultations/patient', selectedPatient.id] });
      }
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
    // Reset file upload state
    setSelectedFiles([]);
    setUploadedAttachments([]);
    // Reset allergies editing state
    setIsEditingAllergies(false);
    setAllergiesValue(queueItem.patient?.allergies || '');
  };

  // File upload handlers
  const handleFileSelect = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      // Check file size (25MB limit)
      if (file.size > 25 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} is larger than 25MB limit`,
          variant: 'destructive',
        });
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect]);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (consultationId: string) => {
    if (selectedFiles.length === 0) return [];

    const formData = new FormData();
    formData.append('consultationId', consultationId);
    
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    const response = await apiRequest('POST', '/api/medical-attachments', formData);
    return response.json();
  };

  // Get file icon based on type
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <File className="w-4 h-4 text-red-500" />;
      case 'doc':
      case 'docx':
        return <File className="w-4 h-4 text-blue-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FileImage className="w-4 h-4 text-green-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  // Component to display attachments for a consultation
  const AttachmentsDisplay = ({ consultationId }: { consultationId: string }) => {
    const { data: attachments, isLoading } = useQuery({
      queryKey: ['/api/medical-attachments', consultationId],
      queryFn: () => getMedicalAttachments(consultationId),
      enabled: !!consultationId,
    });

    if (isLoading) {
      return <div className="text-sm text-muted-foreground">Loading attachments...</div>;
    }

    if (!attachments || attachments.length === 0) {
      return <div className="text-sm text-muted-foreground">No attachments</div>;
    }

    return (
      <div className="space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <FileImage className="w-4 h-4" />
          Medical Attachments ({attachments.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((attachment: any) => (
            <div key={attachment.id} className="flex items-center justify-between p-2 bg-background border rounded" data-testid={`attachment-${attachment.id}`}>
              <div className="flex items-center gap-2 flex-1">
                {getFileIcon(attachment.originalName)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" title={attachment.originalName}>
                    {attachment.originalName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(attachment.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadAttachment(attachment.id, attachment.originalName)}
                  data-testid={`button-download-${attachment.id}`}
                >
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Update onSubmit to handle file uploads
  const onSubmit = async (data: InsertConsultation) => {
    try {
      // First create the consultation
      const consultation = await createConsultationMutation.mutateAsync(data);
      
      // Then upload files if any
      if (selectedFiles.length > 0) {
        await uploadFiles(consultation.id);
        // Invalidate medical attachments for this consultation
        queryClient.invalidateQueries({ queryKey: ['/api/medical-attachments', consultation.id] });
        toast({
          title: 'Files Uploaded',
          description: `${selectedFiles.length} file(s) attached to consultation`,
        });
      }
      
      // Reset form and file state
      setSelectedFiles([]);
      setUploadedAttachments([]);
    } catch (error) {
      console.error('Consultation creation failed:', error);
    }
  };

  const selectPatientFromSearch = (patient: any) => {
    setSelectedPatient(patient);
    setSelectedQueueItem(null);
    form.setValue('patientId', patient.id);
    form.setValue('doctorId', currentUser?.id || '');
    form.setValue('queueId', undefined);
    setSearchQuery('');
    // Reset file upload state
    setSelectedFiles([]);
    setUploadedAttachments([]);
    // Reset allergies editing state
    setIsEditingAllergies(false);
    setAllergiesValue(patient?.allergies || '');
  };

  // Allergies update mutation
  const updateAllergiesMutation = useMutation({
    mutationFn: async ({ patientId, allergies }: { patientId: string, allergies: string }) => {
      const res = await apiRequest('PUT', `/api/patients/${patientId}`, { allergies });
      return res.json();
    },
    onSuccess: (updatedPatient) => {
      toast({
        title: 'Allergies Updated',
        description: 'Patient allergies have been updated successfully.',
      });
      setSelectedPatient({ ...selectedPatient, allergies: updatedPatient.allergies });
      setIsEditingAllergies(false);
      // Invalidate patient search queries to reflect the change
      queryClient.invalidateQueries({ queryKey: ['/api/patients/search'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update allergies',
        variant: 'destructive',
      });
    },
  });

  const startEditingAllergies = () => {
    setIsEditingAllergies(true);
    setAllergiesValue(selectedPatient?.allergies || '');
  };

  const saveAllergies = () => {
    if (!selectedPatient) return;
    updateAllergiesMutation.mutate({
      patientId: selectedPatient.id,
      allergies: allergiesValue,
    });
  };

  const cancelEditingAllergies = () => {
    setIsEditingAllergies(false);
    setAllergiesValue(selectedPatient?.allergies || '');
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
                  
                  <div className="border-t pt-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">Allergies:</p>
                        {isEditingAllergies ? (
                          <div className="space-y-2">
                            <Textarea
                              value={allergiesValue}
                              onChange={(e) => setAllergiesValue(e.target.value)}
                              placeholder="List any known allergies or medications to avoid..."
                              className="min-h-[80px] text-sm"
                              data-testid="textarea-edit-allergies"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={saveAllergies}
                                disabled={updateAllergiesMutation.isPending}
                                data-testid="button-save-allergies"
                              >
                                {updateAllergiesMutation.isPending ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEditingAllergies}
                                disabled={updateAllergiesMutation.isPending}
                                data-testid="button-cancel-allergies"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground flex-1" data-testid="text-allergies-display">
                              {selectedPatient.allergies || 'None recorded'}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={startEditingAllergies}
                              className="h-auto px-2 py-1 text-xs"
                              data-testid="button-edit-allergies"
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>
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


                      {/* Medical File Attachments */}
                      <div className="space-y-4">
                        <FormLabel>Medical Attachments</FormLabel>
                        
                        {/* File Upload Drop Zone */}
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                            isDragOver 
                              ? 'border-primary bg-primary/10' 
                              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          data-testid="file-upload-dropzone"
                        >
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Drag and drop medical files here, or click to select
                          </p>
                          <p className="text-xs text-muted-foreground mb-4">
                            Supports: PDF, DOC, DOCX, Images, DICOM files (max 25MB each)
                          </p>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.tiff,.dcm,.xml,.json"
                            onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                            className="hidden"
                            id="file-upload"
                            data-testid="file-input"
                          />
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('file-upload')?.click()}
                            data-testid="button-select-files"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Select Files
                          </Button>
                        </div>

                        {/* Selected Files List */}
                        {selectedFiles.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Selected Files ({selectedFiles.length})</p>
                            <div className="space-y-2">
                              {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid={`selected-file-${index}`}>
                                  <div className="flex items-center gap-3">
                                    {getFileIcon(file.name)}
                                    <div className="flex-1">
                                      <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeFile(index)}
                                    data-testid={`button-remove-file-${index}`}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>

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


                            {/* Medical Attachments */}
                            <AttachmentsDisplay consultationId={consultation.id} />

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
