import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, CheckCircle, UserPlus, Clock, Upload, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

const patientRegistrationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().min(1, "Email is required").email("Valid email is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"], {
    required_error: "Please select a gender",
  }),
  idNumber: z.string().min(1, "ID number is required"),
  address: z.string().optional(),
  medicalAidScheme: z.string().optional(),
  medicalAidNumber: z.string().optional(),
  allergies: z.string().optional(),
});

type PatientRegistrationForm = z.infer<typeof patientRegistrationSchema>;

export default function PublicPatientRegistration() {
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    patientId?: string;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Get token from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // Validate token
  const { data: tokenValidation, isLoading: isValidatingToken, error: tokenError } = useQuery<{
    valid: boolean;
    expiresAt?: string;
    idPassport?: string | null;
    message?: string;
  }>({
    queryKey: ['/api/public/registration-token', token],
    enabled: !!token,
    retry: false,
  });

  const form = useForm<PatientRegistrationForm>({
    resolver: zodResolver(patientRegistrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      dateOfBirth: "",
      gender: undefined,
      idNumber: "",
      address: "",
      medicalAidScheme: "",
      medicalAidNumber: "",
      allergies: "",
    },
  });

  // Pre-fill ID/passport if provided in token
  useEffect(() => {
    if (tokenValidation?.idPassport) {
      form.setValue('idNumber', tokenValidation.idPassport);
    }
  }, [tokenValidation, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: PatientRegistrationForm) => {
    if (!token) {
      setSubmitResult({
        success: false,
        message: "No registration token provided",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const formData = new FormData();
      formData.append('token', token);
      
      if (selectedFile) {
        formData.append('photo', selectedFile);
      }
      
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });

      const response = await fetch('/api/public/patient/register', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      setSubmitResult({
        success: result.success,
        message: result.message,
        patientId: result.patientId,
      });

      if (result.success) {
        form.reset();
        
        // Close the window after a brief delay to show success message
        setTimeout(() => {
          window.close();
          
          // If window.close() didn't work (browser security), show a message
          setTimeout(() => {
            setSubmitResult({
              success: true,
              message: "Registration complete! You may now close this window.",
              patientId: result.patientId,
            });
          }, 500);
        }, 2000);
      }
    } catch (error) {
      setSubmitResult({
        success: false,
        message: "Network error. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show error if no token provided
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-between py-8 px-4">
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Invalid Registration Link</CardTitle>
              <CardDescription>
                This page requires a valid registration token. Please use the registration link provided to you.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <footer className="py-4">
          <p className="text-xs text-center text-muted-foreground">
            © 2025 InvoTech Clinic Management. All rights reserved.
          </p>
        </footer>
      </div>
    );
  }

  // Show loading while validating token
  if (isValidatingToken) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-between py-8 px-4">
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Validating Registration Link</CardTitle>
              <CardDescription>
                Please wait while we verify your registration link...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <footer className="py-4">
          <p className="text-xs text-center text-muted-foreground">
            © 2025 InvoTech Clinic Management. All rights reserved.
          </p>
        </footer>
      </div>
    );
  }

  // Show error if token validation failed
  if (tokenError || !(tokenValidation as any)?.valid) {
    const errorMessage = (tokenValidation as any)?.message || "Failed to validate registration link. Please try again.";
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-between py-8 px-4">
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Registration Link Error</CardTitle>
              <CardDescription className="text-red-600 dark:text-red-400 mt-2">
                {errorMessage}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please contact the clinic to request a new registration link.
              </p>
            </CardContent>
          </Card>
        </div>
        <footer className="py-4">
          <p className="text-xs text-center text-muted-foreground">
            © 2025 InvoTech Clinic Management. All rights reserved.
          </p>
        </footer>
      </div>
    );
  }

  // Show registration form if token is valid
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-between py-8 px-4">
      <div className="max-w-2xl mx-auto flex-1">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Patient Registration</CardTitle>
            <CardDescription>
              Please fill out this form to register as a new patient at our clinic.
              All fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitResult && (
              <Alert className={`mb-6 ${submitResult.success ? 'border-green-200 bg-green-50 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:bg-red-950'}`} data-testid="alert-submit-result">
                {submitResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={submitResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                  {submitResult.message}
                  {submitResult.success && submitResult.patientId && (
                    <div className="mt-2 font-medium" data-testid="text-patient-id">
                      Your Patient ID: {submitResult.patientId}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Hide form after successful registration */}
            {submitResult?.success ? null : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Photo Upload */}
                <div className="flex items-center gap-6 pb-4 border-b dark:border-gray-700">
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
                        <Button variant="outline" asChild type="button">
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
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Personal Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input data-testid="input-firstname" placeholder="Enter your first name" {...field} />
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
                            <Input data-testid="input-lastname" placeholder="Enter your last name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <Input 
                              data-testid="input-phone" 
                              placeholder="0685921233" 
                              {...field} 
                            />
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
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input 
                              data-testid="input-email" 
                              type="email" 
                              placeholder="your.email@example.com" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth *</FormLabel>
                          <FormControl>
                            <Input 
                              data-testid="input-dob" 
                              type="date" 
                              {...field} 
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  </div>

                  <FormField
                    control={form.control}
                    name="idNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          ID Number * 
                          {tokenValidation?.idPassport && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">(Pre-filled)</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-idnumber" 
                            placeholder="Enter your ID number" 
                            readOnly={!!tokenValidation?.idPassport}
                            className={tokenValidation?.idPassport ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea 
                            data-testid="input-address" 
                            placeholder="Enter your full address" 
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Medical Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Medical Aid Information (Optional)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="medicalAidScheme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medical Aid Scheme</FormLabel>
                          <FormControl>
                            <Input 
                              data-testid="input-medicalaid-scheme" 
                              placeholder="e.g., Discovery Health" 
                              {...field} 
                            />
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
                            <Input 
                              data-testid="input-medicalaid-number" 
                              placeholder="Enter your medical aid number" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Known Allergies</FormLabel>
                        <FormControl>
                          <Textarea 
                            data-testid="input-allergies" 
                            placeholder="List any known allergies (medications, foods, etc.)" 
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                  data-testid="button-register"
                >
                  {isSubmitting ? "Registering..." : "Register as Patient"}
                </Button>
              </form>
            </Form>
            )}
          </CardContent>
        </Card>
      </div>
      <footer className="py-4">
        <p className="text-xs text-center text-muted-foreground">
          © 2025 InvoTech Clinic Management. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
