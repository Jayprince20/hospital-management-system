import type { NavGroup, NavItem } from '@/lib/rbac';

/** Order of the sidebar sections */
export const NAV_GROUP_ORDER: NavGroup[] = ['top', 'care', 'pharmacy', 'finance', 'team', 'admin'];

export interface NavSection<T extends NavItem = NavItem> {
  group: NavGroup;
  items: T[];
}

/**
 * Visible items in sections, in NAV_GROUP_ORDER, keeping the items' own order inside a section.
 * Patients get one flat list (their few pages need no headings); empty sections are dropped.
 */
export function groupNavItems<T extends NavItem>(items: T[], role?: string): NavSection<T>[] {
  if (role === 'PATIENT') return items.length ? [{ group: 'top', items }] : [];
  return NAV_GROUP_ORDER.map((group) => ({ group, items: items.filter((item) => item.group === group) })).filter(
    (section) => section.items.length > 0
  );
}

/** Lower-case text without accents, for matching "pédiatrie" with "pediatrie" */
export const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Page search (⌘K): items whose label contains every word of the query, labels starting with
 * the query first. An empty query lists everything.
 */
export function filterNavItems<T extends { label: string }>(items: T[], query: string): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  const q = normalize(query);
  return items
    .filter((item) => {
      const label = normalize(item.label);
      return words.every((w) => label.includes(w));
    })
    .sort((a, b) => Number(normalize(b.label).startsWith(q)) - Number(normalize(a.label).startsWith(q)));
}

/** Pages worth a tab on a phone, best first (each role keeps those it can open) */
export const MOBILE_TAB_PRIORITY = [
  '/dashboard',
  '/dashboard/queue',
  '/dashboard/appointments',
  '/dashboard/my-health',
  '/dashboard/patients',
  '/dashboard/my-patients',
  '/dashboard/teleconsultations',
  '/dashboard/prescriptions',
  '/dashboard/pharmacy/pos',
  '/dashboard/laboratory',
  '/dashboard/billing',
  '/dashboard/cash-desk',
  '/dashboard/family',
];
/** Never a tab: the header already gives them */
const NOT_A_TAB = new Set(['/dashboard/notifications', '/dashboard/messages']);

/** Short tab labels (translation keys) — full labels are cut on a 390 px bar */
export const MOBILE_TAB_LABEL_KEYS: Record<string, string> = {
  '/dashboard': 'shell.tab.home',
  '/dashboard/queue': 'shell.tab.queue',
  '/dashboard/appointments': 'shell.tab.agenda',
  '/dashboard/my-health': 'shell.tab.health',
  '/dashboard/patients': 'shell.tab.patients',
  '/dashboard/my-patients': 'shell.tab.patients',
  '/dashboard/teleconsultations': 'shell.tab.video',
  '/dashboard/prescriptions': 'shell.tab.prescriptions',
  '/dashboard/pharmacy/pos': 'shell.tab.pos',
  '/dashboard/laboratory': 'shell.tab.lab',
  '/dashboard/billing': 'shell.tab.billing',
  '/dashboard/cash-desk': 'shell.tab.cash',
  '/dashboard/family': 'shell.tab.family',
};

/**
 * The 4 entries of the mobile tab bar: the role's pages in MOBILE_TAB_PRIORITY order, then its
 * first other pages (never notifications/messages); the rest goes in the "More" sheet.
 */
export function splitMobileItems<T extends NavItem>(items: T[]): { primary: T[]; more: T[] } {
  const byHref = new Map(items.map((item) => [item.href, item]));
  const preferred = MOBILE_TAB_PRIORITY.map((href) => byHref.get(href)).filter((item): item is T => Boolean(item));
  const others = items.filter((item) => !MOBILE_TAB_PRIORITY.includes(item.href) && !NOT_A_TAB.has(item.href));
  const primary = [...preferred, ...others].slice(0, 4);
  const chosen = new Set(primary.map((item) => item.href));
  return { primary, more: items.filter((item) => !chosen.has(item.href)) };
}

/** The most specific visible item for the current path (the dashboard home only on its own path) */
export function activeNavHref(items: { href: string }[], pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const matches = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
  return items
    .map((item) => item.href)
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
}

/** Two-letter initials for an avatar */
export const initialsOf = (first?: string | null, last?: string | null) =>
  `${(first ?? '').trim().charAt(0)}${(last ?? '').trim().charAt(0)}`.toUpperCase() || '?';

/** localStorage helpers that never throw (private mode, blocked storage) */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the preference only lasts for this page
  }
}
