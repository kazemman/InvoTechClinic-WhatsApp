import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import PatientRegistration from "@/pages/PatientRegistration";
import Appointments from "@/pages/Appointments";
import CheckIn from "@/pages/CheckIn";
import QueueManagement from "@/pages/QueueManagement";
import DoctorPage from "@/pages/DoctorPage";
import BusinessInsights from "@/pages/BusinessInsights";
import UserManagement from "@/pages/UserManagement";
import SystemAdmin from "@/pages/SystemAdmin";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/patients">
        <ProtectedRoute requiredRoles={['staff', 'admin']}>
          <Layout>
            <PatientRegistration />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/appointments">
        <ProtectedRoute requiredRoles={['staff', 'admin', 'doctor']}>
          <Layout>
            <Appointments />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/checkin">
        <ProtectedRoute requiredRoles={['staff', 'admin']}>
          <Layout>
            <CheckIn />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/queue">
        <ProtectedRoute requiredRoles={['staff', 'admin', 'doctor']}>
          <Layout>
            <QueueManagement />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/doctor">
        <ProtectedRoute requiredRoles={['doctor']}>
          <Layout>
            <DoctorPage />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/insights">
        <ProtectedRoute requiredRoles={['admin']}>
          <Layout>
            <BusinessInsights />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/users">
        <ProtectedRoute requiredRoles={['admin']}>
          <Layout>
            <UserManagement />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute requiredRoles={['admin']}>
          <Layout>
            <SystemAdmin />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
