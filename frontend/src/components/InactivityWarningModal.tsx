import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, AlertTriangle } from 'lucide-react';

interface InactivityWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  secondsRemaining,
  onStayLoggedIn,
  onLogout
}) => {
  if (!isOpen) return null;

  // Format time as MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          maxWidth: '28rem',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={24} className="text-yellow-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Session Expiring Soon</h2>
            <p className="text-sm text-gray-600">You've been inactive for a while</p>
          </div>
        </div>

        {/* Warning Message */}
        <div className="mb-6">
          <p className="text-gray-700 mb-3">
            Your session will expire due to inactivity. You will be automatically logged out in:
          </p>

          {/* Countdown Timer */}
          <div className="flex items-center justify-center gap-3 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
            <Clock size={32} className="text-yellow-600" />
            <div className="text-5xl font-bold text-yellow-700 font-mono">
              {timeDisplay}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary flex-1"
            onClick={onLogout}
          >
            Logout Now
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={onStayLoggedIn}
            autoFocus
          >
            Stay Logged In
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-4 pt-4 border-t text-center">
          <p className="text-xs text-gray-500">
            Press "Stay Logged In" to continue your session
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
