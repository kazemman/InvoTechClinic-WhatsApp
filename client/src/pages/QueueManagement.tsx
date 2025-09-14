import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/auth';
import { useWebSocket } from '@/lib/websocket';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, Clock, Play, Pause, CheckCircle, 
  RotateCcw, AlertCircle, User, Timer
} from 'lucide-react';

export default function QueueManagement() {
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocket();

  const { data: queue, refetch: refetchQueue } = useQuery({
    queryKey: ['/api/queue', selectedDoctor],
    queryFn: async () => {
      const url = selectedDoctor ? `/api/queue?doctorId=${selectedDoctor}` : '/api/queue';
      const res = await apiRequest('GET', url);
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

  // Refresh queue when WebSocket message received
  useEffect(() => {
    if (lastMessage?.type === 'queue_update') {
      refetchQueue();
    }
  }, [lastMessage, refetchQueue]);

  const updateQueueStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest('PUT', `/api/queue/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/queue'] });
    },
    onError: (error) => {
      toast({
        title: 'Status Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeFromQueueMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/queue/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Removed from Queue',
        description: 'Patient has been removed from the queue.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/queue'] });
    },
    onError: (error) => {
      toast({
        title: 'Remove Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateStatus = (id: string, status: string) => {
    updateQueueStatusMutation.mutate({ id, status });
  };

  const removeFromQueue = (id: string) => {
    removeFromQueueMutation.mutate(id);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'waiting': return 'badge-waiting';
      case 'in_progress': return 'badge-in-progress';
      case 'completed': return 'badge-completed';
      default: return 'badge-waiting';
    }
  };

  const getPriorityBadgeClass = (priority: number) => {
    switch (priority) {
      case 2: return 'badge-urgent';
      case 1: return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 2: return 'Urgent';
      case 1: return 'High';
      default: return 'Normal';
    }
  };

  const getWaitTime = (enteredAt: string) => {
    const now = new Date();
    const entered = new Date(enteredAt);
    const diffMs = now.getTime() - entered.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  };

  const queueStats = queue ? {
    total: queue.length,
    waiting: queue.filter((item: any) => item.status === 'waiting').length,
    inProgress: queue.filter((item: any) => item.status === 'in_progress').length,
    avgWaitTime: queue.length > 0 ? Math.round(
      queue.reduce((acc: number, item: any) => acc + getWaitTime(item.enteredAt), 0) / queue.length
    ) : 0
  } : { total: 0, waiting: 0, inProgress: 0, avgWaitTime: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Queue Management</h1>
          <p className="text-muted-foreground">Real-time patient queue monitoring and management</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger className="w-48" data-testid="select-doctor-filter">
              <SelectValue placeholder="Filter by doctor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Doctors</SelectItem>
              {doctors?.map((doctor: any) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total in Queue</p>
                <p className="text-2xl font-bold" data-testid="text-total-queue">{queueStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Waiting</p>
                <p className="text-2xl font-bold" data-testid="text-waiting-count">{queueStats.waiting}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Play className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold" data-testid="text-in-progress-count">{queueStats.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Timer className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Wait Time</p>
                <p className="text-2xl font-bold" data-testid="text-avg-wait-time">{queueStats.avgWaitTime}m</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Current Queue
          </CardTitle>
          <CardDescription>
            Manage patient queue with real-time updates and status tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {queue && queue.length > 0 ? (
              queue.map((queueItem: any, index: number) => (
                <div key={queueItem.id} className="border rounded-lg p-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[40px]">
                        <div className="text-xl font-bold text-primary">
                          #{index + 1}
                        </div>
                      </div>
                      
                      <Avatar className="w-12 h-12">
                        {queueItem.patient?.photoUrl && <AvatarImage src={queueItem.patient.photoUrl} />}
                        <AvatarFallback>
                          {queueItem.patient?.firstName?.charAt(0)}{queueItem.patient?.lastName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-lg" data-testid={`text-patient-name-${queueItem.id}`}>
                            {queueItem.patient?.firstName} {queueItem.patient?.lastName}
                          </span>
                          <Badge className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityBadgeClass(queueItem.priority)}`}>
                            {getPriorityLabel(queueItem.priority)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>Dr. {queueItem.doctor?.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Waiting {getWaitTime(queueItem.enteredAt)} mins</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>
                              Entered: {new Date(queueItem.enteredAt).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusBadgeClass(queueItem.status)}`}>
                        {queueItem.status.replace('_', ' ')}
                      </Badge>

                      <div className="flex gap-2">
                        {queueItem.status === 'waiting' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(queueItem.id, 'in_progress')}
                            data-testid={`button-start-${queueItem.id}`}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Start
                          </Button>
                        )}

                        {queueItem.status === 'in_progress' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(queueItem.id, 'waiting')}
                              data-testid={`button-pause-${queueItem.id}`}
                            >
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateStatus(queueItem.id, 'completed')}
                              data-testid={`button-complete-${queueItem.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Complete
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFromQueue(queueItem.id)}
                          data-testid={`button-remove-${queueItem.id}`}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12" data-testid="text-empty-queue">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Queue is Empty</h3>
                <p className="text-muted-foreground">No patients are currently in the queue.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
