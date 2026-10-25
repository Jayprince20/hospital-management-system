'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { navigationItems, isNavItemVisible, roleColors, UserRole } from '@/lib/rbac';
import { useActingPatient } from '@/context/acting-patient-context';
import { isOwnerOnlyPath } from '@/lib/patient-extras';

// Map navigation labels to translation keys
const navTranslationKeys: Record<string, string> = {
  'Dashboard': 'nav.dashboard',
  'My Health': 'nav.myHealth',
  'My Family': 'nav.myFamily',
  'Patient Feedback': 'nav.patientFeedback',
  'My Schedule': 'nav.mySchedule',
  'Rosters': 'nav.rosters',
  'My Shifts': 'nav.myShifts',
  'Leave': 'nav.leave',
  'Roster Settings': 'nav.rosterSettings',
  'My Patients': 'nav.myPatients',
  'Vital Signs': 'nav.vitals',
  'Consultations': 'nav.consultations',
  'Prescriptions': 'nav.prescriptions',
  'Lab Results': 'nav.labResults',
  'Patients': 'nav.patients',
  'Doctors': 'nav.doctors',
  'Appointments': 'nav.appointments',
  'Teleconsultations': 'nav.teleconsultations',
  'Queue': 'nav.queue',
  'Beds': 'nav.beds',
  'Admissions': 'nav.admissions',
  'Medication Round': 'nav.marRound',
  'Imaging': 'nav.imaging',
  'Imaging Catalogue': 'nav.imagingCatalogue',
  'Medical Documents': 'nav.medicalDocuments',
  'Referrals': 'nav.referrals',
  'Departments': 'nav.departments',
  'Medical Records': 'nav.records',
  'Pharmacy': 'nav.pharmacy',
  'Pharmacy POS': 'nav.pharmacyPos',
  'Pharmacy Prescriptions': 'nav.pharmacyPrescriptions',
  'Pharmacy Sales': 'nav.pharmacySales',
  'Pharmacy Stock': 'nav.pharmacyStock',
  'Till Sessions': 'nav.pharmacySessions',
  'Laboratory': 'nav.laboratory',
  'Billing': 'nav.billing',
  'Cash Desk': 'nav.cashDesk',
  'Cash Desk Supervision': 'nav.cashDeskSupervision',
  'Official Statistics': 'nav.statistics',
  'Price List': 'nav.priceList',
  'Clinical Reference': 'nav.clinicalReference',
  'Insurers': 'nav.insurers',
  'Claims': 'nav.claims',
  'Receivables': 'nav.receivables',
  'Payments': 'nav.payments',
  'Inventory': 'nav.inventory',
  'Purchasing': 'nav.purchasing',
  'Reports': 'nav.reports',
  'Users': 'nav.users',
  'Audit Log': 'nav.audit',
  'System Status': 'nav.systemStatus',
  'Messages': 'nav.messages',
  'Notifications': 'nav.notifications',
  'Settings': 'nav.settings',
};

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t, tEnum } = useLanguage();

  const { isActing } = useActingPatient();

  // Filter navigation items based on user permissions (owner-only pages hidden while acting for a relative)
  const filteredNavItems = navigationItems.filter((item) => isNavItemVisible(item, user?.role) && !(isActing && isOwnerOnlyPath(item.href)));

  // Only the most specific entry is highlighted (e.g. Supervision, not also Caisse, on /dashboard/cash-desk/supervision)
  // The dashboard home is a prefix of every page: it only counts on its own path
  const matches = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
  const activeHref = filteredNavItems.map((item) => item.href).filter(matches).sort((a, b) => b.length - a.length)[0];

  // Get translated label for nav item
  const getNavLabel = (label: string) => {
    const key = navTranslationKeys[label];
    return key ? t(key) : label;
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform">
      {/* Logo */}
      <div className="flex items-center justify-center px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <Image
          src="/images/logo-bbdt.png"
          alt="BB Diagnostics"
          width={180}
          height={60}
          className="object-contain"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="px-3 py-4 overflow-y-auto h-[calc(100vh-180px)]">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#f4f9ec] dark:bg-[#1e280d] text-[#8DC63F] dark:text-[#a1cb64]'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg
                    className={`w-5 h-5 ${
                      isActive ? 'text-[#8DC63F] dark:text-[#a1cb64]' : 'text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={item.icon}
                    />
                  </svg>
                  {getNavLabel(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f4f9ec] dark:bg-[#1e280d] flex items-center justify-center">
            <span className="text-[#8DC63F] dark:text-[#a1cb64] font-medium text-sm">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
              roleColors[user?.role as UserRole] || 'bg-gray-100 text-gray-800'
            }`}>
              {tEnum(user?.role)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
