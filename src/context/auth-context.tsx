'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, ApiError, User, LoginRequest } from '@/lib/api';
import { lastAuthenticatedAt, markAuthenticated, readProfile, saveProfile, shouldWipe, wipeOfflineData } from '@/lib/offline/session';
import { isOfflineNow } from '@/lib/offline/state';
import {
  Permission,
  UserRole,
  hasPermission,
  hasAnyPermission,
  canAccessRoute,
  roleDisplayNames,
} from '@/lib/rbac';

// The session user also carries its two-factor state (from login, MFA verify and /auth/me)
export type SessionUser = User & { mfaEnabled?: boolean; mfaSetupRequired?: boolean };

/** What a password submission led to: signed in, or a verification code is needed first */
export type LoginResult = { mfaRequired: false } | { mfaRequired: true; mfaToken: string };

interface AuthContextType {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  /** Admins and doctors without 2FA must enrol before using the dashboard */
  mfaSetupRequired: boolean;
  login: (credentials: LoginRequest) => Promise<LoginResult>;
  verifyMfa: (data: { mfaToken: string; code?: string; recoveryCode?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  checkPermission: (permission: Permission) => boolean;
  checkAnyPermission: (permissions: Permission[]) => boolean;
  canAccess: (pathname: string) => boolean;
  getRoleDisplayName: () => string;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Page to reopen after signing in (only teleconsultation links) */
const RETURN_TO_KEY = 'auth_return_to';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const checkAuth = useCallback(async () => {
    // Don't run auth check on server side
    if (typeof window === 'undefined') {
      return false;
    }

    // 12 h without a staff session: the data kept for offline use is wiped
    if (shouldWipe(lastAuthenticatedAt(localStorage), Date.now())) {
      await wipeOfflineData(localStorage, typeof caches !== 'undefined' ? caches : null).catch(() => undefined);
    }

    try {
      // Check if we have a token
      if (api.isAuthenticated()) {
        let currentUser;
        // Retry while the server is unreachable (e.g. restarting) instead of logging out;
        // without network, reopen with the profile saved on this device (same user, < 12 h)
        const savedProfile = readProfile<SessionUser>(localStorage, api.sessionClaims()?.userId ?? null);
        for (let attempt = 0; ; attempt++) {
          try {
            currentUser = await api.getCurrentUser();
            break;
          } catch (err) {
            const unreachable = err instanceof ApiError && err.status === 0;
            if (unreachable && savedProfile && (isOfflineNow() || attempt >= 1)) {
              currentUser = savedProfile;
              break;
            }
            if (!unreachable || attempt >= 9) throw err;
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
        if (currentUser !== savedProfile) {
          saveProfile(localStorage, currentUser as SessionUser);
          markAuthenticated(localStorage);
        }
        setUser(currentUser as SessionUser);
        // Check if user needs to change password
        if (currentUser.mustChangePassword) {
          setMustChangePassword(true);
        }
        return true;
      }
      return false;
    } catch (err) {
      // Only an explicit rejection ends the session; keep tokens if the server is just down
      if (!(err instanceof ApiError && err.status === 0)) {
        api.clearTokens();
      }
      setUser(null);
      setMustChangePassword(false);
      return false;
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  // Initial auth check on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const mfaSetupRequired = !!user?.mfaSetupRequired;

  // Where a signed-in user must go before anything else: password change, then 2FA enrolment
  const pendingStep = mustChangePassword ? '/change-password' : mfaSetupRequired ? '/setup-2fa' : null;

  // Handle route access based on permissions
  useEffect(() => {
    if (!isInitialized || isLoading) return;

    // The full-screen video consultation page is signed-in only, like the dashboard
    const isDashboardRoute = pathname?.startsWith('/dashboard') || pathname?.startsWith('/teleconsultation/');
    const isLoginRoute = pathname === '/login';
    const isChangePasswordRoute = pathname === '/change-password';
    const isSetupMfaRoute = pathname === '/setup-2fa';

    if ((isDashboardRoute || isChangePasswordRoute || isSetupMfaRoute) && !user) {
      // Not authenticated, redirect to login; a teleconsultation link (SMS) is reopened after signing in
      if (pathname?.startsWith('/teleconsultation/')) sessionStorage.setItem(RETURN_TO_KEY, pathname);
      router.push('/login');
    } else if (isDashboardRoute && user) {
      if (pendingStep) router.push(pendingStep);
    } else if (isLoginRoute && user) {
      // Already authenticated
      const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
      sessionStorage.removeItem(RETURN_TO_KEY);
      router.push(pendingStep ?? (returnTo?.startsWith('/teleconsultation/') ? returnTo : '/dashboard'));
    } else if (isChangePasswordRoute && user && !mustChangePassword) {
      router.push(pendingStep ?? '/dashboard');
    } else if (isSetupMfaRoute && user && mustChangePassword) {
      router.push('/change-password');
    } else if (isSetupMfaRoute && user && user.mfaEnabled) {
      // Already enrolled
      router.push('/dashboard');
    }
  }, [isInitialized, isLoading, user, pathname, router, mustChangePassword, pendingStep]);

  // A user who passed every login step: keep them and send them to their next step
  const startSession = useCallback(
    (sessionUser: SessionUser) => {
      setUser(sessionUser);
      saveProfile(localStorage, sessionUser);
      markAuthenticated(localStorage);
      if (sessionUser.mustChangePassword) {
        setMustChangePassword(true);
        router.push('/change-password');
      } else if (sessionUser.mfaSetupRequired) {
        router.push('/setup-2fa');
      } else {
        router.push('/dashboard');
      }
    },
    [router]
  );

  const login = async (credentials: LoginRequest): Promise<LoginResult> => {
    const response = await api.login({
      email: credentials.email,
      password: credentials.password,
      rememberMe: credentials.rememberMe,
    });
    if ('mfaRequired' in response) {
      return { mfaRequired: true, mfaToken: response.mfaToken };
    }
    startSession(response.user as SessionUser);
    return { mfaRequired: false };
  };

  const verifyMfa = async (data: { mfaToken: string; code?: string; recoveryCode?: string }) => {
    const response = await api.verifyMfa(data);
    startSession(response.user as SessionUser);
  };

  // Re-read the user after a change made elsewhere (2FA enrolled, profile edited)
  const refreshUser = useCallback(async () => {
    const currentUser = await api.getCurrentUser();
    setUser(currentUser as SessionUser);
  }, []);

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      // Cached screens and the saved profile go; queued bedside entries stay for this user's next login
      await wipeOfflineData(localStorage, typeof caches !== 'undefined' ? caches : null).catch(() => undefined);
      setUser(null);
      setMustChangePassword(false);
      router.push('/login');
    }
  };

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
    // Update user object to reflect the change
    if (user) {
      setUser({ ...user, mustChangePassword: false });
    }
  }, [user]);

  const checkPermission = useCallback(
    (permission: Permission): boolean => {
      return hasPermission(user?.role, permission);
    },
    [user?.role]
  );

  const checkAnyPermission = useCallback(
    (permissions: Permission[]): boolean => {
      return hasAnyPermission(user?.role, permissions);
    },
    [user?.role]
  );

  const canAccess = useCallback(
    (path: string): boolean => {
      return canAccessRoute(user?.role, path);
    },
    [user?.role]
  );

  const getRoleDisplayName = useCallback((): string => {
    if (!user?.role) return '';
    return roleDisplayNames[user.role as UserRole] || user.role;
  }, [user?.role]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        mustChangePassword,
        mfaSetupRequired,
        login,
        verifyMfa,
        refreshUser,
        logout,
        checkPermission,
        checkAnyPermission,
        canAccess,
        getRoleDisplayName,
        clearMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for permission-based rendering
export function usePermission(permission: Permission): boolean {
  const { checkPermission } = useAuth();
  return checkPermission(permission);
}

// Hook for checking multiple permissions
export function useAnyPermission(permissions: Permission[]): boolean {
  const { checkAnyPermission } = useAuth();
  return checkAnyPermission(permissions);
}
