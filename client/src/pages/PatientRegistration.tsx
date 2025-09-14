import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { insertPatientSchema, type InsertPatient } from '@shared/schema';
import { z } from 'zod';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Upload, UserPlus, Eye } from 'lucide-react';

// Extended validation schema for the form
const patientFormSchema = insertPatientSchema.extend({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(7, 'Phone number must be at least 7 characters'),
  idNumber: z.string().min(1, 'ID/Passport number is required'),
  dateOfBirth: z.date().refine(
    (date) => date <= new Date(),
    'Date of birth cannot be in the future'
  ),
});

export default function PatientRegistration() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertPatient>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: new Date(),
      gender: 'male' as const,
      idNumber: '',
      address: '',
      medicalAidScheme: '',
      medicalAidNumber: '',
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

  const createPatientMutation = useMutation({
    mutationFn: async (data: InsertPatient & { photo?: File }) => {
      const formData = new FormData();
      
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'photo' && value !== null && value !== undefined) {
          if (value instanceof Date) {
            formData.append(key, value.toISOString());
          } else {
            formData.append(key, value.toString());
          }
        }
      });

      if (selectedFile) {
        formData.append('photo', selectedFile);
      }

      const res = await apiRequest('POST', '/api/patients', formData);
      return res.json();
    },
    onSuccess: (patient) => {
      toast({
        title: 'Patient Registered',
        description: `${patient.firstName} ${patient.lastName} has been successfully registered.`,
      });
      form.reset();
      setSelectedFile(null);
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
    },
    onError: (error: any) => {
      let description = error.message;
      
      // Handle unique constraint violation for ID number
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        description = 'This ID/Passport number is already registered. Please check the number and try again.';
      }
      
      toast({
        title: 'Registration Failed',
        description,
        variant: 'destructive',
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (data: InsertPatient) => {
    createPatientMutation.mutate(data);
  };

  const loadPatientData = (patient: any) => {
    form.reset({
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email || '',
      phone: patient.phone,
      dateOfBirth: new Date(patient.dateOfBirth),
      gender: patient.gender || 'male',
      idNumber: patient.idNumber || '',
      address: patient.address || '',
      medicalAidScheme: patient.medicalAidScheme || '',
      medicalAidNumber: patient.medicalAidNumber || '',
    });
    setSearchQuery('');
    if (patient.photoUrl) {
      setPreviewUrl(patient.photoUrl);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Registration</h1>
          <p className="text-muted-foreground">Register new patients or update existing patient information</p>
        </div>
      </div>

      {/* Patient Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Quick Patient Search
          </CardTitle>
          <CardDescription>
            Search for existing patients to update their information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Search by name or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              data-testid="input-patient-search"
            />
          </div>
          
          {searchResults && searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium">Search Results:</h4>
              {searchResults.map((patient: any) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => loadPatientData(patient)}
                  data-testid={`patient-result-${patient.id}`}
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
                    Load Data
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Patient Information
          </CardTitle>
          <CardDescription>
            Complete patient profiles with personal details and medical aid information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Photo Upload */}
              <div className="flex items-center gap-6">
                <div>
                  <Avatar className="w-24 h-24">
                    {previewUrl && <AvatarImage src={previewUrl} />}
                    <AvatarFallback className="text-lg">
                      <Upload className="w-8 h-8" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <div className="flex gap-2 mb-2">
                    <label htmlFor="photo-upload" className="cursor-pointer">
                      <Button variant="outline" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload ID/Passport
                        </span>
                      </Button>
                    </label>
                    {previewUrl && (
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => window.open(previewUrl, '_blank')}
                        data-testid="button-view-id"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View ID
                      </Button>
                    )}
                  </div>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="input-patient-photo"
                  />
                  <p className="text-sm text-muted-foreground">
                    ID/passport photo
                  </p>
                </div>
              </div>

              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" value={field.value || ''} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                          data-testid="input-date-of-birth"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-gender">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="idNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID/Passport Number *</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} data-testid="input-id-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ''} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Medical Aid Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Medical Aid Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="medicalAidScheme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Aid Scheme</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} data-testid="input-medical-aid-scheme" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="medicalAidNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Aid Number</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} data-testid="input-medical-aid-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={createPatientMutation.isPending}
                data-testid="button-register-patient"
              >
                {createPatientMutation.isPending ? 'Registering...' : 'Register Patient'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
