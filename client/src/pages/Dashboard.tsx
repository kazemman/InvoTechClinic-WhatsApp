import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/auth';
import { useWebSocket } from '@/lib/websocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarDays, Users, DollarSign, UserPlus,
  TrendingUp, ArrowUp, Clock, Calendar,
  ClipboardCheck, UserRound, BarChart3, Settings, Shield
} from 'lucide-react';

export default function Dashboard() {
  const { lastMessage } = useWebSocket();

  // Refresh queue data when WebSocket message received
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/dashboard/stats');
      return res.json();
    },
  });

  const { data: queue, refetch: refetchQueue } = useQuery({
    queryKey: ['/api/queue'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/queue');
      return res.json();
    },
  });

  const { data: todayAppointments } = useQuery({
    queryKey: ['/api/appointments', new Date().toISOString().split('T')[0]],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await apiRequest('GET', `/api/appointments?date=${today}`);
      return res.json();
    },
  });

  const { data: activityLogs } = useQuery({
    queryKey: ['/api/activity-logs'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/activity-logs?limit=10');
      return res.json();
    },
  });

  // Refresh data when queue updates
  useEffect(() => {
    if (lastMessage?.type === 'queue_update') {
      refetchQueue();
      refetchStats();
    }
  }, [lastMessage, refetchQueue, refetchStats]);

  const quickActions = [
    { icon: UserPlus, label: 'Register Patient', path: '/patients', color: 'bg-blue-100 text-blue-600' },
    { icon: Calendar, label: 'Book Appointment', path: '/appointments', color: 'bg-green-100 text-green-600' },
    { icon: ClipboardCheck, label: 'Check-in Patient', path: '/checkin', color: 'bg-yellow-100 text-yellow-600' },
    { icon: Users, label: 'View Queue', path: '/queue', color: 'bg-purple-100 text-purple-600' },
    { icon: UserRound, label: "Doctor's Page", path: '/doctor', color: 'bg-indigo-100 text-indigo-600' },
    { icon: BarChart3, label: 'View Insights', path: '/insights', color: 'bg-teal-100 text-teal-600' },
    { icon: Settings, label: 'Manage Users', path: '/users', color: 'bg-orange-100 text-orange-600' },
    { icon: Shield, label: 'System Admin', path: '/admin', color: 'bg-red-100 text-red-600' },
  ];

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'waiting': return 'badge-waiting';
      case 'in_progress': return 'badge-in-progress';
      case 'completed': return 'badge-completed';
      default: return 'badge-waiting';
    }
  };

  const getAppointmentStatusClass = (status: string) => {
    switch (status) {
      case 'completed': return 'border-l-accent bg-accent/5';
      case 'in_progress': return 'border-l-primary bg-primary/5';
      case 'scheduled': return 'border-l-yellow-500 bg-yellow-500/5';
      default: return 'border-l-secondary bg-secondary/5';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Appointments</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-today-appointments">
                  {stats?.todayAppointments || 0}
                </p>
                <p className="text-sm text-accent mt-1">
                  <ArrowUp className="inline w-3 h-3 mr-1" />
                  <span>12%</span> from yesterday
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CalendarDays className="text-blue-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Patients in Queue</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-queue-count">
                  {stats?.queueCount || 0}
                </p>
                <p className="text-sm text-yellow-600 mt-1">
                  <Clock className="inline w-3 h-3 mr-1" />
                  Avg wait: <span>15 mins</span>
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Users className="text-yellow-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Revenue</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-today-revenue">
                  R{stats?.todayRevenue || 0}
                </p>
                <p className="text-sm text-accent mt-1">
                  <TrendingUp className="inline w-3 h-3 mr-1" />
                  <span>8%</span> from yesterday
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-green-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">New Patients</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-new-patients">
                  {stats?.newPatients || 0}
                </p>
                <p className="text-sm text-accent mt-1">
                  <ArrowUp className="inline w-3 h-3 mr-1" />
                  <span>25%</span> this week
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <UserPlus className="text-purple-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.path} href={action.path}>
                  <button 
                    className="flex flex-col items-center p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors group w-full"
                    data-testid={`button-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform mb-2 ${action.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium text-center">{action.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Current Queue</CardTitle>
            <Link href="/queue">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {queue && queue.length > 0 ? (
              queue.slice(0, 4).map((patient: any) => (
                <div key={patient.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-primary-foreground font-semibold">
                        {patient.patient?.firstName?.charAt(0) || 'P'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground" data-testid={`text-patient-name-${patient.id}`}>
                        {patient.patient?.firstName} {patient.patient?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(patient.enteredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeClass(patient.status)}`}>
                      {patient.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {Math.floor((Date.now() - new Date(patient.enteredAt).getTime()) / 60000)} mins
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-queue">
                No patients in queue
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Today's Schedule</CardTitle>
            <Link href="/appointments">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayAppointments && todayAppointments.length > 0 ? (
              todayAppointments.slice(0, 4).map((appointment: any) => (
                <div key={appointment.id} className={`flex items-center justify-between p-4 border-l-4 rounded-lg ${getAppointmentStatusClass(appointment.status)}`}>
                  <div className="flex items-center space-x-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">
                        {new Date(appointment.appointmentDate).getHours().toString().padStart(2, '0')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(appointment.appointmentDate).getMinutes().toString().padStart(2, '0')}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground" data-testid={`text-appointment-patient-${appointment.id}`}>
                        {appointment.patient?.firstName} {appointment.patient?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{appointment.appointmentType}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {appointment.doctor?.name}
                    </p>
                    <Badge className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeClass(appointment.status)}`}>
                      {appointment.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-schedule">
                No appointments scheduled for today
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link href="/admin">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {activityLogs && activityLogs.length > 0 ? (
            activityLogs.slice(0, 5).map((log: any) => (
              <div key={log.id} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1">
                  <p className="text-sm text-foreground" data-testid={`text-activity-${log.id}`}>
                    {log.details}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-activity">
              No recent activity
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
