'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { navigationItems, isNavItemVisible, type NavGroup, type NavItem } from '@/lib/rbac';
import { useActingPatient } from '@/context/acting-patient-context';
import { isOwnerOnlyPath } from '@/lib/patient-extras';
import { useSidebar } from '@/context/sidebar-context';
import {
  activeNavHref,
  filterNavItems,
  groupNavItems,
  initialsOf,
  readStored,
  splitMobileItems,
  MOBILE_TAB_LABEL_KEYS,
  writeStored,
} from '@/lib/navigation';
import { useOnCall } from '@/components/rosters/on-call';
import { useIsBiologist } from '@/components/lab/ui';
import { myDepartment, useRosterDepartments } from '@/components/rosters/ui';

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
  'Emergency': 'nav.emergency',
  'Beds': 'nav.beds',
  'Admissions': 'nav.admissions',
  'Medication Round': 'nav.marRound',
  'Vaccination': 'nav.vaccination',
  'Antenatal Care': 'nav.antenatal',
  'Consultation Templates': 'nav.templates',
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
  'Quality Control': 'nav.labQc',
  'Analysers': 'nav.labInstruments',
  'Billing': 'nav.billing',
  'Cash Desk': 'nav.cashDesk',
  'Cash Desk Supervision': 'nav.cashDeskSupervision',
  'Official Statistics': 'nav.statistics',
  'Price List': 'nav.priceList',
  'Clinical Reference': 'nav.clinicalReference',
  'FHIR Interoperability': 'nav.fhir',
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

const GROUPS_KEY = 'hms.sidebar.groups';
const STAFF_ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH'];

type LabelledItem = NavItem & { text: string };

/** The signed-in user's visible pages, translated, with the active one */
function useNavModel() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isActing } = useActingPatient();
  const isBiologist = useIsBiologist();

  const items: LabelledItem[] = useMemo(
    () =>
      navigationItems
        // Owner-only pages are hidden while a patient acts for a relative
        .filter((item) => isNavItemVisible(item, user?.role) && !(isActing && isOwnerOnlyPath(item.href)))
        // Lab pages offered to doctors only when they are biologists
        .filter((item) => !(item.biologistsOnly && user?.role === 'DOCTOR' && !isBiologist))
        .map((item) => {
          const key = navTranslationKeys[item.label];
          return { ...item, text: key ? t(key) : item.label };
        }),
    [user?.role, isActing, isBiologist, t]
  );
  const sections = useMemo(() => groupNavItems(items, user?.role), [items, user?.role]);
  return { items, sections, activeHref: activeNavHref(items, pathname) };
}

function NavIcon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={`${className} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

function LogoMark({ className = 'w-10 h-10 text-[15px]' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`${className} rounded-xl bg-accent text-on-accent font-extrabold flex items-center justify-center shrink-0 tracking-tight`}>
      BB
    </span>
  );
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-rail';

/**
 * Navigation of the dashboard: the desktop sidebar (expanded or icon rail), the mobile tab bar
 * with its "More" sheet, and the page search (⌘K).
 */
export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileNav />
      <CommandPalette />
    </>
  );
}

function DesktopSidebar() {
  const { collapsed, toggleCollapsed, setPaletteOpen } = useSidebar();
  const { sections, activeHref } = useNavModel();
  const { t } = useLanguage();
  const [closedGroups, setClosedGroups] = useState<Partial<Record<NavGroup, boolean>>>(() =>
    typeof window === 'undefined' ? {} : readStored(GROUPS_KEY, {})
  );
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Keep the current page in view (e.g. Finance › Caisse opened from the page search)
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeHref, collapsed]);

  const toggleGroup = (group: NavGroup) => {
    setClosedGroups((current) => {
      const next = { ...current, [group]: !current[group] };
      writeStored(GROUPS_KEY, next);
      return next;
    });
  };

  // Rail tooltips are positioned on the page so the scrolling list does not clip them
  const showTip = (label: string) => (e: { currentTarget: HTMLElement }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: rect.top + rect.height / 2 });
  };
  const hideTip = () => setTip(null);

  return (
    <aside
      className={`hidden lg:flex fixed left-0 top-0 z-40 h-screen flex-col bg-rail text-rail-text transition-[width] duration-200 ${collapsed ? 'w-20' : 'w-[280px]'}`}
      aria-label={t('shell.nav.main')}
    >
      {/* Brand + collapse */}
      <div className={`flex items-center pt-5 pb-4 ${collapsed ? 'flex-col gap-3 px-0' : 'justify-between px-5'}`}>
        <Link href="/dashboard" className={`flex items-center gap-3 rounded-xl ${focusRing}`} aria-label={collapsed ? t('shell.brandName') : undefined}>
          <LogoMark />
          {!collapsed && (
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold text-white">{t('shell.brandName')}</span>
              <span className="text-[11px] text-rail-muted">{t('shell.brandPlace')}</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t('shell.nav.expand') : t('shell.nav.collapse')}
          aria-expanded={!collapsed}
          className={`w-9 h-9 rounded-[10px] border border-white/10 flex items-center justify-center text-rail-text hover:bg-white/5 ${focusRing}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={2} />
            <path d="M9 3v18" strokeWidth={2} />
            <path d={collapsed ? 'm14 9 3 3-3 3' : 'm16 15-3-3 3-3'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Page search */}
      <div className={collapsed ? 'flex justify-center pb-3' : 'px-4 pb-3'}>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label={collapsed ? `${t('shell.nav.searchShort')} (⌘K)` : undefined}
          onMouseEnter={collapsed ? showTip(t('shell.nav.searchShort')) : undefined}
          onFocus={collapsed ? showTip(t('shell.nav.searchShort')) : undefined}
          onMouseLeave={hideTip}
          onBlur={hideTip}
          className={`flex items-center gap-2.5 h-11 rounded-xl border border-white/10 bg-white/5 text-rail-muted text-[13px] hover:bg-white/10 ${focusRing} ${collapsed ? 'w-12 justify-center' : 'w-full px-3'}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" strokeWidth={2} />
            <path d="m21 21-4.3-4.3" strokeWidth={2} strokeLinecap="round" />
          </svg>
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{t('shell.nav.search')}</span>
              <kbd className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-white/10 text-rail-text font-sans">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Sections */}
      <nav ref={navRef} className={`flex-1 overflow-y-auto pb-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent] ${collapsed ? 'px-0' : 'px-3'}`} onScroll={hideTip}>
        {sections.map((section, sectionIndex) => {
          const hasActive = section.items.some((item) => item.href === activeHref);
          // A closed section still opens when it holds the current page
          const open = collapsed || section.group === 'top' || !closedGroups[section.group] || hasActive;
          const groupLabel = section.group === 'top' ? '' : t(`shell.nav.group.${section.group}`);
          return (
            <div key={section.group} className={collapsed ? 'flex flex-col items-center gap-1' : 'mb-3'}>
              {collapsed && sectionIndex > 0 && <span aria-hidden="true" className="w-6 h-px bg-white/10 my-2" />}
              {!collapsed && groupLabel && (
                <button
                  type="button"
                  onClick={() => toggleGroup(section.group)}
                  aria-expanded={open}
                  aria-label={t('shell.nav.toggleGroup', { group: groupLabel })}
                  className={`w-full flex items-center justify-between h-8 px-3 rounded-lg text-[11px] font-bold tracking-[0.08em] uppercase text-rail-muted hover:text-rail-text ${focusRing}`}
                >
                  {groupLabel}
                  <svg className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              {open && (
                <ul className={collapsed ? 'flex flex-col items-center gap-1' : 'space-y-0.5'}>
                  {section.items.map((item) => {
                    const active = item.href === activeHref;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          aria-label={collapsed ? item.text : undefined}
                          onMouseEnter={collapsed ? showTip(item.text) : undefined}
                          onFocus={collapsed ? showTip(item.text) : undefined}
                          onMouseLeave={hideTip}
                          onBlur={hideTip}
                          className={`flex items-center rounded-xl text-sm transition-colors ${focusRing} ${
                            collapsed ? 'w-12 h-11 justify-center' : 'gap-3 h-10 px-3'
                          } ${active ? 'bg-accent text-on-accent font-bold' : 'text-rail-text font-medium hover:bg-white/[0.07] hover:text-white'}`}
                        >
                          <NavIcon d={item.icon} className={`w-[18px] h-[18px] ${active ? 'text-on-accent' : 'text-rail-muted'}`} />
                          {!collapsed && <span className="flex-1 truncate">{item.text}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: who is on call, the account */}
      <div className={`flex flex-col gap-3 pb-5 ${collapsed ? 'items-center px-0' : 'px-4'}`}>
        {!collapsed && <OnCallCard />}
        <UserBlock collapsed={collapsed} />
      </div>

      {collapsed && tip && (
        <span
          role="tooltip"
          className="pointer-events-none fixed left-[84px] z-50 -translate-y-1/2 whitespace-nowrap rounded-[10px] bg-ink px-3 py-2 text-[13px] font-semibold text-white shadow-lg"
          style={{ top: tip.top }}
        >
          {tip.label}
        </span>
      )}
    </aside>
  );
}

/** First person on call now in the user's department (a doctor if there is one); hidden when nobody */
function OnCallCard() {
  const { user } = useAuth();
  const { t, formatTime } = useLanguage();
  const isStaff = Boolean(user && STAFF_ROLES.includes(user.role));
  const { departments } = useRosterDepartments();
  const mine = myDepartment(departments, user?.id);
  const { entries } = useOnCall(mine?.id ?? null, undefined, isStaff && departments !== null);
  if (!isStaff || !entries || entries.length === 0) return null;
  const person = entries.find((e) => e.role === 'DOCTOR') ?? entries[0];
  const department = typeof person.department === 'string' ? person.department : person.department?.name;
  const [first, ...rest] = person.name.split(' ');
  return (
    <div className="rounded-2xl border border-accent/25 bg-accent/10 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="w-2 h-2 rounded-full bg-accent" />
        <span className="text-xs font-bold text-lime-200">{t('shell.nav.onCall')}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="w-8 h-8 rounded-full bg-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center shrink-0">
          {initialsOf(first, rest.join(' ').replace(/^Dr\.?\s*/i, ''))}
        </span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[13px] font-semibold text-white truncate">{person.name}</span>
          <span className="text-[11px] text-rail-muted truncate">
            {[department, person.until ? t('shell.nav.until', { time: formatTime(person.until) }) : ''].filter(Boolean).join(' · ')}
          </span>
        </span>
        {person.phone && (
          <a
            href={`tel:${person.phone.replace(/\s/g, '')}`}
            aria-label={t('shell.nav.call', { name: person.name })}
            className={`w-9 h-9 rounded-[10px] bg-accent text-on-accent flex items-center justify-center shrink-0 ${focusRing}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

/** Initials, name, role and the account menu (profile, settings, sign out) */
function UserBlock({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const { t, tEnum } = useLanguage();
  const { isActing } = useActingPatient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = initialsOf(user?.firstName, user?.lastName);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menuItem = 'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-ink dark:text-gray-200 hover:bg-canvas dark:hover:bg-gray-700';
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('shell.nav.accountMenu')}
        className={`flex items-center gap-2.5 rounded-2xl text-left ${focusRing} ${collapsed ? 'p-0' : 'w-full p-2.5 bg-white/5 hover:bg-white/10'}`}
      >
        <span aria-hidden="true" className={`w-10 h-10 rounded-full bg-green-100 text-brand text-[13px] font-bold flex items-center justify-center shrink-0 ${collapsed ? 'ring-2 ring-accent ring-offset-2 ring-offset-rail' : ''}`}>
          {initials}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-[13px] font-semibold text-white truncate">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-[11px] text-rail-muted">{tEnum(user?.role)}</span>
            </span>
            <svg className="w-4 h-4 text-rail-text" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </>
        )}
      </button>
      {open && (
        <div role="menu" className={`absolute bottom-full mb-2 w-56 rounded-xl bg-white dark:bg-gray-800 border border-line dark:border-gray-700 shadow-xl p-1.5 z-50 ${collapsed ? 'left-0' : 'left-0 right-0 w-auto'}`}>
          {!isActing && (
            <>
              <Link role="menuitem" href="/dashboard/profile" onClick={() => setOpen(false)} className={menuItem}>
                {t('settings.profile')}
              </Link>
              <Link role="menuitem" href="/dashboard/settings" onClick={() => setOpen(false)} className={menuItem}>
                {t('nav.settings')}
              </Link>
              <hr className="my-1 border-line dark:border-gray-700" />
            </>
          )}
          <button role="menuitem" type="button" onClick={logout} className={`${menuItem} text-red-700 dark:text-red-400`}>
            {t('auth.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Mobile: floating tab bar with 4 pages + "More", which opens every other page as tiles */
function MobileNav() {
  const { items, activeHref } = useNavModel();
  const { user } = useAuth();
  const { t } = useLanguage();
  const pathname = usePathname();
  // The sheet belongs to the page it was opened on: navigating closes it
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const sheetOpen = sheetFor !== null && sheetFor === pathname;
  const setSheetOpen = (open: boolean | ((current: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(sheetOpen) : open;
    setSheetFor(next ? pathname : null);
  };
  const closeRef = useRef<HTMLButtonElement>(null);
  const { primary, more } = splitMobileItems(items);
  const moreSections = groupNavItems(more, user?.role);
  const moreActive = more.some((item) => item.href === activeHref);

  // Escape closes the sheet; focus goes to its close button
  useEffect(() => {
    if (!sheetOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetFor(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  if (items.length === 0) return null;
  const tab = 'h-14 rounded-[18px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  return (
    <div className="lg:hidden">
      {sheetOpen && (
        <div className="fixed inset-0 z-40">
          <button type="button" aria-label={t('shell.nav.close')} className="absolute inset-0 w-full h-full bg-ink/45 cursor-default" onClick={() => setSheetOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label={t('shell.nav.allSections')} className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[28px] bg-white dark:bg-gray-900 px-5 pt-3 pb-28 shadow-2xl">
            <span aria-hidden="true" className="block mx-auto w-10 h-1.5 rounded-full bg-line dark:bg-gray-700" />
            <div className="flex items-center justify-between mt-3 mb-4">
              <h2 className="text-lg font-extrabold text-ink dark:text-white">{t('shell.nav.allSections')}</h2>
              <button ref={closeRef} type="button" onClick={() => setSheetOpen(false)} aria-label={t('shell.nav.close')} className="w-11 h-11 rounded-xl bg-canvas dark:bg-gray-800 flex items-center justify-center text-ink dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" strokeWidth={2.2} strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="space-y-5">
              {moreSections.map((section) => (
                <div key={section.group} className="space-y-2.5">
                  {section.group !== 'top' && <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-ink-muted dark:text-gray-400">{t(`shell.nav.group.${section.group}`)}</p>}
                  <ul className="grid grid-cols-4 gap-2">
                    {section.items.map((item) => {
                      const active = item.href === activeHref;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={`flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-2xl text-[11px] font-semibold text-center leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${active ? 'bg-accent text-on-accent' : 'bg-canvas dark:bg-gray-800 text-ink dark:text-gray-200'}`}
                          >
                            <span aria-hidden="true" className="w-9 h-9 rounded-[11px] bg-white dark:bg-gray-900 flex items-center justify-center text-brand dark:text-lime-400">
                              <NavIcon d={item.icon} className="w-[18px] h-[18px]" />
                            </span>
                            <span className="line-clamp-2">{item.text}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav aria-label={t('shell.nav.main')} className="fixed inset-x-3 bottom-4 z-50 h-[72px] rounded-3xl bg-rail px-1.5 grid grid-cols-5 items-center shadow-[0_12px_24px_-12px_rgba(15,31,23,0.6)]">
        {primary.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`${tab} ${active ? 'bg-accent text-on-accent' : 'text-rail-text'}`}>
              <NavIcon d={item.icon} className="w-5 h-5" />
              <span className="max-w-full truncate px-1">{MOBILE_TAB_LABEL_KEYS[item.href] ? t(MOBILE_TAB_LABEL_KEYS[item.href]) : item.text}</span>
            </Link>
          );
        })}
        {more.length > 0 && (
          <button type="button" onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen} className={`${tab} ${sheetOpen || moreActive ? 'bg-accent text-on-accent' : 'text-rail-text'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" strokeWidth={2} strokeLinejoin="round" />
            </svg>
            {t('shell.nav.more')}
          </button>
        )}
      </nav>
    </div>
  );
}

/** ⌘K page search over the user's visible pages */
function CommandPalette() {
  const { paletteOpen } = useSidebar();
  // Mounted fresh on every opening: empty search, first result selected
  return paletteOpen ? <PaletteDialog /> : null;
}

function PaletteDialog() {
  const { setPaletteOpen } = useSidebar();
  const { items } = useNavModel();
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const results = useMemo(() => filterNavItems(items.map((item) => ({ ...item, label: item.text })), query), [items, query]);

  // Focus goes back where it was when the search closes
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);

  const go = (href: string) => {
    setPaletteOpen(false);
    router.push(href);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setPaletteOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[index]) {
      e.preventDefault();
      go(results[index].href);
    } else if (e.key === 'Tab') {
      // Focus stays in the search while it is open
      e.preventDefault();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <button type="button" aria-label={t('shell.nav.close')} tabIndex={-1} className="absolute inset-0 w-full h-full bg-ink/45 cursor-default" onClick={() => setPaletteOpen(false)} />
      <div role="dialog" aria-modal="true" aria-label={t('shell.palette.title')} className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-line dark:border-gray-700 overflow-hidden" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 px-4 border-b border-line dark:border-gray-700">
          <svg className="w-5 h-5 text-ink-muted dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" strokeWidth={2} />
            <path d="m21 21-4.3-4.3" strokeWidth={2} strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder={t('shell.palette.placeholder')}
            aria-label={t('shell.palette.title')}
            role="combobox"
            aria-expanded="true"
            aria-controls="nav-palette-results"
            aria-activedescendant={results[index] ? `nav-palette-${index}` : undefined}
            className="flex-1 h-14 bg-transparent text-[15px] text-ink dark:text-white placeholder:text-ink-muted/70 outline-none"
          />
          <kbd className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-canvas dark:bg-gray-700 text-ink-muted dark:text-gray-300 font-sans">Esc</kbd>
        </div>
        <ul id="nav-palette-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-muted dark:text-gray-400">{t('shell.palette.empty')}</li>}
          {results.map((item, i) => (
            <li
              key={item.href}
              id={`nav-palette-${i}`}
              role="option"
              aria-selected={i === index}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(item.href);
              }}
              className={`flex items-center gap-3 px-3 h-11 rounded-xl text-sm cursor-pointer ${i === index ? 'bg-brand text-white' : 'text-ink dark:text-gray-200'}`}
            >
              <NavIcon d={item.icon} className="w-[18px] h-[18px]" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.group !== 'top' && <span className={`text-xs ${i === index ? 'text-white/80' : 'text-ink-muted dark:text-gray-400'}`}>{t(`shell.nav.group.${item.group}`)}</span>}
            </li>
          ))}
        </ul>
        <p className="px-4 py-2.5 text-xs text-ink-muted dark:text-gray-400 border-t border-line dark:border-gray-700">{t('shell.palette.hint')}</p>
      </div>
    </div>
  );
}

/** Wraps the page content with the left margin of the desktop sidebar */
export function SidebarOffset({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return <div className={`min-w-0 pb-28 lg:pb-0 transition-[margin] duration-200 ${collapsed ? 'lg:ml-20' : 'lg:ml-[280px]'}`}>{children}</div>;
}
