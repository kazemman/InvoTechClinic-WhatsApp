import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, Activity, Database, Server, 
  Settings, Users, FileText, Clock,
  CheckCircle, AlertCircle, HardDrive,
  Wifi, Globe, Lock
} from 'lucide-react';

export default function SystemAdmin() {
  const [logLimit, setLogLimit] = useState(50);

  const { data: activityLogs } = useQuery({
    queryKey: ['/api/activity-logs', logLimit],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/activity-logs?limit=${logLimit}`);
      return res.json();
    },
  });

  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      return res.json();
    },
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/dashboard/stats');
      return res.json();
    },
  });

  // Mock system status data (in a real app, this would come from system monitoring APIs)
  const systemStatus = {
    server: { status: 'online', uptime: '99.9%', lastRestart: '2 days ago' },
    database: { status: 'connected', connections: 5, queryTime: '12ms' },
    storage: { used: 67, total: 100, lastBackup: '2 hours ago' },
    memory: { used: 45, total: 8192, available: 4506 },
    network: { status: 'connected', latency: '23ms', bandwidth: '1Gbps' }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'logout': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'create_user': return <Users className="w-4 h-4 text-purple-600" />;
      case 'create_patient': return <Users className="w-4 h-4 text-blue-600" />;
      case 'patient_checkin': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'create_appointment': return <Calendar className="w-4 h-4 text-orange-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login': return 'text-green-600';
      case 'logout': return 'text-blue-600';
      case 'create_user': return 'text-purple-600';
      case 'delete_user': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const userActivityStats = users ? {
    totalUsers: users.length,
    activeToday: activityLogs?.filter((log: any) => {
      const today = new Date().toDateString();
      return new Date(log.timestamp).toDateString() === today;
    }).map((log: any) => log.userId).filter((value: any, index: number, self: any[]) => self.indexOf(value) === index).length || 0,
    recentLogins: activityLogs?.filter((log: any) => log.action === 'login').length || 0,
  } : { totalUsers: 0, activeToday: 0, recentLogins: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">System Administration</h1>
          <p className="text-muted-foreground">Monitor system health and user activity</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">System Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          <TabsTrigger value="users">User Activity</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* System Health Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Server Status</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-server-status">
                      Online
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Uptime: {systemStatus.server.uptime}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Server className="text-green-600 w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Database</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-database-status">
                      Connected
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {systemStatus.database.connections} active connections
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Database className="text-green-600 w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Storage Used</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-storage-used">
                      {systemStatus.storage.used}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Last backup: {systemStatus.storage.lastBackup}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <HardDrive className="text-blue-600 w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed System Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  System Performance
                </CardTitle>
                <CardDescription>
                  Real-time system health monitoring
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm text-muted-foreground">
                      {systemStatus.memory.used}% ({systemStatus.memory.available}MB available)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${systemStatus.memory.used}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Storage Usage</span>
                    <span className="text-sm text-muted-foreground">
                      {systemStatus.storage.used}% of {systemStatus.storage.total}GB
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${systemStatus.storage.used}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-lg font-bold text-green-600">
                      {systemStatus.database.queryTime}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Query Time</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-lg font-bold text-blue-600">
                      {systemStatus.network.latency}
                    </p>
                    <p className="text-xs text-muted-foreground">Network Latency</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Statistics
                </CardTitle>
                <CardDescription>
                  Current user activity and engagement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-2xl font-bold text-blue-600" data-testid="text-total-system-users">
                      {userActivityStats.totalUsers}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-2xl font-bold text-green-600" data-testid="text-active-today">
                      {userActivityStats.activeToday}
                    </p>
                    <p className="text-xs text-muted-foreground">Active Today</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-2xl font-bold text-purple-600" data-testid="text-recent-logins">
                      {userActivityStats.recentLogins}
                    </p>
                    <p className="text-xs text-muted-foreground">Recent Logins</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">System Health Indicators</h4>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm">Server Connectivity</span>
                    </div>
                    <Badge className="badge-completed">Healthy</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Wifi className="w-5 h-5 text-green-600" />
                      <span className="text-sm">Network Status</span>
                    </div>
                    <Badge className="badge-completed">Connected</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-green-600" />
                      <span className="text-sm">Security Status</span>
                    </div>
                    <Badge className="badge-completed">Secure</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">System Activity Logs</h3>
              <p className="text-sm text-muted-foreground">Monitor all user actions and system events</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Show last:</span>
              <Input
                type="number"
                value={logLimit}
                onChange={(e) => setLogLimit(parseInt(e.target.value) || 50)}
                className="w-20"
                min="10"
                max="1000"
                data-testid="input-log-limit"
              />
              <span className="text-sm">entries</span>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="space-y-0">
                {activityLogs && activityLogs.length > 0 ? (
                  activityLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center gap-4 p-4 border-b last:border-b-0 hover:bg-muted/50">
                      <div className="flex items-center justify-center w-8 h-8">
                        {getActionIcon(log.action)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${getActionColor(log.action)}`}>
                            {log.action.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground mt-1" data-testid={`log-entry-${log.id}`}>
                          {log.details}
                        </p>
                      </div>

                      <Badge variant="outline" className="text-xs">
                        {log.userId?.slice(0, 8)}...
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12" data-testid="text-no-activity-logs">
                    <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Activity Logs</h3>
                    <p className="text-muted-foreground">No system activity has been recorded yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Activity Summary
              </CardTitle>
              <CardDescription>
                Track user engagement and system usage patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users && users.length > 0 ? (
                  users.map((user: any) => {
                    const userLogs = activityLogs?.filter((log: any) => log.userId === user.id) || [];
                    const lastActivity = userLogs.length > 0 ? userLogs[0] : null;
                    
                    return (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Avatar className="w-12 h-12">
                            <AvatarFallback>
                              {user.name.split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <p className="font-semibold" data-testid={`user-activity-${user.id}`}>
                              {user.name}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`px-2 py-1 text-xs font-medium rounded-full border ${
                                user.role === 'admin' ? 'bg-red-100 text-red-800 border-red-200' :
                                user.role === 'doctor' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                'bg-green-100 text-green-800 border-green-200'
                              }`}>
                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </Badge>
                              {!user.isActive && (
                                <Badge variant="secondary" className="text-xs">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {userLogs.length} activities
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lastActivity 
                              ? `Last: ${new Date(lastActivity.timestamp).toLocaleDateString()}`
                              : 'No activity'
                            }
                          </p>
                          {lastActivity && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {lastActivity.action.replace('_', ' ')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8" data-testid="text-no-users-activity">
                    <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No user data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  System Actions
                </CardTitle>
                <CardDescription>
                  Perform administrative system operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-manual-backup"
                >
                  <Database className="w-4 h-4 mr-2" />
                  Run Manual Backup
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-view-logs"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View System Logs
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-system-settings"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  System Configuration
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-security-audit"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Security Audit
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  System Information
                </CardTitle>
                <CardDescription>
                  Current system configuration and environment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Environment:</span>
                    <span className="font-medium ml-2">Production</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-medium ml-2">1.0.0</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uptime:</span>
                    <span className="font-medium ml-2">{systemStatus.server.uptime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Restart:</span>
                    <span className="font-medium ml-2">{systemStatus.server.lastRestart}</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">Quick Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Database Connections</span>
                      <Badge className="badge-completed">
                        {systemStatus.database.connections} active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Backup Status</span>
                      <Badge className="badge-completed">
                        {systemStatus.storage.lastBackup}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Network</span>
                      <Badge className="badge-completed">
                        {systemStatus.network.bandwidth}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
