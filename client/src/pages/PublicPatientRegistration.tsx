import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, UserPlus, Clock } from "lucide-react";
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
      const response = await fetch('/api/public/patient/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          ...data
        }),
      });

      const result = await response.json();

      setSubmitResult({
        success: result.success,
        message: result.message,
        patientId: result.patientId,
      });

      if (result.success) {
        form.reset();
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-8 px-4">
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
    );
  }

  // Show loading while validating token
  if (isValidatingToken) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-8 px-4">
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
    );
  }

  // Show error if token validation failed
  if (tokenError || !(tokenValidation as any)?.valid) {
    const errorMessage = (tokenValidation as any)?.message || "Failed to validate registration link. Please try again.";
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-8 px-4">
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
    );
  }

  // Show registration form if token is valid
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
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

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                              placeholder="+27123456789" 
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
