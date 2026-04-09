'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/context/auth-context';
import { Permission } from '@/lib/rbac';

interface PermissionGateProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * PermissionGate - Conditionally renders children based on user permissions
 *
 * Usage:
 * <PermissionGate permission="users:create">
 *   <CreateUserButton />
 * </PermissionGate>
 *
 * Or with multiple permissions:
 * <PermissionGate permissions={['users:create', 'users:edit']} requireAll={false}>
 *   <UserActions />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { checkPermission, checkAnyPermission } = useAuth();

  // Single permission check
  if (permission) {
    return checkPermission(permission) ? <>{children}</> : <>{fallback}</>;
  }

  // Multiple permissions check
  if (permissions && permissions.length > 0) {
    const hasAccess = requireAll
      ? permissions.every(p => checkPermission(p))
      : checkAnyPermission(permissions);

    return hasAccess ? <>{children}</> : <>{fallback}</>;
  }

  // No permission specified, render children
  return <>{children}</>;
}

/**
 * AccessDenied - Component to display when user doesn't have access
 */
interface AccessDeniedProps {
  title?: string;
  message?: string;
  showBackButton?: boolean;
}

export function AccessDenied({
  title = 'Access Denied',
  message = 'You do not have permission to access this page.',
  showBackButton = true,
}: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        {showBackButton && (
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Dashboard
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * RequirePermission - Higher-order component for page-level protection
 * Shows AccessDenied component if user lacks permission
 */
interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
}

export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { checkPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
      </div>
    );
  }

  if (!checkPermission(permission)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
