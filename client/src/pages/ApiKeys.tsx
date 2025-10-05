import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Key, Plus, Trash2, Copy, AlertCircle, CheckCircle
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type CreateApiKeyData = z.infer<typeof createApiKeySchema>;

interface ApiKey {
  id: string;
  name: string;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function ApiKeys() {
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<CreateApiKeyData>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      name: '',
    },
  });

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['/api/api-keys'],
  });

  const createApiKeyMutation = useMutation({
    mutationFn: async (data: CreateApiKeyData) => {
      const res = await apiRequest('POST', '/api/api-keys', data);
      return res.json();
    },
    onSuccess: (data) => {
      setNewApiKey(data.key);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      toast({
        title: 'API Key Created',
        description: 'Your new API key has been generated. Make sure to copy it now!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create API key',
        variant: 'destructive',
      });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/api-keys/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      toast({
        title: 'API Key Revoked',
        description: 'The API key has been revoked successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to revoke API key',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CreateApiKeyData) => {
    createApiKeyMutation.mutate(data);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'API key copied to clipboard',
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8" />
            API Keys
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage API keys for n8n and other integrations
          </p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          API keys provide full access to your account. Keep them secure and never share them publicly.
          Use these keys for automation tools like n8n.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Create New API Key</CardTitle>
          <CardDescription>
            Generate a new API key for external integrations
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
                    <FormLabel>Key Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., n8n Integration" 
                        data-testid="input-api-key-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                disabled={createApiKeyMutation.isPending}
                data-testid="button-create-api-key"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {newApiKey && (
        <Dialog open={!!newApiKey} onOpenChange={() => setNewApiKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                API Key Created Successfully
              </DialogTitle>
              <DialogDescription>
                Copy this API key now. You won't be able to see it again!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md font-mono text-sm break-all">
                {newApiKey}
              </div>
              <Button 
                onClick={() => copyToClipboard(newApiKey)} 
                className="w-full"
                data-testid="button-copy-api-key"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </Button>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Store this key securely. Use it in your n8n HTTP Request node by adding it to the Authorization header as: <code>Bearer {newApiKey.substring(0, 10)}...</code>
                </AlertDescription>
              </Alert>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            Active API keys for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading API keys...</p>
          ) : !apiKeys || apiKeys.length === 0 ? (
            <p className="text-muted-foreground">No API keys created yet.</p>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`api-key-${key.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold" data-testid={`text-api-key-name-${key.id}`}>
                        {key.name}
                      </h3>
                      {key.isActive ? (
                        <Badge variant="default" data-testid={`badge-active-${key.id}`}>Active</Badge>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-revoked-${key.id}`}>Revoked</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <p>Created: {formatDate(key.createdAt)}</p>
                      <p>Last used: {formatDate(key.lastUsedAt)}</p>
                    </div>
                  </div>
                  {key.isActive && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Are you sure you want to revoke "${key.name}"?`)) {
                          deleteApiKeyMutation.mutate(key.id);
                        }
                      }}
                      disabled={deleteApiKeyMutation.isPending}
                      data-testid={`button-revoke-${key.id}`}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
