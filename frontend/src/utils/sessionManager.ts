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
}

const SESSION_KEY = 'inventory_user_session';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export const sessionManager = {
  /**
   * Save user session to sessionStorage
   */
  setSession: (session: Omit<UserSession, 'loginTime'>) => {
    const sessionData: UserSession = {
      ...session,
      loginTime: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  },

  /**
   * Get current user session
   * Returns null if no session or session is expired
   */
  getSession: (): UserSession | null => {
    const sessionStr = sessionStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;

    try {
      const session: UserSession = JSON.parse(sessionStr);

      // Check if session is expired
      const sessionAge = Date.now() - session.loginTime;
      if (sessionAge > SESSION_TIMEOUT) {
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
  }
};
