import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatTime } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileText, Users, Clock, CheckCircle, XCircle, 
  Send, Calendar, Building, Phone, IdCard
} from 'lucide-react';

export default function MedicalAid() {
  const [editingClaim, setEditingClaim] = useState<any>(null);
  const [updateData, setUpdateData] = useState<any>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: claims, isLoading } = useQuery({
    queryKey: ['/api/medical-aid-claims'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/medical-aid-claims');
      return res.json();
    },
  });

  const updateClaimMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & any) => {
      const res = await apiRequest('PUT', `/api/medical-aid-claims/${id}`, data);
      return res.json();
    },
    onSuccess: (updatedClaim) => {
      toast({
        title: 'Claim Updated',
        description: `Medical aid claim status updated successfully.`,
      });
      setEditingClaim(null);
      setUpdateData({});
      queryClient.invalidateQueries({ queryKey: ['/api/medical-aid-claims'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const startEditing = (claim: any) => {
    setEditingClaim(claim);
    setUpdateData({
      status: claim.status,
      notes: claim.notes || '',
      submittedAt: claim.submittedAt ? new Date(claim.submittedAt).toISOString().slice(0, 16) : '',
      approvedAt: claim.approvedAt ? new Date(claim.approvedAt).toISOString().slice(0, 16) : ''
    });
  };

  const cancelEditing = () => {
    setEditingClaim(null);
    setUpdateData({});
  };

  const saveUpdate = () => {
    if (!editingClaim) return;
    
    const updatePayload: any = {
      status: updateData.status,
      notes: updateData.notes
    };

    // Include date fields if they have values
    if (updateData.submittedAt) {
      updatePayload.submittedAt = new Date(updateData.submittedAt).toISOString();
    }
    if (updateData.approvedAt) {
      updatePayload.approvedAt = new Date(updateData.approvedAt).toISOString();
    }

    updateClaimMutation.mutate({ id: editingClaim.id, ...updatePayload });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200" data-testid={`status-pending`}>
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>;
      case 'submitted':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200" data-testid={`status-submitted`}>
          <Send className="w-3 h-3 mr-1" />
          Submitted
        </Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200" data-testid={`status-approved`}>
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200" data-testid={`status-rejected`}>
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>;
      default:
        return <Badge variant="outline" data-testid={`status-unknown`}>{status}</Badge>;
    }
  };

  // Calculate statistics
  const stats = claims ? {
    total: claims.length,
    pending: claims.filter((c: any) => c.status === 'pending').length,
    submitted: claims.filter((c: any) => c.status === 'submitted').length,
    approved: claims.filter((c: any) => c.status === 'approved').length,
    rejected: claims.filter((c: any) => c.status === 'rejected').length
  } : { total: 0, pending: 0, submitted: 0, approved: 0, rejected: 0 };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Medical Aid Claims</h1>
            <p className="text-muted-foreground">Track and manage medical aid claim submissions</p>
          </div>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-muted-foreground">Loading claims...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Medical Aid Claims</h1>
          <p className="text-muted-foreground">Track and manage medical aid claim submissions</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Claims</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-total-claims">
                  {stats.total}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="text-blue-600 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600" data-testid="text-pending-claims">
                  {stats.pending}
                </p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="text-yellow-600 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-submitted-claims">
                  {stats.submitted}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Send className="text-blue-600 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-approved-claims">
                  {stats.approved}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-rejected-claims">
                  {stats.rejected}
                </p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="text-red-600 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claims List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Medical Aid Claims ({claims?.length || 0})
          </CardTitle>
          <CardDescription>
            Manage medical aid claim submissions and approvals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {claims && claims.length > 0 ? (
            <div className="space-y-4">
              {claims.map((claim: any) => (
                <div key={claim.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      {/* Patient Info */}
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-medium text-foreground" data-testid={`text-patient-name-${claim.id}`}>
                            {claim.patient.firstName} {claim.patient.lastName}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {claim.patient.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              {claim.patient.medicalAidScheme || 'No scheme'}
                            </span>
                            <span className="flex items-center gap-1">
                              <IdCard className="w-3 h-3" />
                              {claim.patient.medicalAidNumber || 'No member number'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Claim Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Check-in Time</p>
                          <p className="font-medium" data-testid={`text-checkin-time-${claim.id}`}>
                            {formatDate(new Date(claim.checkIn.checkInTime))} at {formatTime(new Date(claim.checkIn.checkInTime))}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment Method</p>
                          <Badge variant="outline" className="w-fit">
                            {claim.checkIn.paymentMethod.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Submitted</p>
                          <p className="font-medium">
                            {claim.submittedAt ? formatDate(new Date(claim.submittedAt)) : 'Not submitted'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Approved</p>
                          <p className="font-medium">
                            {claim.approvedAt ? formatDate(new Date(claim.approvedAt)) : 'Not approved'}
                          </p>
                        </div>
                      </div>

                      {/* Notes */}
                      {claim.notes && (
                        <div>
                          <p className="text-sm text-muted-foreground">Notes</p>
                          <p className="text-sm" data-testid={`text-notes-${claim.id}`}>{claim.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Status and Actions */}
                    <div className="flex items-center gap-3">
                      {getStatusBadge(claim.status)}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => startEditing(claim)}
                        data-testid={`button-edit-${claim.id}`}
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No medical aid claims found</p>
              <p className="text-sm">Claims will appear here when patients check in with medical aid payment methods</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editingClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Update Medical Aid Claim</CardTitle>
              <CardDescription>
                Update claim status for {editingClaim.patient.firstName} {editingClaim.patient.lastName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={updateData.status} 
                  onValueChange={(value) => setUpdateData({...updateData, status: value})}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="submittedAt">Submitted Date & Time</Label>
                <Input
                  id="submittedAt"
                  type="datetime-local"
                  value={updateData.submittedAt}
                  onChange={(e) => setUpdateData({...updateData, submittedAt: e.target.value})}
                  data-testid="input-submitted-at"
                />
              </div>

              <div>
                <Label htmlFor="approvedAt">Approved Date & Time</Label>
                <Input
                  id="approvedAt"
                  type="datetime-local"
                  value={updateData.approvedAt}
                  onChange={(e) => setUpdateData({...updateData, approvedAt: e.target.value})}
                  data-testid="input-approved-at"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={updateData.notes}
                  onChange={(e) => setUpdateData({...updateData, notes: e.target.value})}
                  placeholder="Add notes about this claim..."
                  data-testid="textarea-notes"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={saveUpdate} 
                  disabled={updateClaimMutation.isPending}
                  data-testid="button-save-update"
                >
                  {updateClaimMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={cancelEditing} data-testid="button-cancel-update">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}