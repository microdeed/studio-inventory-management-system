import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Package,
  RefreshCw,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  Home,
  FileText,
  User,
  LogOut
} from 'lucide-react';
import { sessionManager } from '../utils/sessionManager.ts';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    fullName: string;
    username: string;
    role: string;
  } | null>(null);
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/equipment', icon: Package, label: 'Equipment' },
    { path: '/checkinout', icon: RefreshCw, label: 'Check In/Out' },
    { path: '/users', icon: Users, label: 'Users' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ];

  useEffect(() => {
    // Get session on mount
    const session = sessionManager.getSession();
    if (session) {
      setCurrentUser({
        fullName: session.fullName,
        username: session.username,
        role: session.role
      });
    }

    // Check session every 10 seconds to update UI if logout happens elsewhere
    const interval = setInterval(() => {
      const session = sessionManager.getSession();
      if (session) {
        setCurrentUser({
          fullName: session.fullName,
          username: session.username,
          role: session.role
        });
      } else {
        setCurrentUser(null);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    sessionManager.clearSession();
    setCurrentUser(null);
    // Reload page to trigger AuthWall
    window.location.reload();
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="app-layout">
      {/* Mobile Header */}
      <div className="mobile-header md:hidden">
        <button onClick={toggleSidebar} className="mobile-menu-btn">
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-bold">Studio Inventory</h1>
        <div></div> {/* Spacer for centering */}
      </div>

      {/* Sidebar Overlay for Mobile */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="flex justify-between items-center">
            <h1 className="sidebar-title">
              <FileText size={28} />
              Studio Inventory
            </h1>
            <button 
              onClick={toggleSidebar}
              className="md:hidden text-white hover:text-gray-200"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm opacity-75 mt-1">Equipment Management</p>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* User Info and Logout */}
        <div className="mt-auto">
          {currentUser && (
            <div className="p-4 border-t border-white border-opacity-10">
              <div className="flex items-start gap-2 text-white text-sm mb-3">
                <User size={16} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{currentUser.fullName}</div>
                  <div className="text-xs opacity-75 truncate">@{currentUser.username}</div>
                  <div className="text-xs opacity-75 mt-0.5">
                    <span className="px-1.5 py-0.5 bg-opacity-20 rounded">
                      {currentUser.role}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm font-medium"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}

          <div className="p-4 text-xs opacity-50 border-t border-white border-opacity-10">
            Studio Inventory v1.0.0
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};