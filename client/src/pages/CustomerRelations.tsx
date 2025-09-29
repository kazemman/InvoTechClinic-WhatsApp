import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Gift, Heart, Users, Send, Loader2, 
  Calendar, MessageSquare, Megaphone 
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


export default function CustomerRelations() {
  const { toast } = useToast();
  const [birthdayCustomMessage, setBirthdayCustomMessage] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [processingSendId, setProcessingSendId] = useState<string | null>(null);
  const [selectedBirthdayPatient, setSelectedBirthdayPatient] = useState<string | null>(null);

  // Get today's birthday patients
  const { data: birthdayPatients, isLoading: loadingBirthdays } = useQuery({
    queryKey: ['/api/patients/birthdays'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/patients/birthdays');
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute to catch midnight updates
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
      // Set the current processing ID
      setProcessingSendId(patientId);
      
      const response = await apiRequest('POST', '/api/send-birthday-wish', {
        patientId,
        customMessage: customMessage?.trim() || undefined
      });
      return { ...await response.json(), patientId };
    },
    onSuccess: (data) => {
      // Clear processing ID
      setProcessingSendId(null);
      
      toast({
        title: "Birthday Wish Sent!",
        description: `Message sent successfully: "${data.message}"`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/birthday-wishes'] });
    },
    onError: (error, variables) => {
      // Clear processing ID
      setProcessingSendId(null);
      
      toast({
        title: "Error",
        description: "Failed to send birthday wish. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Send broadcast message mutation
  const sendBroadcastMutation = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const response = await apiRequest('POST', '/api/send-broadcast', {
        message
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Broadcast Sent!",
        description: "Message sent successfully to n8n workflow",
      });
      setBroadcastMessage('');
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to send broadcast message. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSendBroadcast = () => {
    if (!broadcastMessage.trim()) {
      toast({
        title: "Error", 
        description: "Please enter a message to broadcast.",
        variant: "destructive"
      });
      return;
    }

    sendBroadcastMutation.mutate({
      message: broadcastMessage.trim()
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

  const isProcessingSend = (patientId: string) => {
    return processingSendId === patientId;
  };

  const isAnyProcessing = () => {
    return processingSendId !== null;
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
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border-l-4 border-blue-500">
                  <p className="font-medium text-foreground mb-1">Default Birthday Message:</p>
                  <p className="italic">"Happy Birthday [Name]! 🎉 Wishing you a wonderful year ahead..."</p>
                  <p className="text-xs mt-1">Leave the custom message field empty to use this default template.</p>
                </div>
              </div>
              
              {loadingBirthdays ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading birthdays...</span>
                </div>
              ) : birthdayPatients?.length > 0 ? (
                <div className="space-y-4">
                  {/* Patient Selection List */}
                  <div className="space-y-3">
                    {birthdayPatients.map((patient: Patient) => (
                      <div key={patient.id} className={`flex items-center justify-between p-3 border rounded-lg ${selectedBirthdayPatient === patient.id ? 'border-blue-500 bg-blue-50/50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            id={`radio-birthday-${patient.id}`}
                            name="birthday-patient"
                            checked={selectedBirthdayPatient === patient.id}
                            onChange={() => setSelectedBirthdayPatient(patient.id)}
                            disabled={isWishSent(patient.id) || isAnyProcessing()}
                            className="h-4 w-4 text-blue-600"
                            data-testid={`radio-birthday-patient-${patient.id}`}
                          />
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
                          ) : isProcessingSend(patient.id) ? (
                            <Badge variant="outline" data-testid={`badge-sending-${patient.id}`}>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Sending...
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Send Button */}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      {selectedBirthdayPatient ? 
                        `Selected: ${birthdayPatients.find((p: Patient) => p.id === selectedBirthdayPatient)?.firstName} ${birthdayPatients.find((p: Patient) => p.id === selectedBirthdayPatient)?.lastName}` 
                        : 'No patient selected'
                      }
                    </div>
                    <Button 
                      onClick={() => {
                        if (selectedBirthdayPatient) {
                          sendBirthdayWishMutation.mutate({ 
                            patientId: selectedBirthdayPatient, 
                            customMessage: birthdayCustomMessage 
                          });
                        }
                      }}
                      disabled={
                        !selectedBirthdayPatient || 
                        isAnyProcessing() ||
                        (selectedBirthdayPatient && isWishSent(selectedBirthdayPatient))
                      }
                      data-testid="button-send-birthday-selected"
                    >
                      {isAnyProcessing() ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {birthdayCustomMessage.trim() ? 'Send Custom Message' : 'Send Default Message'}
                    </Button>
                  </div>
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

        {/* Broadcast Message Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-500" />
              Broadcast Message
            </CardTitle>
            <CardDescription>
              Send messages through n8n workflow to manage patient communications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Message Input */}
              <div>
                <Label htmlFor="broadcast-message">Message</Label>
                <Textarea
                  id="broadcast-message"
                  placeholder="Enter your message to broadcast..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  rows={4}
                  data-testid="textarea-broadcast-message"
                />
                <div className="text-sm text-muted-foreground mt-2">
                  This message will be sent to your n8n workflow for processing and distribution.
                </div>
              </div>

              {/* Send Button */}
              <Button 
                onClick={handleSendBroadcast}
                disabled={sendBroadcastMutation.isPending || !broadcastMessage.trim()}
                className="w-full"
                data-testid="button-send-broadcast"
              >
                {sendBroadcastMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Megaphone className="h-4 w-4 mr-2" />
                )}
                Send Broadcast Message
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Broadcast Message Preview */}
      {broadcastMessage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Message Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">{broadcastMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}