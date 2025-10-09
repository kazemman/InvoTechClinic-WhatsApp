import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />
      
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                data-testid="button-open-sidebar"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-muted-foreground hover:text-foreground"
              >
                <i className="fas fa-bars text-xl"></i>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Welcome back, manage your clinic efficiently</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

        <footer className="bg-card border-t border-border px-6 py-3">
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
    </div>
  );
}
