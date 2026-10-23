'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { AccessDenied } from '@/components/permission-gate';
import { ErrorBoundary } from '@/components/error-boundary';
import { LoadingState } from '@/components/ui';
import { useLanguage } from '@/context/language-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated, canAccess } = useAuth();
  const { t } = useLanguage();
  const pathname = usePathname();

  // Show loading while auth is being checked
  // The redirect is handled by AuthProvider
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingState label={t('admin.layout.verifying')} minHeight="h-32" />
      </div>
    );
  }

  // Wait for redirect (handled by AuthProvider)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingState label={t('admin.layout.redirecting')} minHeight="h-32" />
      </div>
    );
  }

  // Check if user has access to the current route
  const hasAccess = canAccess(pathname || '/dashboard');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <main className="p-6">
          <ErrorBoundary>
            {hasAccess ? children : <AccessDenied />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
