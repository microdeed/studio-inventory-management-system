/**
 * Session Manager for user authentication
 * Stores user session in sessionStorage (cleared when browser closes)
 */

interface UserSession {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  department?: string;
  loginTime: number;
  lastActivityTime: number;
}

const SESSION_KEY = 'inventory_user_session';
const GUARANTEED_SESSION_TIME = 30 * 60 * 1000; // 30 minutes - no timeout during this period
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes - applies after guaranteed session time

export const sessionManager = {
  /**
   * Save user session to sessionStorage
   */
  setSession: (session: Omit<UserSession, 'loginTime' | 'lastActivityTime'>) => {
    const now = Date.now();
    const sessionData: UserSession = {
      ...session,
      loginTime: now,
      lastActivityTime: now
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  },

  /**
   * Get current user session
   * Returns null if no session or session is expired
   *
   * Session timeout logic:
   * - First 30 minutes: No timeout, user stays logged in regardless of activity
   * - After 30 minutes: 6-minute inactivity timeout applies
   */
  getSession: (): UserSession | null => {
    const sessionStr = sessionStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;

    try {
      const session: UserSession = JSON.parse(sessionStr);
      const now = Date.now();
      const sessionAge = now - session.loginTime;

      // Phase 1: First 30 minutes - no inactivity timeout
      if (sessionAge < GUARANTEED_SESSION_TIME) {
        return session;
      }

      // Phase 2: After 30 minutes - check for 6 minutes of inactivity
      const inactivityDuration = now - session.lastActivityTime;
      if (inactivityDuration > INACTIVITY_TIMEOUT) {
        sessionManager.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to parse session:', error);
      return null;
    }
  },

  /**
   * Clear user session
   */
  clearSession: () => {
    sessionStorage.removeItem(SESSION_KEY);
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn: (): boolean => {
    return sessionManager.getSession() !== null;
  },

  /**
   * Get current user ID
   */
  getUserId: (): number | null => {
    const session = sessionManager.getSession();
    return session ? session.userId : null;
  },

  /**
   * Get current user role
   */
  getUserRole: (): string | null => {
    const session = sessionManager.getSession();
    return session ? session.role : null;
  },

  /**
   * Update last activity time to current time
   * Call this whenever user performs an action to keep session alive
   */
  updateActivity: () => {
    const sessionStr = sessionStorage.getItem(SESSION_KEY);
    if (!sessionStr) return;

    try {
      const session: UserSession = JSON.parse(sessionStr);
      session.lastActivityTime = Date.now();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to update activity time:', error);
    }
  }
};
