// Role-Based Access Control Configuration
// Comprehensive role definitions for Hospital Management System

export type UserRole =
  | 'ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'RECEPTIONIST'
  | 'PHARMACIST'
  | 'LAB_TECH'
  | 'PATIENT';

export type Permission =
  // Dashboard
  | 'dashboard:view'
  | 'dashboard:view_stats'
  | 'dashboard:view_all_stats'

  // Patient Management
  | 'patients:view'
  | 'patients:view_own' // For doctors - only their patients
  | 'patients:view_all'
  | 'patients:create'
  | 'patients:edit'
  | 'patients:delete'
  | 'patients:view_records'
  | 'patients:record_vitals'

  // Doctor Management
  | 'doctors:view'
  | 'doctors:view_all'
  | 'doctors:create'
  | 'doctors:edit'
  | 'doctors:delete'
  | 'doctors:manage_schedule' // Own schedule
  | 'doctors:manage_all_schedules'

  // Appointments
  | 'appointments:view'
  | 'appointments:view_own' // Own appointments only
  | 'appointments:view_all'
  | 'appointments:create'
  | 'appointments:edit'
  | 'appointments:cancel'
  | 'appointments:check_in'
  | 'appointments:start_consultation'
  | 'appointments:complete'

  // Departments
  | 'departments:view'
  | 'departments:create'
  | 'departments:edit'
  | 'departments:delete'

  // Medical Records & Consultations
  | 'records:view'
  | 'records:view_own' // Patient's own records
  | 'records:view_own_patients' // Doctor's patients' records
  | 'records:view_all'
  | 'records:create'
  | 'records:edit'
  | 'records:delete'

  // Prescriptions
  | 'prescriptions:view'
  | 'prescriptions:view_own'
  | 'prescriptions:create'
  | 'prescriptions:edit'
  | 'prescriptions:dispense'

  // Pharmacy
  | 'pharmacy:view'
  | 'pharmacy:view_prescriptions'
  | 'pharmacy:dispense'
  | 'pharmacy:manage_stock'
  | 'pharmacy:edit_medications'
  | 'pharmacy:manage_all'

  // Laboratory
  | 'laboratory:view'
  | 'laboratory:view_own_results' // Patient's own
  | 'laboratory:view_patient_results' // Doctor viewing patient results
  | 'laboratory:create_orders'
  | 'laboratory:enter_results'
  | 'laboratory:manage_tests'
  | 'laboratory:manage_all'

  // Billing & Invoices
  | 'billing:view'
  | 'billing:view_own' // Patient's own bills
  | 'billing:view_all'
  | 'billing:create'
  | 'billing:edit'
  | 'billing:process_payments'
  | 'billing:manage_all'

  // Inventory
  | 'inventory:view'
  | 'inventory:manage'
  | 'inventory:manage_suppliers'
  | 'inventory:manage_all'

  // Reports & Analytics
  | 'reports:view'
  | 'reports:view_own' // Doctor's own performance
  | 'reports:view_financial'
  | 'reports:view_all'
  | 'reports:export'

  // User Management
  | 'users:view'
  | 'users:view_all'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  | 'users:manage_roles'

  // Settings
  | 'settings:view'
  | 'settings:edit'
  | 'settings:manage_system'

  // Notifications
  | 'notifications:view'
  | 'notifications:create'
  | 'notifications:create_broadcast'
  | 'notifications:delete';

/**
 * ROLE DEFINITIONS
 *
 * ADMIN: Full system administrator
 * - Complete access to all system features
 * - User management, system settings, all reports
 * - Can manage all departments, doctors, staff
 *
 * DOCTOR: Medical practitioner
 * - View and manage own patients
 * - Manage own schedule and availability
 * - Create consultations, prescriptions, lab orders
 * - View lab results for their patients
 * - View own performance reports
 *
 * NURSE: Clinical support staff
 * - Record patient vitals (via appointments/records)
 * - Assist with patient check-in
 * - View prescriptions and lab results
 * - Cannot access Patients, Doctors, or Departments pages
 *
 * RECEPTIONIST: Front desk staff
 * - Patient registration and management
 * - Appointment scheduling for all doctors
 * - Patient check-in
 * - Basic billing and payment processing
 *
 * PHARMACIST: Pharmacy staff
 * - View and dispense prescriptions
 * - Manage pharmacy inventory
 * - Track medication stock levels
 * - View patient medication history
 *
 * LAB_TECH: Laboratory technician
 * - View assigned lab orders
 * - Enter and verify lab results
 * - Manage test catalog
 * - View limited patient information
 *
 * PATIENT: End user patient
 * - View own appointments and book new ones
 * - View own medical records
 * - View own prescriptions and lab results
 * - View own bills and payment history
 */

export const rolePermissions: Record<UserRole, Permission[]> = {
  // ADMIN - Full system access
  ADMIN: [
    'dashboard:view', 'dashboard:view_stats', 'dashboard:view_all_stats',
    'patients:view', 'patients:view_all', 'patients:create', 'patients:edit', 'patients:delete', 'patients:view_records', 'patients:record_vitals',
    'doctors:view', 'doctors:view_all', 'doctors:create', 'doctors:edit', 'doctors:delete', 'doctors:manage_schedule', 'doctors:manage_all_schedules',
    'appointments:view', 'appointments:view_all', 'appointments:create', 'appointments:edit', 'appointments:cancel', 'appointments:check_in', 'appointments:start_consultation', 'appointments:complete',
    'departments:view', 'departments:create', 'departments:edit', 'departments:delete',
    'records:view', 'records:view_all', 'records:create', 'records:edit', 'records:delete',
    'prescriptions:view', 'prescriptions:create', 'prescriptions:edit', 'prescriptions:dispense',
    'pharmacy:view', 'pharmacy:view_prescriptions', 'pharmacy:dispense', 'pharmacy:manage_stock', 'pharmacy:edit_medications', 'pharmacy:manage_all',
    'laboratory:view', 'laboratory:view_patient_results', 'laboratory:create_orders', 'laboratory:enter_results', 'laboratory:manage_tests', 'laboratory:manage_all',
    'billing:view', 'billing:view_all', 'billing:create', 'billing:edit', 'billing:process_payments', 'billing:manage_all',
    'inventory:view', 'inventory:manage', 'inventory:manage_suppliers', 'inventory:manage_all',
    'reports:view', 'reports:view_financial', 'reports:view_all', 'reports:export',
    'users:view', 'users:view_all', 'users:create', 'users:edit', 'users:delete', 'users:manage_roles',
    'settings:view', 'settings:edit', 'settings:manage_system',
    'notifications:view', 'notifications:create', 'notifications:create_broadcast', 'notifications:delete',
  ],

  // DOCTOR - Medical practitioner focused on patient care
  DOCTOR: [
    'dashboard:view', 'dashboard:view_stats',
    // Patient access - own patients only (including vital signs recording)
    'patients:view_own', 'patients:view_records', 'patients:record_vitals',
    // Own schedule management only (no access to doctors management page)
    'doctors:manage_schedule',
    // Appointments - own appointments
    'appointments:view', 'appointments:view_own', 'appointments:create', 'appointments:edit', 'appointments:cancel', 'appointments:start_consultation', 'appointments:complete',
    // Medical records - create and edit for own patients (no access to departments management page)
    'records:view', 'records:view_own_patients', 'records:create', 'records:edit',
    // Prescriptions - create for own patients
    'prescriptions:view', 'prescriptions:create', 'prescriptions:edit',
    // Pharmacy - view only
    'pharmacy:view', 'pharmacy:view_prescriptions',
    // Laboratory - create orders, view results
    'laboratory:view', 'laboratory:view_patient_results', 'laboratory:create_orders',
    // Billing - view only
    'billing:view',
    // Reports - own performance
    'reports:view', 'reports:view_own',
    // Notifications
    'notifications:view',
  ],

  // NURSE - Clinical support
  NURSE: [
    'dashboard:view', 'dashboard:view_stats',
    // Patient access - can view records and record vitals, but NOT access Patients page
    'patients:view_records', 'patients:record_vitals',
    // Appointments - assist with check-in
    'appointments:view', 'appointments:view_all', 'appointments:check_in',
    // Records - view and add vitals/notes
    'records:view', 'records:create',
    // Prescriptions - view only
    'prescriptions:view',
    // Laboratory - view results (not manage)
    'laboratory:view', 'laboratory:view_patient_results',
    // Notifications
    'notifications:view',
  ],

  // RECEPTIONIST - Front desk operations
  RECEPTIONIST: [
    'dashboard:view', 'dashboard:view_stats',
    // Patient management
    'patients:view', 'patients:view_all', 'patients:create', 'patients:edit',
    // View doctors and schedules
    'doctors:view',
    // Full appointment management
    'appointments:view', 'appointments:view_all', 'appointments:create', 'appointments:edit', 'appointments:cancel', 'appointments:check_in',
    // Departments
    'departments:view',
    // Billing - create invoices, process payments
    'billing:view', 'billing:view_all', 'billing:create', 'billing:process_payments',
    // Notifications
    'notifications:view', 'notifications:create',
  ],

  // PHARMACIST - Pharmacy operations
  PHARMACIST: [
    'dashboard:view', 'dashboard:view_stats',
    // Patient - view for prescription context
    'patients:view',
    // View doctors
    'doctors:view',
    // Pharmacy - full access
    'pharmacy:view', 'pharmacy:view_prescriptions', 'pharmacy:dispense', 'pharmacy:manage_stock', 'pharmacy:edit_medications',
    // Prescriptions - view and dispense
    'prescriptions:view', 'prescriptions:dispense',
    // Inventory - manage pharmacy stock
    'inventory:view', 'inventory:manage',
    // Billing - view for prescription billing
    'billing:view',
    // Reports - pharmacy reports
    'reports:view',
    // Notifications
    'notifications:view',
  ],

  // LAB_TECH - Laboratory operations
  LAB_TECH: [
    'dashboard:view', 'dashboard:view_stats',
    // Patient - limited view for lab context
    'patients:view',
    // View doctors
    'doctors:view',
    // Laboratory - full access
    'laboratory:view', 'laboratory:view_patient_results', 'laboratory:enter_results', 'laboratory:manage_tests',
    // Inventory - view lab supplies
    'inventory:view',
    // Reports - lab reports
    'reports:view',
    // Notifications
    'notifications:view',
  ],

  // PATIENT - End user (limited access to own data only)
  PATIENT: [
    'dashboard:view',
    // Appointments - can view list (filtered to own) and create/cancel own appointments
    'appointments:view', 'appointments:view_own', 'appointments:create', 'appointments:cancel',
    // Own health data only - accessed via My Health page
    'records:view_own',
    'prescriptions:view_own',
    'laboratory:view_own_results',
    // Notifications
    'notifications:view',
    // Note: Patients do NOT have access to:
    // - doctors:view (no doctors management page)
    // - departments:view (no departments page)
    // - records:view, prescriptions:view (no staff medical records/prescriptions pages)
    // - billing:view (no billing page - bills shown in My Health)
  ],
};

// Role-specific navigation items
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  permission?: Permission;
  roles?: UserRole[]; // Restrict to these roles in addition to the permission check
  badge?: string;
  children?: NavItem[];
}

// Navigation items with role-appropriate ordering and visibility
export const navigationItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    permission: 'dashboard:view',
  },
  {
    label: 'My Health',
    href: '/dashboard/my-health',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    permission: 'records:view_own', // Patient only - view own medical records
  },
  {
    label: 'My Schedule',
    href: '/dashboard/schedule',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    permission: 'doctors:manage_schedule',
    roles: ['DOCTOR'],
  },
  {
    label: 'My Patients',
    href: '/dashboard/my-patients',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'patients:view_own', // Doctor only - view own patients
    roles: ['DOCTOR'],
  },
  {
    label: 'Appointments',
    href: '/dashboard/appointments',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    permission: 'appointments:view',
  },
  {
    label: 'Patients',
    href: '/dashboard/patients',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'patients:view',
  },
  {
    label: 'Doctors',
    href: '/dashboard/doctors',
    icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    permission: 'doctors:view', // All staff can browse doctors
  },
  {
    label: 'Departments',
    href: '/dashboard/departments',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    permission: 'departments:view', // All staff can view departments
  },
  {
    label: 'Medical Records',
    href: '/dashboard/records',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    permission: 'records:view',
  },
  {
    label: 'Prescriptions',
    href: '/dashboard/prescriptions',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    permission: 'prescriptions:view',
  },
  {
    label: 'Vital Signs',
    href: '/dashboard/vitals',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    permission: 'patients:view_records', // Doctors, nurses can view
  },
  {
    label: 'Consultations',
    href: '/dashboard/consultations',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    permission: 'records:view', // Doctors can create/view consultations
  },
  {
    label: 'Pharmacy',
    href: '/dashboard/pharmacy',
    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
    permission: 'pharmacy:dispense', // Only pharmacists who can dispense
  },
  {
    label: 'Laboratory',
    href: '/dashboard/laboratory',
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
    permission: 'laboratory:enter_results', // Only lab techs who enter results
  },
  {
    label: 'Lab Results',
    href: '/dashboard/lab-results',
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
    permission: 'laboratory:view_patient_results', // For doctors/nurses viewing results
  },
  {
    label: 'Billing',
    href: '/dashboard/billing',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'billing:view_all', // Only admin/receptionist who manage billing
  },
  {
    label: 'Payments',
    href: '/dashboard/payments',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    permission: 'reports:view_all', // Admin only - payment analytics
  },
  {
    label: 'Inventory',
    href: '/dashboard/inventory',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    permission: 'inventory:manage', // Only those who can manage inventory
  },
  {
    label: 'Reports',
    href: '/dashboard/reports',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    permission: 'reports:view_all', // Only admin can see full reports
  },
  {
    label: 'Users',
    href: '/dashboard/users',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    permission: 'users:view_all', // Admin only
  },
  {
    label: 'Audit Log',
    href: '/dashboard/audit',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    permission: 'settings:manage_system', // Admin only
  },
  {
    label: 'System Status',
    href: '/dashboard/system-status',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    permission: 'settings:manage_system', // Admin only
  },
  {
    label: 'Notifications',
    href: '/dashboard/notifications',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    permission: 'notifications:view', // All users can view notifications
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    permission: 'settings:manage_system', // Admin only - system settings
  },
];

// Route to permission mapping for page-level protection
export const routePermissions: Record<string, Permission> = {
  '/dashboard': 'dashboard:view',
  '/dashboard/my-health': 'records:view_own', // Patient portal
  '/dashboard/schedule': 'doctors:manage_schedule',
  '/dashboard/my-patients': 'patients:view_own', // Doctor's own patients
  '/dashboard/patients': 'patients:view',
  '/dashboard/patients/new': 'patients:create',
  '/dashboard/doctors': 'doctors:view',
  '/dashboard/doctors/new': 'doctors:create',
  '/dashboard/appointments': 'appointments:view',
  '/dashboard/appointments/new': 'appointments:create',
  '/dashboard/departments': 'departments:view',
  '/dashboard/departments/new': 'departments:create',
  '/dashboard/records': 'records:view',
  '/dashboard/prescriptions': 'prescriptions:view',
  '/dashboard/prescriptions/new': 'prescriptions:create',
  '/dashboard/vitals': 'patients:view_records',
  '/dashboard/consultations': 'records:view',
  '/dashboard/consultations/new': 'records:create',
  '/dashboard/pharmacy': 'pharmacy:dispense', // Pharmacists only
  '/dashboard/laboratory': 'laboratory:enter_results', // Lab techs only
  '/dashboard/laboratory/orders/new': 'laboratory:create_orders', // Doctors order tests
  '/dashboard/laboratory/orders': 'laboratory:view', // Order detail for anyone with lab access
  '/dashboard/lab-results': 'laboratory:view_patient_results', // Doctors, nurses, lab techs
  '/dashboard/billing': 'billing:view_all', // Admin, receptionist only
  '/dashboard/inventory': 'inventory:manage', // Admin, pharmacist only
  '/dashboard/reports': 'reports:view_all', // Admin only
  '/dashboard/users': 'users:view_all', // Admin only
  '/dashboard/audit': 'settings:manage_system', // Admin only
  '/dashboard/system-status': 'settings:manage_system', // Admin only
  '/dashboard/notifications': 'notifications:view',
  '/dashboard/profile': 'dashboard:view', // All authenticated users can access their profile
  '/dashboard/settings': 'settings:manage_system', // Admin only
};

// Routes that only make sense for specific roles (e.g. a doctor's own schedule)
export const routeRoles: Record<string, UserRole[]> = {
  '/dashboard/schedule': ['DOCTOR'],
  '/dashboard/my-patients': ['DOCTOR'],
};

// Helper functions
export function hasPermission(userRole: UserRole | string | undefined, permission: Permission): boolean {
  if (!userRole) return false;
  const role = userRole as UserRole;
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function hasAnyPermission(userRole: UserRole | string | undefined, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(userRole: UserRole | string | undefined, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  return rolePermissions[role] || [];
}

export function canAccessRoute(userRole: UserRole | string | undefined, pathname: string): boolean {
  // Find matching route - check exact match first, then prefix matches
  let requiredPermission: Permission | undefined;

  // Try exact match first
  if (routePermissions[pathname]) {
    requiredPermission = routePermissions[pathname];
  } else {
    // Try prefix match (for dynamic routes like /dashboard/patients/[id])
    const matchingRoute = Object.keys(routePermissions)
      .filter(route => pathname.startsWith(route))
      .sort((a, b) => b.length - a.length)[0];

    if (matchingRoute) {
      requiredPermission = routePermissions[matchingRoute];
    }
  }

  const restrictedTo = Object.entries(routeRoles).find(([route]) => pathname.startsWith(route))?.[1];
  if (restrictedTo && !restrictedTo.includes(userRole as UserRole)) return false;

  // If no permission required, allow access
  if (!requiredPermission) return true;

  return hasPermission(userRole, requiredPermission);
}

export function isNavItemVisible(item: NavItem, userRole: UserRole | string | undefined): boolean {
  if (item.roles && !item.roles.includes(userRole as UserRole)) return false;
  if (!item.permission) return true;
  return hasPermission(userRole, item.permission);
}

// Get navigation items filtered by user role
export function getNavigationForRole(userRole: UserRole | string | undefined): NavItem[] {
  if (!userRole) return [];

  return navigationItems.filter(item => isNavItemVisible(item, userRole));
}

// Role display names
export const roleDisplayNames: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist',
  LAB_TECH: 'Lab Technician',
  PATIENT: 'Patient',
};

// Role descriptions for UI
export const roleDescriptions: Record<UserRole, string> = {
  ADMIN: 'Full system access - manages users, settings, and all departments',
  DOCTOR: 'Manages patients, consultations, prescriptions, and lab orders',
  NURSE: 'Records vitals, assists with check-ins, views prescriptions and lab results',
  RECEPTIONIST: 'Manages appointments, patient registration, and billing',
  PHARMACIST: 'Dispenses medications, manages pharmacy inventory',
  LAB_TECH: 'Processes lab orders, enters results, manages tests',
  PATIENT: 'Views own appointments, records, prescriptions, and bills',
};

// Role colors for badges
export const roleColors: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400',
  DOCTOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400',
  NURSE: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400',
  RECEPTIONIST: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400',
  PHARMACIST: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400',
  LAB_TECH: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-400',
  PATIENT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
};

// Role icons
export const roleIcons: Record<UserRole, string> = {
  ADMIN: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  DOCTOR: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  NURSE: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  RECEPTIONIST: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  PHARMACIST: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  LAB_TECH: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
  PATIENT: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
};

// Quick access items per role (shown on dashboard)
export const roleQuickActions: Record<UserRole, { label: string; href: string; icon: string; color: string }[]> = {
  ADMIN: [
    { label: 'Add User', href: '/dashboard/users?new=1', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'purple' },
    { label: 'View Reports', href: '/dashboard/reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'blue' },
    { label: 'System Settings', href: '/dashboard/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', color: 'gray' },
  ],
  DOCTOR: [
    { label: 'My Schedule', href: '/dashboard/schedule', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'blue' },
    { label: 'My Patients', href: '/dashboard/patients', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: 'green' },
    { label: 'Lab Results', href: '/dashboard/lab-results', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z', color: 'purple' },
    { label: 'New Prescription', href: '/dashboard/prescriptions/new', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', color: 'lime' },
  ],
  NURSE: [
    { label: 'Check-In Patient', href: '/dashboard/appointments', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', color: 'green' },
    { label: 'Record Vitals', href: '/dashboard/vitals', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', color: 'red' },
    { label: 'Lab Results', href: '/dashboard/lab-results', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z', color: 'purple' },
  ],
  RECEPTIONIST: [
    { label: 'New Patient', href: '/dashboard/patients/new', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', color: 'green' },
    { label: 'New Appointment', href: '/dashboard/appointments/new', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'blue' },
    { label: 'Create Invoice', href: '/dashboard/billing?new=1', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', color: 'yellow' },
  ],
  PHARMACIST: [
    { label: 'Dispense Medication', href: '/dashboard/pharmacy', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', color: 'orange' },
    { label: 'View Prescriptions', href: '/dashboard/prescriptions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', color: 'blue' },
    { label: 'Manage Stock', href: '/dashboard/inventory', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'green' },
  ],
  LAB_TECH: [
    { label: 'Pending Tests', href: '/dashboard/laboratory', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z', color: 'cyan' },
    { label: 'Enter Results', href: '/dashboard/laboratory', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'blue' },
    { label: 'Manage Tests', href: '/dashboard/laboratory', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', color: 'purple' },
  ],
  PATIENT: [
    { label: 'My Health', href: '/dashboard/my-health', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', color: 'red' },
    { label: 'Book Appointment', href: '/dashboard/appointments/new', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'blue' },
    { label: 'My Appointments', href: '/dashboard/appointments', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'lime' },
    { label: 'Notifications', href: '/dashboard/notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: 'yellow' },
  ],
};

// Stats to show on dashboard per role
export const roleDashboardStats: Record<UserRole, string[]> = {
  ADMIN: ['totalPatients', 'totalDoctors', 'todayAppointments', 'monthlyRevenue', 'pendingBills', 'activeUsers'],
  DOCTOR: ['myPatientsToday', 'myAppointmentsToday', 'pendingLabResults', 'completedConsultations'],
  NURSE: ['patientsWaiting', 'todayCheckIns', 'pendingVitals', 'todayAppointments'],
  RECEPTIONIST: ['todayAppointments', 'newPatients', 'pendingCheckIns', 'todayRevenue'],
  PHARMACIST: ['pendingPrescriptions', 'dispensedToday', 'lowStockItems', 'totalMedications'],
  LAB_TECH: ['pendingTests', 'completedToday', 'criticalResults', 'totalTests'],
  PATIENT: ['upcomingAppointments', 'activePrescriptions', 'pendingLabResults', 'recentConsultations'],
};
