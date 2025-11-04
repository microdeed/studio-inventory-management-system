import { useState, useEffect } from 'react';
import { sessionManager } from '../utils/sessionManager.ts';

const GUARANTEED_SESSION_TIME = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_THRESHOLD = 3 * 60 * 1000; // Show warning 3 minutes before timeout

interface InactivityWarningState {
  showWarning: boolean;
  secondsRemaining: number;
}

export const useInactivityWarning = () => {
  const [state, setState] = useState<InactivityWarningState>({
    showWarning: false,
    secondsRemaining: 0
  });

  useEffect(() => {
    const checkInactivity = () => {
      const sessionStr = sessionStorage.getItem('inventory_user_session');
      if (!sessionStr) {
        setState({ showWarning: false, secondsRemaining: 0 });
        return;
      }

      try {
        const session = JSON.parse(sessionStr);
        const now = Date.now();
        const sessionAge = now - session.loginTime;

        // Only check if we're past the 30-minute guaranteed period
        if (sessionAge >= GUARANTEED_SESSION_TIME) {
          const inactivityDuration = now - session.lastActivityTime;
          const timeUntilTimeout = INACTIVITY_TIMEOUT - inactivityDuration;

          // Show warning if within 30 seconds of timeout
          if (timeUntilTimeout > 0 && timeUntilTimeout <= WARNING_THRESHOLD) {
            setState({
              showWarning: true,
              secondsRemaining: Math.ceil(timeUntilTimeout / 1000)
            });
          } else {
            setState({ showWarning: false, secondsRemaining: 0 });
          }
        } else {
          setState({ showWarning: false, secondsRemaining: 0 });
        }
      } catch (error) {
        console.error('Error checking inactivity:', error);
        setState({ showWarning: false, secondsRemaining: 0 });
      }
    };

    // Check every second when warning might be needed
    const interval = setInterval(checkInactivity, 1000);
    checkInactivity(); // Initial check

    return () => clearInterval(interval);
  }, []);

  const handleStayLoggedIn = () => {
    sessionManager.updateActivity();
    setState({ showWarning: false, secondsRemaining: 0 });
  };

  const handleLogout = () => {
    sessionManager.clearSession();
    setState({ showWarning: false, secondsRemaining: 0 });
    window.location.reload(); // Force re-authentication
  };

  return {
    showWarning: state.showWarning,
    secondsRemaining: state.secondsRemaining,
    handleStayLoggedIn,
    handleLogout
  };
};
