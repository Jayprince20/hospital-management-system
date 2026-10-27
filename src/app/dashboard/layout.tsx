'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Sidebar, SidebarOffset } from '@/components/sidebar';
import { SidebarProvider } from '@/context/sidebar-context';
import { SessionTimeout } from '@/components/session-timeout';
import { Header } from '@/components/header';
import { AccessDenied } from '@/components/permission-gate';
import { ErrorBoundary } from '@/components/error-boundary';
import { LoadingState } from '@/components/ui';
import { useLanguage } from '@/context/language-context';
import { ActingPatientProvider, useActingPatient } from '@/context/acting-patient-context';
import { ActingBanner, OwnerOnlyNotice } from '@/components/family';
import { isOwnerOnlyPath } from '@/lib/patient-extras';
import { TeleWaitingListener } from '@/components/teleconsultation/waiting-listener';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated, canAccess, mustChangePassword, mfaSetupRequired } = useAuth();
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

  // Password change or 2FA enrolment comes first; the AuthProvider is redirecting there
  if (mustChangePassword || mfaSetupRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingState label={t('admin.layout.redirecting')} minHeight="h-32" />
      </div>
    );
  }

  // Check if user has access to the current route
  const hasAccess = canAccess(pathname || '/dashboard');

  return (
    <ActingPatientProvider>
      <SidebarProvider>
        <div className="min-h-screen bg-canvas dark:bg-gray-900">
          <SessionTimeout />
          <TeleWaitingListener />
          <Sidebar />
          <SidebarOffset>
            <Header />
            <DashboardMain pathname={pathname} hasAccess={hasAccess}>
              {children}
            </DashboardMain>
          </SidebarOffset>
        </div>
      </SidebarProvider>
    </ActingPatientProvider>
  );
}

/**
 * Page area. While a patient acts for a relative: a banner on every page, owner-only pages
 * replaced by a notice, and the page re-mounted on every switch so it re-reads its data.
 */
function DashboardMain({ pathname, hasAccess, children }: { pathname: string | null; hasAccess: boolean; children: React.ReactNode }) {
  const { acting } = useActingPatient();
  const ownerOnly = Boolean(acting) && isOwnerOnlyPath(pathname);
  return (
    <main className="p-4 sm:p-6">
      <ActingBanner />
      <ErrorBoundary>
        <div key={acting?.patientId ?? 'self'}>{!hasAccess ? <AccessDenied /> : ownerOnly ? <OwnerOnlyNotice /> : children}</div>
      </ErrorBoundary>
    </main>
  );
}
