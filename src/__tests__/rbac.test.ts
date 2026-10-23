import { describe, expect, it } from 'vitest';
import { canAccessRoute, isNavItemVisible, navigationItems, getNavigationForRole } from '@/lib/rbac';

const ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH', 'PATIENT'] as const;

function allowedRoles(path: string) {
  return ROLES.filter((role) => canAccessRoute(role, path));
}

describe('canAccessRoute', () => {
  it('keeps user management and the audit log admin-only', () => {
    expect(allowedRoles('/dashboard/users')).toEqual(['ADMIN']);
    expect(allowedRoles('/dashboard/audit')).toEqual(['ADMIN']);
    expect(allowedRoles('/dashboard/system-status')).toEqual(['ADMIN']);
  });

  it('keeps the personal schedule and patient list doctor-only', () => {
    expect(allowedRoles('/dashboard/schedule')).toEqual(['DOCTOR']);
    expect(allowedRoles('/dashboard/my-patients')).toEqual(['DOCTOR']);
  });

  it('lets doctors order lab tests without opening the lab bench', () => {
    expect(canAccessRoute('DOCTOR', '/dashboard/laboratory/orders/new')).toBe(true);
    expect(canAccessRoute('DOCTOR', '/dashboard/laboratory')).toBe(false);
    expect(canAccessRoute('LAB_TECH', '/dashboard/laboratory')).toBe(true);
    expect(canAccessRoute('PATIENT', '/dashboard/laboratory/orders/new')).toBe(false);
  });

  it('keeps patients out of staff pages', () => {
    for (const path of ['/dashboard/patients', '/dashboard/billing', '/dashboard/reports', '/dashboard/pharmacy', '/dashboard/users']) {
      expect(canAccessRoute('PATIENT', path), path).toBe(false);
    }
    expect(canAccessRoute('PATIENT', '/dashboard/my-health')).toBe(true);
  });

  it('applies the parent rule to detail pages', () => {
    expect(canAccessRoute('RECEPTIONIST', '/dashboard/patients/123')).toBe(true);
    expect(canAccessRoute('PATIENT', '/dashboard/patients/123')).toBe(false);
  });

  it('denies everything to a missing role', () => {
    expect(canAccessRoute(undefined, '/dashboard/users')).toBe(false);
  });
});

describe('navigation', () => {
  const item = (label: string) => navigationItems.find((n) => n.label === label)!;

  it('hides the doctor-only items from admins', () => {
    expect(isNavItemVisible(item('My Schedule'), 'ADMIN')).toBe(false);
    expect(isNavItemVisible(item('My Schedule'), 'DOCTOR')).toBe(true);
    expect(isNavItemVisible(item('My Patients'), 'ADMIN')).toBe(false);
  });

  it('shows the audit log and system status to admins only', () => {
    expect(ROLES.filter((r) => isNavItemVisible(item('Audit Log'), r))).toEqual(['ADMIN']);
    expect(ROLES.filter((r) => isNavItemVisible(item('System Status'), r))).toEqual(['ADMIN']);
  });

  it('only lists pages each role can open', () => {
    for (const role of ROLES) {
      for (const nav of getNavigationForRole(role)) {
        expect(canAccessRoute(role, nav.href), `${role} → ${nav.href}`).toBe(true);
      }
    }
  });

  it('gives no navigation without a role', () => {
    expect(getNavigationForRole(undefined)).toEqual([]);
  });
});
