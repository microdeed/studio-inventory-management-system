import React, { useState, useEffect } from 'react';
import { PinEntryModal } from './PinEntryModal.tsx';
import { sessionManager } from '../utils/sessionManager.ts';

interface AuthWallProps {
  children: React.ReactNode;
}

/**
 * Global authentication wall
 * Requires PIN authentication before accessing any part of the application
 * Enforces 30-minute session timeout
 */
export const AuthWall: React.FC<AuthWallProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    // Check if there's an existing valid session
    checkSession();

    // Set up interval to check session validity every minute
    const sessionCheckInterval = setInterval(() => {
      checkSession();
    }, 60000); // Check every minute

    return () => clearInterval(sessionCheckInterval);
  }, []);

  const checkSession = () => {
    const session = sessionManager.getSession();

    if (session) {
      setIsAuthenticated(true);
      setShowPinModal(false);
    } else {
      setIsAuthenticated(false);
      setShowPinModal(true);
    }

    setIsCheckingSession(false);
  };

  const handlePinSuccess = async (userId: number, userRole: string) => {
    try {
      console.log('[AuthWall] PIN verification successful');
      console.log('[AuthWall] User ID:', userId);
      console.log('[AuthWall] User role from PIN verification:', userRole);

      // Fetch user details
      const response = await fetch(`/api/users`);
      const users = await response.json();
      const user = users.find((u: any) => u.id === userId);

      if (user) {
        console.log('[AuthWall] User details fetched:', user);

        // Set session with user details
        const sessionData = {
          userId: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: userRole,
          department: user.department
        };

        console.log('[AuthWall] Setting session with data:', sessionData);
        sessionManager.setSession(sessionData);

        // Verify session was set
        const verifySession = sessionManager.getSession();
        console.log('[AuthWall] Session verification after setting:', verifySession);

        setIsAuthenticated(true);
        setShowPinModal(false);
      }
    } catch (error) {
      console.error('Failed to fetch user details:', error);
      alert('Authentication failed. Please try again.');
    }
  };

  const handlePinCancel = () => {
    // Can't cancel global auth - user must authenticate
    // Just keep the modal open
    setShowPinModal(true);
  };

  // Show loading state while checking session
  if (isCheckingSession) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f9fafb'
      }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Show PIN entry modal if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f9fafb',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '2rem'
          }}>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: '0.5rem'
            }}>
              Equipment Inventory System
            </h1>
            <p style={{
              color: '#6b7280',
              fontSize: '1rem'
            }}>
              Please enter your PIN to access the system
            </p>
          </div>
        </div>

        <PinEntryModal
          isOpen={showPinModal}
          onClose={handlePinCancel}
          onSuccess={handlePinSuccess}
          title="Enter PIN to Access System"
        />
      </>
    );
  }

  // User is authenticated - show the application
  return <>{children}</>;
};
