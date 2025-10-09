import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { loginSchema, type LoginRequest } from '@shared/schema';
import { setToken } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import invoTechLogo from '@assets/invotech-high-resolution-logo (1)_1757968142020.png';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Login failed');
      }

      return res.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      window.location.href = '/';
    },
    onError: (error) => {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LoginRequest) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 flex items-center justify-center mb-4">
              <img 
                src={invoTechLogo} 
                alt="InvoTech Logo" 
                className="w-16 h-16 object-contain"
              />
            </div>
            <CardTitle className="text-2xl font-bold">InvoTech Health Care System</CardTitle>
            <CardDescription>
              Sign in to access the health care management system
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                          autoComplete="username"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            data-testid="input-password"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </Form>

            <div className="text-center mt-4">
              <button className="text-sm text-primary hover:text-primary/80" data-testid="link-forgot-password">
                Forgot your password?
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <footer className="py-4">
        <p className="text-xs text-center text-muted-foreground">
          © 2025 InvoTech Solutions (Pty) Ltd. All rights reserved.
        </p>
        <p className="text-xs text-center text-muted-foreground mt-1">
          <span className="hover:text-foreground cursor-pointer">Privacy Policy</span>
          {" | "}
          <span className="hover:text-foreground cursor-pointer">Terms of Service</span>
          {" | "}
          <span className="hover:text-foreground cursor-pointer">Support</span>
        </p>
      </footer>
    </div>
  );
}
