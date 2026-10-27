import { describe, it, expect } from 'vitest';
import { activeNavHref, filterNavItems, groupNavItems, initialsOf, normalize, splitMobileItems } from '@/lib/navigation';
import { navigationItems, isNavItemVisible, type NavItem } from '@/lib/rbac';
import { codeDigits } from '@/components/auth/auth-card';

const item = (label: string, href: string, group: NavItem['group']): NavItem => ({ label, href, group, icon: 'M0 0' });

describe('sidebar sections', () => {
  const items = [
    item('Billing', '/dashboard/billing', 'finance'),
    item('Dashboard', '/dashboard', 'top'),
    item('Patients', '/dashboard/patients', 'care'),
    item('Queue', '/dashboard/queue', 'top'),
  ];

  it('orders sections and keeps item order inside a section', () => {
    const sections = groupNavItems(items, 'ADMIN');
    expect(sections.map((s) => s.group)).toEqual(['top', 'care', 'finance']);
    expect(sections[0].items.map((i) => i.label)).toEqual(['Dashboard', 'Queue']);
  });

  it('gives patients one flat list', () => {
    expect(groupNavItems(items, 'PATIENT')).toEqual([{ group: 'top', items }]);
    expect(groupNavItems([], 'PATIENT')).toEqual([]);
  });

  it('every navigation item has a section', () => {
    for (const nav of navigationItems) expect(['top', 'care', 'pharmacy', 'finance', 'team', 'admin']).toContain(nav.group);
  });

  it('an admin sees grouped sections, not one long list', () => {
    const visible = navigationItems.filter((nav) => isNavItemVisible(nav, 'ADMIN'));
    expect(groupNavItems(visible, 'ADMIN').length).toBeGreaterThan(3);
  });
});

describe('page search', () => {
  const pages = [{ label: 'Pharmacie — stock' }, { label: 'Grille tarifaire' }, { label: 'Statistiques officielles' }, { label: 'Stock et achats' }];

  it('ignores accents and case, every word must match', () => {
    expect(normalize('Pédiatrie')).toBe('pediatrie');
    expect(filterNavItems(pages, 'GRILLE')).toEqual([{ label: 'Grille tarifaire' }]);
    expect(filterNavItems(pages, 'stock pharm')).toEqual([{ label: 'Pharmacie — stock' }]);
  });

  it('lists labels starting with the query first', () => {
    expect(filterNavItems(pages, 'stock').map((p) => p.label)).toEqual(['Stock et achats', 'Pharmacie — stock']);
  });

  it('an empty query lists everything', () => {
    expect(filterNavItems(pages, '  ')).toHaveLength(4);
  });
});

describe('mobile tab bar', () => {
  it('takes 4 entries in priority order, never notifications or messages, the rest in More', () => {
    const items = [
      item('Notifications', '/dashboard/notifications', 'top'),
      item('Stock', '/dashboard/pharmacy/stock', 'pharmacy'),
      item('Patients', '/dashboard/patients', 'care'),
      item('Dashboard', '/dashboard', 'top'),
      item('Messages', '/dashboard/messages', 'top'),
      item('Queue', '/dashboard/queue', 'top'),
      item('Billing', '/dashboard/billing', 'finance'),
      item('Wards', '/dashboard/wards', 'care'),
    ];
    const { primary, more } = splitMobileItems(items);
    expect(primary.map((i) => i.label)).toEqual(['Dashboard', 'Queue', 'Patients', 'Billing']);
    expect(more.map((i) => i.label)).toEqual(['Notifications', 'Stock', 'Messages', 'Wards']);
  });

  it('fills with other pages when the role has few priority pages', () => {
    const { primary } = splitMobileItems([item('Dashboard', '/dashboard', 'top'), item('Wards', '/dashboard/wards', 'care'), item('Notifications', '/dashboard/notifications', 'top')]);
    expect(primary.map((i) => i.label)).toEqual(['Dashboard', 'Wards']);
  });
});

describe('active page', () => {
  const items = [{ href: '/dashboard' }, { href: '/dashboard/cash-desk' }, { href: '/dashboard/cash-desk/supervision' }];
  it('picks the most specific match; home only on its own path', () => {
    expect(activeNavHref(items, '/dashboard/cash-desk/supervision')).toBe('/dashboard/cash-desk/supervision');
    expect(activeNavHref(items, '/dashboard/cash-desk/sessions/1')).toBe('/dashboard/cash-desk');
    expect(activeNavHref(items, '/dashboard')).toBe('/dashboard');
    expect(activeNavHref(items, '/dashboard/unknown')).toBeUndefined();
  });
});

describe('small helpers', () => {
  it('initials', () => {
    expect(initialsOf('jean-pierre', 'atangana')).toBe('JA');
    expect(initialsOf(null, undefined)).toBe('?');
  });

  it('splits a pasted code into 6 digits', () => {
    expect(codeDigits('48 2-917')).toEqual(['4', '8', '2', '9', '1', '7']);
    expect(codeDigits('12')).toEqual(['1', '2', '', '', '', '']);
    expect(codeDigits('1234567')).toHaveLength(6);
  });
});
