'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, User, LoginRequest } from '@/lib/api';
import {
  Permission,
  UserRole,
  hasPermission,
  hasAnyPermission,
  canAccessRoute,
  roleDisplayNames,
} from '@/lib/rbac';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkPermission: (permission: Permission) => boolean;
  checkAnyPermission: (permissions: Permission[]) => boolean;
  canAccess: (pathname: string) => boolean;
  getRoleDisplayName: () => string;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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

    try {
      // Check if we have a token
      if (api.isAuthenticated()) {
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
        // Check if user needs to change password
        if (currentUser.mustChangePassword) {
          setMustChangePassword(true);
        }
        return true;
      }
      return false;
    } catch {
      api.clearTokens();
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

  // Handle route access based on permissions
  useEffect(() => {
    if (!isInitialized || isLoading) return;

    const isDashboardRoute = pathname?.startsWith('/dashboard');
    const isLoginRoute = pathname === '/login';
    const isChangePasswordRoute = pathname === '/change-password';

    if (isDashboardRoute && !user) {
      // Not authenticated, redirect to login
      router.push('/login');
    } else if (isDashboardRoute && user) {
      // Check if user needs to change password first
      if (mustChangePassword) {
        router.push('/change-password');
        return;
      }
      // Check if user has permission to access this route
      if (!canAccessRoute(user.role, pathname || '')) {
        // Redirect to dashboard if no access
        router.push('/dashboard');
      }
    } else if (isLoginRoute && user) {
      // Already authenticated
      if (mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/dashboard');
      }
    } else if (isChangePasswordRoute && user && !mustChangePassword) {
      // User doesn't need to change password, redirect to dashboard
      router.push('/dashboard');
    } else if (isChangePasswordRoute && !user) {
      // Not authenticated, redirect to login
      router.push('/login');
    }
  }, [isInitialized, isLoading, user, pathname, router, mustChangePassword]);

  const login = async (credentials: LoginRequest) => {
    const response = await api.login({
      email: credentials.email,
      password: credentials.password,
      rememberMe: credentials.rememberMe,
    });
    setUser(response.user as User);

    // Check if user needs to change password
    if (response.user.mustChangePassword) {
      setMustChangePassword(true);
      router.push('/change-password');
    } else {
      router.push('/dashboard');
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
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
        login,
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
