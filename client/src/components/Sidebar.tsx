import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, logout } from '@/lib/auth';
import { 
  LayoutDashboard, UserPlus, Calendar, ClipboardCheck, 
  Users, UserRound, TrendingUp, Settings, Shield,
  X, CreditCard, Sun, Moon
} from 'lucide-react';
import invoTechLogo from '@assets/invotech-high-resolution-logo (1)_1757968142020.png';
import { useTheme } from './ThemeProvider';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

export default function Sidebar({ isOpen, onClose, isMobile }: SidebarProps) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/me');
      return res.json();
    },
  });

  const { data: queueCount } = useQuery({
    queryKey: ['/api/queue'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/queue');
      const queue = await res.json();
      return queue.length;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['staff', 'admin', 'doctor'] },
    { icon: UserPlus, label: 'Patient Registration', path: '/patients', roles: ['staff', 'admin'] },
    { icon: Calendar, label: 'Appointments', path: '/appointments', roles: ['staff', 'admin', 'doctor'] },
    { icon: ClipboardCheck, label: 'Check-in', path: '/checkin', roles: ['staff', 'admin'] },
    { icon: Users, label: 'Queue Management', path: '/queue', roles: ['staff', 'admin', 'doctor'] },
    { icon: UserRound, label: "Doctor's Page", path: '/doctor', roles: ['doctor', 'admin'] },
    { icon: CreditCard, label: 'Medical Aid Claims', path: '/medical-aid', roles: ['staff', 'admin'] },
    { icon: TrendingUp, label: 'Business Insights', path: '/insights', roles: ['admin'] },
    { icon: Settings, label: 'User Management', path: '/users', roles: ['admin'] },
    { icon: Shield, label: 'System Admin', path: '/admin', roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const sidebarClasses = `
    sidebar-transition bg-card border-r border-border w-64 flex-shrink-0 z-30
    ${isMobile ? `sidebar-mobile fixed inset-y-0 left-0 ${isOpen ? 'open' : ''}` : ''}
  `;

  return (
    <div className={sidebarClasses}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <img 
              src={invoTechLogo} 
              alt="InvoTech Logo" 
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-lg font-semibold text-foreground">InvoTech</h1>
              <p className="text-sm text-muted-foreground">Clinic Management</p>
            </div>
          </div>
          {isMobile && (
            <button 
              data-testid="button-close-sidebar"
              onClick={onClose} 
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground" data-testid="text-user-name">
                  {user.name}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-user-role">
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`
                  flex items-center space-x-3 px-3 py-2 rounded-md transition-colors
                  ${isActive 
                    ? 'bg-primary text-primary-foreground font-medium' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                `}
                data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={isMobile ? onClose : undefined}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.label === 'Queue Management' && queueCount !== undefined && queueCount > 0 && (
                  <span 
                    className="ml-auto bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full font-medium"
                    data-testid="text-queue-count"
                  >
                    {queueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle & Logout */}
        <div className="p-4 border-t border-border space-y-2">
          <button 
            onClick={toggleTheme}
            data-testid="button-toggle-theme"
            className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
          
          <button 
            onClick={logout}
            data-testid="button-logout"
            className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full"
          >
            <i className="fas fa-sign-out-alt w-5"></i>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
