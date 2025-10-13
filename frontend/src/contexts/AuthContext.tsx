import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  currentUser: {
    id: number;
    username: string;
    full_name: string;
    email: string;
    role: string;
    department?: string;
  } | null;
  login: (userId: number, username: string, fullName: string, email: string, role: string, department?: string) => void;
  logout: () => void;
  isAdmin: () => boolean;
  isManager: () => boolean;
  canEdit: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthContextType['currentUser']>(null);

  const login = (userId: number, username: string, fullName: string, email: string, role: string, department?: string) => {
    setCurrentUser({
      id: userId,
      username,
      full_name: fullName,
      email,
      role,
      department
    });
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const isAdmin = () => {
    return currentUser?.role === 'admin';
  };

  const isManager = () => {
    return currentUser?.role === 'manager' || currentUser?.role === 'admin';
  };

  const canEdit = () => {
    return currentUser?.role === 'admin';
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isAdmin, isManager, canEdit }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
