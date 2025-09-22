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

  // Fetch monthly comparison data
  const { data: monthlyData } = useQuery({
    queryKey: ['/api/dashboard/monthly-stats'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/dashboard/monthly-stats?months=6');
      return res.json();
    },
  });

  // Fetch patient retention data
  const { data: patientRetentionData } = useQuery({
    queryKey: ['/api/dashboard/patient-retention'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/dashboard/patient-retention');
      return res.json();
    },
  });

  // Fetch peak hours analysis data
  const { data: peakHoursData } = useQuery({
    queryKey: ['/api/dashboard/peak-hours'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/dashboard/peak-hours');
      return res.json();
    },
  });

  // Calculate approved medical aid claim revenue within date range
  const approvedClaimsRevenue = medicalAidClaims ? 
    medicalAidClaims
      .filter((claim: any) => {
        if (claim.status !== 'approved' || !claim.claimAmount) return false;
        if (!claim.approvedAt) return false;
        
        const approvedDate = new Date(claim.approvedAt).toISOString().split('T')[0];
        return approvedDate >= dateRange.start && approvedDate <= dateRange.end;
      })
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
                <span className="text-green-600 font-bold text-xl">R</span>
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
                <span className="text-green-600 font-bold text-2xl">R</span>
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

      {/* Monthly Comparison - Peak Periods Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Monthly Performance Comparison
          </CardTitle>
          <CardDescription>
            Compare performance across months to identify peak periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData && monthlyData.monthlyData?.length > 0 ? (
            <div className="space-y-6">
              {/* Peak Periods Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-green-600">
                    Peak Revenue Month
                  </h4>
                  {(() => {
                    const peakRevenueMonth = monthlyData.monthlyData.reduce((max: any, month: any) => 
                      month.revenue > max.revenue ? month : max
                    );
                    return (
                      <div>
                        <p className="font-bold text-xl">{peakRevenueMonth.month} {peakRevenueMonth.year}</p>
                        <p className="text-sm text-muted-foreground">R{peakRevenueMonth.revenue.toLocaleString()}</p>
                      </div>
                    );
                  })()}
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-blue-600">
                    Busiest Month
                  </h4>
                  {(() => {
                    const busiestMonth = monthlyData.monthlyData.reduce((max: any, month: any) => 
                      month.appointments > max.appointments ? month : max
                    );
                    return (
                      <div>
                        <p className="font-bold text-xl">{busiestMonth.month} {busiestMonth.year}</p>
                        <p className="text-sm text-muted-foreground">{busiestMonth.appointments} appointments</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Monthly Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Month</th>
                      <th className="text-right p-2 font-medium">Revenue</th>
                      <th className="text-right p-2 font-medium">Appointments</th>
                      <th className="text-right p-2 font-medium">New Patients</th>
                      <th className="text-right p-2 font-medium">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.monthlyData.map((month: any, index: number) => {
                      const isHighRevenue = month.revenue === Math.max(...monthlyData.monthlyData.map((m: any) => m.revenue));
                      const isHighAppointments = month.appointments === Math.max(...monthlyData.monthlyData.map((m: any) => m.appointments));
                      
                      return (
                        <tr 
                          key={index} 
                          className="border-b hover:bg-muted/20"
                          data-testid={`monthly-data-row-${month.month.toLowerCase()}-${month.year}`}
                        >
                          <td className="p-2 font-medium">
                            {month.month} {month.year}
                          </td>
                          <td className={`p-2 text-right font-mono ${isHighRevenue ? 'text-green-600 font-bold' : ''}`}>
                            R{month.revenue.toLocaleString()}
                            {isHighRevenue && <span className="ml-1 text-xs">📈</span>}
                          </td>
                          <td className={`p-2 text-right ${isHighAppointments ? 'text-blue-600 font-bold' : ''}`}>
                            {month.appointments}
                            {isHighAppointments && <span className="ml-1 text-xs">👥</span>}
                          </td>
                          <td className="p-2 text-right">
                            {month.patients}
                          </td>
                          <td className={`p-2 text-right ${month.completionRate >= 90 ? 'text-green-600' : month.completionRate < 70 ? 'text-red-600' : ''}`}>
                            {month.completionRate}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Performance Insights */}
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Peak Period Insights</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
                  {(() => {
                    const avgRevenue = monthlyData.monthlyData.reduce((sum: number, month: any) => sum + month.revenue, 0) / monthlyData.monthlyData.length;
                    const avgAppointments = monthlyData.monthlyData.reduce((sum: number, month: any) => sum + month.appointments, 0) / monthlyData.monthlyData.length;
                    
                    return (
                      <>
                        <div>
                          <p><strong>Average Monthly Revenue:</strong> R{Math.round(avgRevenue).toLocaleString()}</p>
                          <p><strong>Average Monthly Appointments:</strong> {Math.round(avgAppointments)}</p>
                        </div>
                        <div>
                          <p><strong>Total Patients (6 months):</strong> {monthlyData.monthlyData.reduce((sum: number, month: any) => sum + month.patients, 0)}</p>
                          <p><strong>Best Success Rate:</strong> {Math.max(...monthlyData.monthlyData.map((m: any) => m.completionRate))}%</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Loading monthly comparison data...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New vs. Returning Patients Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            New vs. Returning Patients
          </CardTitle>
          <CardDescription>
            Registration trends and patient retention analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {patientRetentionData ? (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                  <h4 className="text-lg font-semibold text-green-600">New Patients</h4>
                  <p className="text-3xl font-bold text-green-700" data-testid="text-new-patients">
                    {patientRetentionData.newVsReturning.newPatients}
                  </p>
                  <p className="text-sm text-green-600">
                    {patientRetentionData.newVsReturning.newPatientRate}% of total
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                  <h4 className="text-lg font-semibold text-blue-600">Returning Patients</h4>
                  <p className="text-3xl font-bold text-blue-700" data-testid="text-returning-patients">
                    {patientRetentionData.newVsReturning.returningPatients}
                  </p>
                  <p className="text-sm text-blue-600">
                    {patientRetentionData.newVsReturning.returningPatientRate}% of total
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-purple-50 dark:bg-purple-950">
                  <h4 className="text-lg font-semibold text-purple-600">Total Active</h4>
                  <p className="text-3xl font-bold text-purple-700" data-testid="text-total-active-patients">
                    {patientRetentionData.newVsReturning.totalPatients}
                  </p>
                  <p className="text-sm text-purple-600">Active patients</p>
                </div>
              </div>

              {/* Retention Rates */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-semibold mb-4">Patient Retention Rates</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600" data-testid="text-30-day-retention">
                      {patientRetentionData.retentionRates.thirtyDay}%
                    </p>
                    <p className="text-sm text-muted-foreground">30-Day Retention</p>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full" 
                        style={{ width: `${patientRetentionData.retentionRates.thirtyDay}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600" data-testid="text-60-day-retention">
                      {patientRetentionData.retentionRates.sixtyDay}%
                    </p>
                    <p className="text-sm text-muted-foreground">60-Day Retention</p>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full" 
                        style={{ width: `${patientRetentionData.retentionRates.sixtyDay}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600" data-testid="text-90-day-retention">
                      {patientRetentionData.retentionRates.ninetyDay}%
                    </p>
                    <p className="text-sm text-muted-foreground">90-Day Retention</p>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ width: `${patientRetentionData.retentionRates.ninetyDay}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Trends Table */}
              <div>
                <h4 className="font-semibold mb-3">6-Month Registration Trends</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Month</th>
                        <th className="text-right p-2 font-medium">New Registrations</th>
                        <th className="text-right p-2 font-medium">Returning Patients</th>
                        <th className="text-right p-2 font-medium">Total Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientRetentionData.registrationTrends.map((trend: any, index: number) => {
                        const totalActivity = trend.newRegistrations + trend.returningPatients;
                        const isHighActivity = totalActivity > 10; // Highlight months with high activity
                        
                        return (
                          <tr 
                            key={index} 
                            className="border-b hover:bg-muted/20"
                            data-testid={`registration-trend-row-${trend.month.toLowerCase()}-${trend.year}`}
                          >
                            <td className="p-2 font-medium">
                              {trend.month} {trend.year}
                            </td>
                            <td className="p-2 text-right text-green-600 font-mono">
                              {trend.newRegistrations}
                            </td>
                            <td className="p-2 text-right text-blue-600 font-mono">
                              {trend.returningPatients}
                            </td>
                            <td className={`p-2 text-right font-bold ${isHighActivity ? 'text-purple-600' : ''}`}>
                              {totalActivity}
                              {isHighActivity && <span className="ml-1 text-xs">🔥</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Key Insights */}
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Patient Retention Insights</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
                  {(() => {
                    const bestRetentionRate = Math.max(
                      patientRetentionData.retentionRates.thirtyDay,
                      patientRetentionData.retentionRates.sixtyDay,
                      patientRetentionData.retentionRates.ninetyDay
                    );
                    const totalNewRegistrations = patientRetentionData.registrationTrends.reduce(
                      (sum: number, trend: any) => sum + trend.newRegistrations, 0
                    );
                    const totalReturningPatients = patientRetentionData.registrationTrends.reduce(
                      (sum: number, trend: any) => sum + trend.returningPatients, 0
                    );
                    
                    return (
                      <>
                        <div>
                          <p><strong>Best Retention Rate:</strong> {bestRetentionRate}%</p>
                          <p><strong>New Registrations (6 months):</strong> {totalNewRegistrations}</p>
                        </div>
                        <div>
                          <p><strong>Returning Patients (6 months):</strong> {totalReturningPatients}</p>
                          <p><strong>Patient Loyalty Score:</strong> {patientRetentionData.newVsReturning.returningPatientRate}%</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Loading patient retention analytics...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Peak Hours Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Peak Hours Analysis
          </CardTitle>
          <CardDescription>
            Busiest times of day and week (last 3 months)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {peakHoursData ? (
            <div className="space-y-6">
              {/* Peak Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg bg-orange-50 dark:bg-orange-950">
                  <h4 className="text-lg font-semibold text-orange-600">Peak Hour</h4>
                  <p className="text-3xl font-bold text-orange-700" data-testid="text-peak-hour">
                    {peakHoursData.peakHour.timeLabel}
                  </p>
                  <p className="text-sm text-orange-600">
                    {peakHoursData.peakHour.count} appointments
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-indigo-50 dark:bg-indigo-950">
                  <h4 className="text-lg font-semibold text-indigo-600">Peak Day</h4>
                  <p className="text-3xl font-bold text-indigo-700" data-testid="text-peak-day">
                    {peakHoursData.peakDay.day}
                  </p>
                  <p className="text-sm text-indigo-600">
                    {peakHoursData.peakDay.count} appointments
                  </p>
                </div>
              </div>

              {/* Hourly Distribution */}
              <div>
                <h4 className="font-semibold mb-3">Hourly Distribution</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {peakHoursData.hourlyDistribution.map((hourData: any) => {
                    const isBusinessHour = hourData.hour >= 8 && hourData.hour <= 17;
                    const isPeakHour = hourData.hour === peakHoursData.peakHour.hour;
                    const formatTime = (hour: number) => {
                      if (hour === 0) return '12 AM';
                      if (hour < 12) return `${hour} AM`;
                      if (hour === 12) return '12 PM';
                      return `${hour - 12} PM`;
                    };
                    
                    return (
                      <div
                        key={hourData.hour}
                        className={`p-2 text-center rounded border-2 ${
                          isPeakHour
                            ? 'bg-orange-100 dark:bg-orange-900 border-orange-400'
                            : isBusinessHour
                            ? 'bg-blue-50 dark:bg-blue-950 border-blue-200'
                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200'
                        }`}
                        data-testid={`hour-block-${hourData.hour}`}
                      >
                        <div className="text-xs font-medium">
                          {formatTime(hourData.hour)}
                        </div>
                        <div className="font-bold text-sm">
                          {hourData.count}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {hourData.percentage}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-100 border-2 border-orange-400 rounded"></div>
                    <span>Peak Hour</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-50 border-2 border-blue-200 rounded"></div>
                    <span>Business Hours (8 AM - 5 PM)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-50 border-2 border-gray-200 rounded"></div>
                    <span>After Hours</span>
                  </div>
                </div>
              </div>

              {/* Daily Distribution */}
              <div>
                <h4 className="font-semibold mb-3">Daily Distribution</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {peakHoursData.dailyDistribution.map((dayData: any) => {
                    const isPeakDay = dayData.day === peakHoursData.peakDay.day;
                    const isWeekend = dayData.dayNumber === 0 || dayData.dayNumber === 6;
                    
                    return (
                      <div
                        key={dayData.day}
                        className={`p-4 text-center rounded-lg border-2 ${
                          isPeakDay
                            ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-400'
                            : isWeekend
                            ? 'bg-purple-50 dark:bg-purple-950 border-purple-200'
                            : 'bg-green-50 dark:bg-green-950 border-green-200'
                        }`}
                        data-testid={`day-block-${dayData.day.toLowerCase()}`}
                      >
                        <div className="font-semibold text-sm mb-1">{dayData.day}</div>
                        <div className="text-2xl font-bold mb-1">{dayData.count}</div>
                        <div className="text-xs text-muted-foreground">{dayData.percentage}% of total</div>
                        <div className="w-full bg-muted rounded-full h-2 mt-2">
                          <div 
                            className={`h-2 rounded-full ${
                              isPeakDay ? 'bg-indigo-500' : isWeekend ? 'bg-purple-400' : 'bg-green-400'
                            }`}
                            style={{ width: `${Math.max(dayData.percentage, 5)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Peak Hours Insights */}
              <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Peak Hours Insights</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700 dark:text-yellow-300">
                  {(() => {
                    const businessHoursAppointments = peakHoursData.hourlyDistribution
                      .filter((h: any) => h.hour >= 8 && h.hour <= 17)
                      .reduce((sum: number, h: any) => sum + h.count, 0);
                    
                    const totalAppointments = peakHoursData.hourlyDistribution
                      .reduce((sum: number, h: any) => sum + h.count, 0);
                    
                    const businessHoursPercentage = totalAppointments > 0 
                      ? Math.round((businessHoursAppointments / totalAppointments) * 100) : 0;

                    const weekdayAppointments = peakHoursData.dailyDistribution
                      .filter((d: any) => d.dayNumber > 0 && d.dayNumber < 6)
                      .reduce((sum: number, d: any) => sum + d.count, 0);
                    
                    const weekdayPercentage = totalAppointments > 0 
                      ? Math.round((weekdayAppointments / totalAppointments) * 100) : 0;
                    
                    return (
                      <>
                        <div>
                          <p><strong>Business Hours Activity:</strong> {businessHoursPercentage}% (8 AM - 5 PM)</p>
                          <p><strong>Most Active Time:</strong> {peakHoursData.peakHour.timeLabel}</p>
                        </div>
                        <div>
                          <p><strong>Weekday Activity:</strong> {weekdayPercentage}% (Mon-Fri)</p>
                          <p><strong>Most Active Day:</strong> {peakHoursData.peakDay.day}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Loading peak hours analysis...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
