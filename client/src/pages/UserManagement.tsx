import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { insertUserSchema, type InsertUser } from '@shared/schema';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { 
  UserPlus, Users, Mail, Edit, Trash2, 
  Shield, UserCheck, UserX, Settings
} from 'lucide-react';

export default function UserManagement() {
  const [editingUser, setEditingUser] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: '',
      passwordHash: '',
      name: '',
      role: 'staff',
    },
  });

  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      return res.json();
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await apiRequest('POST', '/api/users', data);
      return res.json();
    },
    onSuccess: (user) => {
      toast({
        title: 'User Created',
        description: `${user.name} has been successfully created.`,
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: 'Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<InsertUser>) => {
      const res = await apiRequest('PUT', `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: (user) => {
      toast({
        title: 'User Updated',
        description: `${user.name} has been successfully updated.`,
      });
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/users/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'User Deleted',
        description: 'User has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: 'Deletion Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: InsertUser) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, ...data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const startEditing = (user: any) => {
    setEditingUser(user);
    form.reset({
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: '', // Don't pre-fill password
    });
  };

  const cancelEditing = () => {
    setEditingUser(null);
    form.reset();
  };

  const toggleUserStatus = (user: any) => {
    updateUserMutation.mutate({
      id: user.id,
      isActive: !user.isActive
    });
  };

  const deleteUser = (id: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteUserMutation.mutate(id);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'doctor': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staff': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const roleStats = users ? {
    total: users.length,
    admins: users.filter((u: any) => u.role === 'admin').length,
    doctors: users.filter((u: any) => u.role === 'doctor').length,
    staff: users.filter((u: any) => u.role === 'staff').length,
    active: users.filter((u: any) => u.isActive).length,
  } : { total: 0, admins: 0, doctors: 0, staff: 0, active: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage system users, roles, and permissions</p>
        </div>
      </div>

      {/* User Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold" data-testid="text-total-users">{roleStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold" data-testid="text-admin-count">{roleStats.admins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Doctors</p>
                <p className="text-2xl font-bold" data-testid="text-doctor-count">{roleStats.doctors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Staff</p>
                <p className="text-2xl font-bold" data-testid="text-staff-count">{roleStats.staff}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold" data-testid="text-active-count">{roleStats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {editingUser ? 'Edit User' : 'Create New User'}
            </CardTitle>
            <CardDescription>
              {editingUser ? 'Update user information and role' : 'Add new users to the system with appropriate roles'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-user-name" />
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
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-user-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="doctor">Doctor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passwordHash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="password" 
                          data-testid="input-user-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    className="flex-1" 
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    data-testid="button-save-user"
                  >
                    {editingUser ? 'Update User' : 'Create User'}
                  </Button>
                  {editingUser && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={cancelEditing}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              System Users
            </CardTitle>
            <CardDescription>
              Manage existing users, roles, and account status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users && users.length > 0 ? (
                users.map((user: any) => (
                  <div key={user.id} className="border rounded-lg p-4 hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback>
                            {user.name.split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-lg" data-testid={`text-user-name-${user.id}`}>
                              {user.name}
                            </span>
                            {!user.isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              <span>{user.email}</span>
                            </div>
                            <Badge className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleBadgeClass(user.role)}`}>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </Badge>
                          </div>
                          
                          <div className="text-xs text-muted-foreground mt-1">
                            Created: {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Active</span>
                          <Switch
                            checked={user.isActive}
                            onCheckedChange={() => toggleUserStatus(user)}
                            data-testid={`switch-user-status-${user.id}`}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(user)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteUser(user.id)}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12" data-testid="text-no-users">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Users Found</h3>
                  <p className="text-muted-foreground">Create your first user to get started.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            Understanding user roles and their access levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Staff
                </Badge>
                <span className="font-medium">Staff Members</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Patient registration and management</li>
                <li>• Appointment scheduling</li>
                <li>• Patient check-in</li>
                <li>• Queue management</li>
                <li>• Basic reporting</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                  Doctor
                </Badge>
                <span className="font-medium">Medical Doctors</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• All staff permissions</li>
                <li>• Patient consultations</li>
                <li>• Medical records access</li>
                <li>• Prescription management</li>
                <li>• Queue management for assigned patients</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-800 border-red-200">
                  Admin
                </Badge>
                <span className="font-medium">System Administrators</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• All system permissions</li>
                <li>• User management</li>
                <li>• Business insights and analytics</li>
                <li>• System administration</li>
                <li>• Financial reporting</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
