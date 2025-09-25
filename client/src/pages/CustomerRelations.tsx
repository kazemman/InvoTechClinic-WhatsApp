import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Gift, Heart, Users, Send, Loader2, 
  Calendar, MessageSquare, Stethoscope 
} from 'lucide-react';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth: string;
}

interface BirthdayWish {
  patientId: string;
  message: string;
  status: 'sent' | 'pending';
  sentAt?: string;
}

interface HealthAdvice {
  id: string;
  title: string;
  content: string;
  category: string;
}

const predefinedHealthAdvice: HealthAdvice[] = [
  {
    id: '1',
    title: 'Stay Hydrated',
    content: 'Remember to drink at least 8 glasses of water daily. Proper hydration is essential for your overall health and well-being.',
    category: 'General Health'
  },
  {
    id: '2', 
    title: 'Regular Exercise',
    content: 'Aim for at least 30 minutes of moderate exercise daily. Even a simple walk can make a significant difference to your health.',
    category: 'Fitness'
  },
  {
    id: '3',
    title: 'Balanced Diet',
    content: 'Include plenty of fruits, vegetables, and whole grains in your diet. A balanced diet provides essential nutrients for optimal health.',
    category: 'Nutrition'
  },
  {
    id: '4',
    title: 'Regular Check-ups',
    content: 'Schedule regular medical check-ups to monitor your health and catch any potential issues early.',
    category: 'Preventive Care'
  },
  {
    id: '5',
    title: 'Mental Health',
    content: 'Take time for mental health. Practice stress management techniques like meditation, deep breathing, or talking to someone you trust.',
    category: 'Mental Wellness'
  }
];

export default function CustomerRelations() {
  const { toast } = useToast();
  const [selectedAdvice, setSelectedAdvice] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [birthdayCustomMessage, setBirthdayCustomMessage] = useState<string>('');
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);

  // Get today's birthday patients
  const { data: birthdayPatients, isLoading: loadingBirthdays } = useQuery({
    queryKey: ['/api/patients/birthdays'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/patients/birthdays');
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute to catch midnight updates
  });

  // Get all active patients for health advice
  const { data: allPatients, isLoading: loadingPatients } = useQuery({
    queryKey: ['/api/patients'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/patients');
      return res.json();
    },
  });

  // Get birthday wishes sent today
  const { data: sentWishes } = useQuery({
    queryKey: ['/api/birthday-wishes'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/birthday-wishes');
      return res.json();
    },
  });

  // Send birthday wish mutation
  const sendBirthdayWishMutation = useMutation({
    mutationFn: async ({ patientId, customMessage }: { patientId: string; customMessage?: string }) => {
      const response = await apiRequest('POST', '/api/send-birthday-wish', {
        patientId,
        customMessage: customMessage?.trim() || undefined
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Birthday Wish Sent!",
        description: `Message sent successfully: "${data.message}"`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/birthday-wishes'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send birthday wish. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Send health advice mutation
  const sendHealthAdviceMutation = useMutation({
    mutationFn: async ({ adviceId, customMessage, patientIds }: { 
      adviceId?: string; 
      customMessage?: string; 
      patientIds: string[] 
    }) => {
      const response = await apiRequest('POST', '/api/send-health-advice', {
        adviceId,
        customMessage,
        patientIds
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Health Advice Sent!",
        description: `Message sent to ${data.sentCount} patients`,
      });
      setSelectedAdvice('');
      setCustomMessage('');
      setSelectedPatients([]);
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to send health advice. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSelectAllPatients = () => {
    if (selectedPatients.length === allPatients?.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(allPatients?.map((p: Patient) => p.id) || []);
    }
  };

  const handlePatientToggle = (patientId: string) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  const handleSendHealthAdvice = () => {
    if (selectedPatients.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one patient to send health advice to.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedAdvice && !customMessage.trim()) {
      toast({
        title: "Error", 
        description: "Please select a health advice template or write a custom message.",
        variant: "destructive"
      });
      return;
    }

    sendHealthAdviceMutation.mutate({
      adviceId: selectedAdvice || undefined,
      customMessage: customMessage.trim() || undefined,
      patientIds: selectedPatients
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });
  };

  const isWishSent = (patientId: string) => {
    return sentWishes?.some((wish: BirthdayWish) => wish.patientId === patientId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Relations</h1>
          <p className="text-muted-foreground">Manage patient communications and engagement</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Birthday Wishes Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-500" />
              Birthday Wishes
            </CardTitle>
            <CardDescription>
              Send personalized birthday messages to patients celebrating today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Custom Message Input */}
              <div className="space-y-2">
                <Label htmlFor="birthday-message">Custom Birthday Message (Optional)</Label>
                <Textarea
                  id="birthday-message"
                  placeholder="Enter a custom birthday message, or leave blank to use the default message..."
                  value={birthdayCustomMessage}
                  onChange={(e) => setBirthdayCustomMessage(e.target.value)}
                  rows={3}
                  data-testid="textarea-birthday-custom-message"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use default: "Happy Birthday [Name]! 🎉 Wishing you a wonderful year ahead..."
                </p>
              </div>
              
              {loadingBirthdays ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading birthdays...</span>
                </div>
              ) : birthdayPatients?.length > 0 ? (
                <div className="space-y-3">
                  {birthdayPatients.map((patient: Patient) => (
                    <div key={patient.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium" data-testid={`text-birthday-patient-${patient.id}`}>
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(patient.dateOfBirth)} • {patient.phone}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isWishSent(patient.id) ? (
                          <Badge variant="secondary" data-testid={`badge-sent-${patient.id}`}>
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Sent
                          </Badge>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => sendBirthdayWishMutation.mutate({ 
                              patientId: patient.id, 
                              customMessage: birthdayCustomMessage 
                            })}
                            disabled={sendBirthdayWishMutation.isPending}
                            data-testid={`button-send-birthday-${patient.id}`}
                          >
                            {sendBirthdayWishMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-1" />
                                Send Wish
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No birthdays today</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Health Advice Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-green-500" />
              Health Advice
            </CardTitle>
            <CardDescription>
              Send health tips and advice to selected patients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Health Advice Templates */}
              <div>
                <label className="text-sm font-medium mb-2 block">Health Advice Template</label>
                <Select value={selectedAdvice} onValueChange={setSelectedAdvice}>
                  <SelectTrigger data-testid="select-health-advice">
                    <SelectValue placeholder="Select a health advice template" />
                  </SelectTrigger>
                  <SelectContent>
                    {predefinedHealthAdvice.map((advice) => (
                      <SelectItem key={advice.id} value={advice.id}>
                        <div className="flex flex-col">
                          <span>{advice.title}</span>
                          <span className="text-xs text-muted-foreground">{advice.category}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Message */}
              <div>
                <label className="text-sm font-medium mb-2 block">Or Write Custom Message</label>
                <Textarea
                  placeholder="Write your custom health advice message..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  data-testid="textarea-custom-message"
                />
              </div>

              {/* Patient Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Select Patients</label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSelectAllPatients}
                    data-testid="button-select-all-patients"
                  >
                    {selectedPatients.length === allPatients?.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                
                <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                  {loadingPatients ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading patients...
                    </div>
                  ) : (
                    allPatients?.map((patient: Patient) => (
                      <div key={patient.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`patient-${patient.id}`}
                          checked={selectedPatients.includes(patient.id)}
                          onChange={() => handlePatientToggle(patient.id)}
                          className="rounded"
                          data-testid={`checkbox-patient-${patient.id}`}
                        />
                        <label 
                          htmlFor={`patient-${patient.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {patient.firstName} {patient.lastName} - {patient.phone}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                
                {selectedPatients.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedPatients.length} patient(s) selected
                  </p>
                )}
              </div>

              {/* Send Button */}
              <Button 
                onClick={handleSendHealthAdvice}
                disabled={sendHealthAdviceMutation.isPending}
                className="w-full"
                data-testid="button-send-health-advice"
              >
                {sendHealthAdviceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Health Advice
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview selected advice */}
      {selectedAdvice && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Message Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium mb-2">
                {predefinedHealthAdvice.find(a => a.id === selectedAdvice)?.title}
              </p>
              <p className="text-sm">
                {predefinedHealthAdvice.find(a => a.id === selectedAdvice)?.content}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {customMessage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Custom Message Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">{customMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}