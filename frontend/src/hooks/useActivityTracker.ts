import { useEffect, useRef } from 'react';
import { sessionManager } from '../utils/sessionManager.ts';

/**
 * Hook to track user activity and update session last activity time
 * Monitors: mouse movement, clicks, keyboard input, scroll, and touch events
 * Debounces updates to avoid excessive sessionStorage writes
 *
 * @param paused - When true, stops listening to activity events
 */
export const useActivityTracker = (paused: boolean = false) => {
  const lastUpdateRef = useRef<number>(0);
  const UPDATE_THROTTLE = 10000; // Update at most once every 10 seconds

  useEffect(() => {
    // Don't add listeners if paused
    if (paused) {
      return;
    }

    const handleActivity = () => {
      const now = Date.now();

      // Throttle updates to avoid excessive sessionStorage writes
      if (now - lastUpdateRef.current >= UPDATE_THROTTLE) {
        sessionManager.updateActivity();
        lastUpdateRef.current = now;
      }
    };

    // Events that indicate user activity
    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup event listeners on unmount or when paused changes
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [paused]);
};
