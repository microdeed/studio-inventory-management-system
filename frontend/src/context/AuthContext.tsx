import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'manager' | 'user';
  email: string;
  department?: string;
}

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAdmin: () => boolean;
  isManager: () => boolean;
  canEdit: () => boolean;
  canDelete: () => boolean;
  requireAuth: (action: string) => Promise<{ userId: number; userRole: string } | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  // Save user to localStorage when it changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  /**
   * Check if current user is admin
   */
  const isAdmin = (): boolean => {
    return currentUser?.role === 'admin';
  };

  /**
   * Check if current user is manager
   */
  const isManager = (): boolean => {
    return currentUser?.role === 'manager' || currentUser?.role === 'admin';
  };

  /**
   * Check if current user can edit
   * Only admins can edit
   */
  const canEdit = (): boolean => {
    return isAdmin();
  };

  /**
   * Check if current user can delete
   * Only admins can delete
   */
  const canDelete = (): boolean => {
    return isAdmin();
  };

  /**
   * Require authentication for an action
   * Returns user info if authenticated, null otherwise
   */
  const requireAuth = async (action: string): Promise<{ userId: number; userRole: string } | null> => {
    // For now, just return current user if set
    // In a full implementation, this would trigger the PIN modal
    if (currentUser) {
      return {
        userId: currentUser.id,
        userRole: currentUser.role
      };
    }
    return null;
  };

  /**
   * Logout current user
   */
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const value: AuthContextType = {
    currentUser,
    setCurrentUser,
    isAdmin,
    isManager,
    canEdit,
    canDelete,
    requireAuth,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
