import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, DollarSign, Users, Calendar,
  CreditCard, Activity, Clock, BarChart3
} from 'lucide-react';

export default function BusinessInsights() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0]
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/dashboard/stats');
      return res.json();
    },
  });

  const { data: revenueData } = useQuery({
    queryKey: ['/api/payments', dateRange.start, dateRange.end],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/payments?date=${dateRange.end}`);
      return res.json();
    },
  });

  const { data: appointmentStats } = useQuery({
    queryKey: ['/api/appointments', dateRange.end],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/appointments?date=${dateRange.end}`);
      return res.json();
    },
  });

  const { data: medicalAidClaims } = useQuery({
    queryKey: ['/api/medical-aid-claims'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/medical-aid-claims');
      return res.json();
    },
  });

  // Calculate approved medical aid claim revenue
  const approvedClaimsRevenue = medicalAidClaims ? 
    medicalAidClaims
      .filter((claim: any) => claim.status === 'approved' && claim.claimAmount)
      .reduce((sum: number, claim: any) => sum + parseFloat(claim.claimAmount || 0), 0) : 0;

  // Calculate revenue statistics
  const revenueStats = revenueData ? {
    total: revenueData.reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0) + approvedClaimsRevenue,
    cash: revenueData.filter((p: any) => p.paymentMethod === 'cash').reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0),
    medicalAid: revenueData.filter((p: any) => p.paymentMethod === 'medical_aid').reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0),
    both: revenueData.filter((p: any) => p.paymentMethod === 'both').reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0),
    approvedClaims: approvedClaimsRevenue,
    count: revenueData.length
  } : { total: approvedClaimsRevenue, cash: 0, medicalAid: 0, both: 0, approvedClaims: approvedClaimsRevenue, count: 0 };

  // Calculate appointment statistics
  const appointmentData = appointmentStats ? {
    total: appointmentStats.length,
    completed: appointmentStats.filter((a: any) => a.status === 'completed').length,
    cancelled: appointmentStats.filter((a: any) => a.status === 'cancelled').length,
    scheduled: appointmentStats.filter((a: any) => a.status === 'scheduled').length,
    walkIns: 0 // This would need to be calculated from check-ins
  } : { total: 0, completed: 0, cancelled: 0, scheduled: 0, walkIns: 0 };

  const performanceMetrics = {
    completionRate: appointmentData.total > 0 ? Math.round((appointmentData.completed / appointmentData.total) * 100) : 0,
    cancellationRate: appointmentData.total > 0 ? Math.round((appointmentData.cancelled / appointmentData.total) * 100) : 0,
    avgRevenuePerVisit: revenueStats.count > 0 ? Math.round(revenueStats.total / revenueStats.count) : 0
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Business Insights</h1>
          <p className="text-muted-foreground">Revenue tracking and performance analytics</p>
        </div>
        <div className="flex items-center gap-4">
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="w-auto"
            data-testid="input-date-start"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="w-auto"
            data-testid="input-date-end"
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-total-revenue">
                  R{revenueStats.total.toLocaleString()}
                </p>
                <p className="text-sm text-accent mt-1">
                  <TrendingUp className="inline w-3 h-3 mr-1" />
                  Today: R{dashboardStats?.todayRevenue || 0}
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
                <p className="text-sm font-medium text-muted-foreground">Total Visits</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-total-visits">
                  {revenueStats.count}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  <Calendar className="inline w-3 h-3 mr-1" />
                  Appointments: {appointmentData.total}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-completion-rate">
                  {performanceMetrics.completionRate}%
                </p>
                <p className="text-sm text-accent mt-1">
                  <Activity className="inline w-3 h-3 mr-1" />
                  {appointmentData.completed} completed
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-purple-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Revenue/Visit</p>
                <p className="text-3xl font-bold text-foreground" data-testid="text-avg-revenue-per-visit">
                  R{performanceMetrics.avgRevenuePerVisit}
                </p>
                <p className="text-sm text-orange-600 mt-1">
                  <Clock className="inline w-3 h-3 mr-1" />
                  Per patient
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-orange-600 w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Method Breakdown
            </CardTitle>
            <CardDescription>
              Revenue distribution by payment method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="font-medium">Cash Payments</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-cash-revenue">R{revenueStats.cash.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">
                    {revenueStats.total > 0 ? Math.round((revenueStats.cash / revenueStats.total) * 100) : 0}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="font-medium">Medical Aid</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-medical-aid-revenue">R{revenueStats.medicalAid.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">
                    {revenueStats.total > 0 ? Math.round((revenueStats.medicalAid / revenueStats.total) * 100) : 0}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-purple-500 rounded"></div>
                  <span className="font-medium">Combined Payment</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-both-revenue">R{revenueStats.both.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">
                    {revenueStats.total > 0 ? Math.round((revenueStats.both / revenueStats.total) * 100) : 0}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                  <span className="font-medium">Approved Medical Aid Claims</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-approved-claims-revenue">R{revenueStats.approvedClaims.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">
                    {revenueStats.total > 0 ? Math.round((revenueStats.approvedClaims / revenueStats.total) * 100) : 0}%
                  </p>
                </div>
              </div>

              {/* Revenue Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span>Payment Distribution</span>
                  <span>R{revenueStats.total.toLocaleString()}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 flex overflow-hidden">
                  <div 
                    className="bg-green-500" 
                    style={{ width: `${revenueStats.total > 0 ? (revenueStats.cash / revenueStats.total) * 100 : 0}%` }}
                  ></div>
                  <div 
                    className="bg-blue-500" 
                    style={{ width: `${revenueStats.total > 0 ? (revenueStats.medicalAid / revenueStats.total) * 100 : 0}%` }}
                  ></div>
                  <div 
                    className="bg-purple-500" 
                    style={{ width: `${revenueStats.total > 0 ? (revenueStats.both / revenueStats.total) * 100 : 0}%` }}
                  ></div>
                  <div 
                    className="bg-emerald-500" 
                    style={{ width: `${revenueStats.total > 0 ? (revenueStats.approvedClaims / revenueStats.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointment Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Appointment Analytics
            </CardTitle>
            <CardDescription>
              Visit statistics and appointment performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-green-600" data-testid="text-completed-appointments">
                    {appointmentData.completed}
                  </p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-blue-600" data-testid="text-scheduled-appointments">
                    {appointmentData.scheduled}
                  </p>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Completion Rate</span>
                  <Badge className="badge-completed">
                    {performanceMetrics.completionRate}%
                  </Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${performanceMetrics.completionRate}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cancellation Rate</span>
                  <Badge className="badge-urgent">
                    {performanceMetrics.cancellationRate}%
                  </Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{ width: `${performanceMetrics.cancellationRate}%` }}
                  ></div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Performance Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Appointments:</span>
                    <span className="font-medium ml-2">{appointmentData.total}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cancelled:</span>
                    <span className="font-medium ml-2">{appointmentData.cancelled}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Clinic Efficiency Metrics
          </CardTitle>
          <CardDescription>
            Monitor clinic performance and patient flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg" data-testid="text-total-patients-served">
                {revenueStats.count}
              </h3>
              <p className="text-muted-foreground">Patients Served</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg" data-testid="text-efficiency-metric">
                R{performanceMetrics.avgRevenuePerVisit}
              </h3>
              <p className="text-muted-foreground">Revenue per Patient</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg" data-testid="text-success-rate">
                {performanceMetrics.completionRate}%
              </h3>
              <p className="text-muted-foreground">Success Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
