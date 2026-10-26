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

  // Purchasing (orders to suppliers, goods receipt, supplier invoices)
  | 'purchasing:manage'

  // Main cash desk: own till (open, take payments, cash in/out, close) and supervision of all tills
  | 'cash-desk:operate'
  | 'cash-desk:supervise'

  // Video teleconsultation: the appointment's doctor and patient join; admins see the day's list
  | 'teleconsultation:join'

  // Official monthly statistics (rapport mensuel d'activités, DHIS2): doctors read, admins validate and export
  | 'statistics:view'
  | 'statistics:manage'

  // Price list (grille tarifaire): front desk and doctors look prices up, admins change them
  | 'pricing:view'
  | 'pricing:manage'

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
    'purchasing:manage',
    'cash-desk:operate', 'cash-desk:supervise',
    'statistics:view', 'statistics:manage',
    'pricing:view', 'pricing:manage',
    'teleconsultation:join',
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
    // Official monthly statistics - read only
    'statistics:view',
    // Price list - read only
    'pricing:view',
    // Video consultations with own patients
    'teleconsultation:join',
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
    // Cash desk - own till; approvals and deposits stay with the admin
    'cash-desk:operate',
    // Price list - read only (invoice lines are picked from it)
    'pricing:view',
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
    // Purchasing - orders to suppliers and goods receipt (admins approve large orders and pay)
    'purchasing:manage',
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
    // Own video appointments
    'teleconsultation:join',
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
/** Sidebar section an item belongs to; 'top' items are listed first, without a heading */
export type NavGroup = 'top' | 'care' | 'pharmacy' | 'finance' | 'team' | 'admin';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  group: NavGroup;
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
    group: 'top',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    permission: 'dashboard:view',
  },
  {
    label: 'My Health',
    href: '/dashboard/my-health',
    group: 'top',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    permission: 'records:view_own', // Patient only - view own medical records
  },
  {
    label: 'My Family',
    href: '/dashboard/family',
    group: 'top',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'records:view_own',
    roles: ['PATIENT'], // Family access: relatives I manage, who may see my record
  },
  {
    label: 'My Schedule',
    href: '/dashboard/schedule',
    group: 'top',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    permission: 'doctors:manage_schedule',
    roles: ['DOCTOR'],
  },
  {
    label: 'Rosters',
    href: '/dashboard/rosters',
    group: 'team',
    icon: 'M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH'],
  },
  {
    label: 'My Shifts',
    href: '/dashboard/my-schedule',
    group: 'team',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH'],
  },
  {
    label: 'Leave',
    href: '/dashboard/leave',
    group: 'team',
    icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH'],
  },
  {
    label: 'Roster Settings',
    href: '/dashboard/rosters/settings',
    group: 'admin',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
    permission: 'dashboard:view',
    roles: ['ADMIN'],
  },
  {
    label: 'My Patients',
    href: '/dashboard/my-patients',
    group: 'top',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'patients:view_own', // Doctor only - view own patients
    roles: ['DOCTOR'],
  },
  {
    label: 'Appointments',
    href: '/dashboard/appointments',
    group: 'top',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    permission: 'appointments:view',
  },
  {
    label: 'Teleconsultations',
    href: '/dashboard/teleconsultations',
    group: 'top',
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    permission: 'teleconsultation:join',
    roles: ['DOCTOR', 'PATIENT'], // Video consultations: waiting patients, join
  },
  {
    label: 'Queue',
    href: '/dashboard/queue',
    group: 'top',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    permission: 'appointments:view',
    roles: ['ADMIN', 'RECEPTIONIST', 'NURSE', 'DOCTOR'], // Waiting room: tickets, triage, calls
  },
  {
    label: 'Beds',
    href: '/dashboard/wards',
    group: 'care',
    icon: 'M3 7v11m0-4h18m0 4V9a2 2 0 00-2-2h-8v7M7 11a2 2 0 100-4 2 2 0 000 4z',
    permission: 'appointments:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'], // Bed board: wards, free and occupied beds
  },
  {
    label: 'Admissions',
    href: '/dashboard/admissions',
    group: 'care',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    permission: 'appointments:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'], // Hospital stays
  },
  {
    label: 'Imaging',
    href: '/dashboard/imaging',
    group: 'care',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECH'], // Radiology worklist, exams and reports
  },
  {
    label: 'Imaging Catalogue',
    href: '/dashboard/imaging/exams',
    group: 'care',
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    permission: 'dashboard:view',
    roles: ['ADMIN'], // Exams and prices
  },
  {
    label: 'Medical Documents',
    href: '/dashboard/documents',
    group: 'care',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'], // Certificates, sick leave, referral letters
  },
  {
    label: 'Referrals',
    href: '/dashboard/referrals',
    group: 'care',
    icon: 'M13 7l5 5m0 0l-5 5m5-5H6',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'], // Referral follow-up (contre-référence)
  },
  {
    label: 'Patient Feedback',
    href: '/dashboard/feedback',
    group: 'care',
    icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'], // Satisfaction surveys, NPS, complaints
  },
  {
    label: 'Emergency',
    href: '/dashboard/emergency',
    group: 'care',
    icon: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'], // ED board: priorities, time targets, bays, dispositions
  },
  {
    label: 'Vaccination',
    href: '/dashboard/vaccination',
    group: 'care',
    icon: 'M18 2l4 4M17 7l3-3M19 9l-8.7 8.7a1 1 0 01-.6.3H6v-3.7a1 1 0 01.3-.7L15 5M9 11l4 4M5 19l-3 3M14 4l6 6',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'], // EPI session: doses due and defaulters
  },
  {
    label: 'Antenatal Care',
    href: '/dashboard/antenatal',
    group: 'care',
    icon: 'M12 21s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 11c0 5.65-7 10-7 10z',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR', 'NURSE'], // Ongoing pregnancies: contacts due, alerts
  },
  {
    label: 'Consultation Templates',
    href: '/dashboard/templates',
    group: 'care',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4',
    permission: 'dashboard:view',
    roles: ['ADMIN', 'DOCTOR'], // Pre-filled consultation notes, ICD-10 codes and orders
  },
  {
    label: 'Medication Round',
    href: '/dashboard/mar-round',
    group: 'care',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    permission: 'appointments:view',
    roles: ['NURSE', 'ADMIN', 'DOCTOR'], // Doses due now on a ward
  },
  {
    label: 'Patients',
    href: '/dashboard/patients',
    group: 'care',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'patients:view',
  },
  {
    label: 'Doctors',
    href: '/dashboard/doctors',
    group: 'admin',
    icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    permission: 'doctors:view', // All staff can browse doctors
  },
  {
    label: 'Departments',
    href: '/dashboard/departments',
    group: 'admin',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    permission: 'departments:view', // All staff can view departments
  },
  {
    label: 'Medical Records',
    href: '/dashboard/records',
    group: 'care',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    permission: 'records:view',
  },
  {
    label: 'Prescriptions',
    href: '/dashboard/prescriptions',
    group: 'care',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    permission: 'prescriptions:view',
  },
  {
    label: 'Vital Signs',
    href: '/dashboard/vitals',
    group: 'care',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    permission: 'patients:view_records', // Doctors, nurses can view
  },
  {
    label: 'Consultations',
    href: '/dashboard/consultations',
    group: 'care',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    permission: 'records:view', // Doctors can create/view consultations
  },
  {
    label: 'Pharmacy',
    href: '/dashboard/pharmacy',
    group: 'pharmacy',
    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
    permission: 'pharmacy:dispense', // Only pharmacists who can dispense
  },
  {
    label: 'Pharmacy POS',
    href: '/dashboard/pharmacy/pos',
    group: 'pharmacy',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'pharmacy:dispense',
    roles: ['ADMIN', 'PHARMACIST'], // Counter sales (caisse)
  },
  {
    label: 'Pharmacy Prescriptions',
    href: '/dashboard/pharmacy/prescriptions',
    group: 'pharmacy',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    permission: 'pharmacy:dispense',
    roles: ['ADMIN', 'PHARMACIST'], // In-house prescriptions to dispense
  },
  {
    label: 'Pharmacy Sales',
    href: '/dashboard/pharmacy/sales',
    group: 'pharmacy',
    icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
    permission: 'pharmacy:dispense',
    roles: ['ADMIN', 'PHARMACIST'], // Sales, returns, receipts
  },
  {
    label: 'Pharmacy Stock',
    href: '/dashboard/pharmacy/stock',
    group: 'pharmacy',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    permission: 'pharmacy:dispense',
    roles: ['ADMIN', 'PHARMACIST'], // Stock by batch, receipts, expiry
  },
  {
    label: 'Till Sessions',
    href: '/dashboard/pharmacy/sessions',
    group: 'pharmacy',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    permission: 'pharmacy:dispense',
    roles: ['ADMIN', 'PHARMACIST'], // Till sessions and daily report
  },
  {
    label: 'Laboratory',
    href: '/dashboard/laboratory',
    group: 'care',
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
    permission: 'laboratory:enter_results', // Only lab techs who enter results
  },
  {
    label: 'Lab Results',
    href: '/dashboard/lab-results',
    group: 'care',
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
    permission: 'laboratory:view_patient_results', // For doctors/nurses viewing results
  },
  {
    label: 'Billing',
    href: '/dashboard/billing',
    group: 'finance',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'billing:view_all', // Only admin/receptionist who manage billing
  },
  {
    label: 'Cash Desk',
    href: '/dashboard/cash-desk',
    group: 'finance',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'cash-desk:operate',
    roles: ['ADMIN', 'RECEPTIONIST'], // My till: payments, cash in/out, closing count
  },
  {
    label: 'Cash Desk Supervision',
    href: '/dashboard/cash-desk/supervision',
    group: 'finance',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    permission: 'cash-desk:supervise', // Admin: all tills, deposits, refund approvals
  },
  {
    label: 'Insurers',
    href: '/dashboard/insurers',
    group: 'finance',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    permission: 'billing:view_all',
    roles: ['ADMIN', 'RECEPTIONIST'], // Admin configures payers; the desk reads them
  },
  {
    label: 'Claims',
    href: '/dashboard/claims',
    group: 'finance',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    permission: 'billing:view_all',
    roles: ['ADMIN', 'RECEPTIONIST'], // Bordereaux sent to insurers
  },
  {
    label: 'Receivables',
    href: '/dashboard/receivables',
    group: 'finance',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    permission: 'billing:view_all',
    roles: ['ADMIN', 'RECEPTIONIST'], // What insurers still owe, by age
  },
  {
    label: 'Payments',
    href: '/dashboard/payments',
    group: 'finance',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    permission: 'reports:view_all', // Admin only - payment analytics
  },
  {
    label: 'Inventory',
    href: '/dashboard/inventory',
    group: 'pharmacy',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    permission: 'inventory:manage', // Only those who can manage inventory
  },
  {
    label: 'Official Statistics',
    href: '/dashboard/statistics',
    group: 'admin',
    icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    permission: 'statistics:view', // Monthly activity report for the health district (DHIS2)
  },
  {
    label: 'Purchasing',
    href: '/dashboard/purchasing',
    group: 'pharmacy',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'purchasing:manage',
    roles: ['ADMIN', 'PHARMACIST'], // Orders, receipts, supplier invoices and payables
  },
  {
    label: 'Reports',
    href: '/dashboard/reports',
    group: 'admin',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    permission: 'reports:view_all', // Only admin can see full reports
  },
  {
    label: 'Users',
    href: '/dashboard/users',
    group: 'admin',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    permission: 'users:view_all', // Admin only
  },
  {
    label: 'Audit Log',
    href: '/dashboard/audit',
    group: 'admin',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    permission: 'settings:manage_system', // Admin only
  },
  {
    label: 'System Status',
    href: '/dashboard/system-status',
    group: 'admin',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    permission: 'settings:manage_system', // Admin only
  },
  {
    label: 'Messages',
    href: '/dashboard/messages',
    group: 'top',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    permission: 'settings:manage_system', // Admin only: outbound SMS, WhatsApp and email log
  },
  {
    label: 'Notifications',
    href: '/dashboard/notifications',
    group: 'top',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    permission: 'notifications:view', // All users can view notifications
  },
  {
    label: 'Price List',
    href: '/dashboard/price-list',
    group: 'finance',
    icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    permission: 'pricing:view', // Grille tarifaire: admin edits, front desk and doctors read
  },
  {
    label: 'Clinical Reference',
    href: '/dashboard/settings/clinical',
    group: 'admin',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    permission: 'settings:manage_system', // Admin only: ICD-10 codes and drug interactions (read-only)
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    group: 'admin',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    permission: 'settings:manage_system', // Admin only - system settings
  },
];

// Route to permission mapping for page-level protection
export const routePermissions: Record<string, Permission> = {
  '/dashboard': 'dashboard:view',
  '/dashboard/my-health': 'records:view_own', // Patient portal
  '/dashboard/family': 'records:view_own', // Family access (patients)
  '/dashboard/feedback': 'dashboard:view', // Patient feedback (roles below)
  '/dashboard/schedule': 'doctors:manage_schedule',
  '/dashboard/my-patients': 'patients:view_own', // Doctor's own patients
  '/dashboard/patients': 'patients:view',
  '/dashboard/emergency': 'dashboard:view', // nurses have no patients:view; routeRoles limits who gets in
  '/dashboard/vaccination': 'dashboard:view', // nurses have no patients:view; routeRoles limits who gets in
  '/dashboard/antenatal': 'dashboard:view', // nurses have no patients:view; routeRoles limits who gets in
  '/dashboard/templates': 'dashboard:view', // routeRoles: doctors and admins
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
  '/dashboard/insurers': 'billing:view_all', // Tiers payant: payers (admin edits)
  '/dashboard/claims': 'billing:view_all', // Bordereaux
  '/dashboard/receivables': 'billing:view_all', // Insurer receivables ageing
  '/dashboard/inventory': 'inventory:manage', // Admin, pharmacist only
  '/dashboard/purchasing': 'purchasing:manage', // Admin, pharmacist only
  '/dashboard/cash-desk': 'cash-desk:operate', // Admin, receptionist (own till)
  '/dashboard/cash-desk/supervision': 'cash-desk:supervise', // Admin only
  '/dashboard/statistics/settings': 'statistics:manage', // Admin only: facility identity, DHIS2 mapping
  '/dashboard/statistics': 'statistics:view', // Admin, doctors (read)
  '/dashboard/teleconsultations': 'teleconsultation:join', // Doctors, patients; admins see the list
  '/dashboard/reports': 'reports:view_all', // Admin only
  '/dashboard/users': 'users:view_all', // Admin only
  '/dashboard/audit': 'settings:manage_system', // Admin only
  '/dashboard/system-status': 'settings:manage_system', // Admin only
  '/dashboard/messages': 'settings:manage_system', // Admin only
  '/dashboard/notifications': 'notifications:view',
  '/dashboard/profile': 'dashboard:view', // All authenticated users can access their profile
  '/dashboard/price-list': 'pricing:view', // Admin edits; receptionist and doctors read
  '/dashboard/settings/clinical': 'settings:manage_system', // Admin only: clinical reference data
  '/dashboard/settings': 'settings:manage_system', // Admin only
};

// Routes that only make sense for specific roles (e.g. a doctor's own schedule)
export const routeRoles: Record<string, UserRole[]> = {
  '/dashboard/schedule': ['DOCTOR'],
  // Rosters: settings first — the first matching prefix wins
  '/dashboard/rosters/settings': ['ADMIN'],
  '/dashboard/rosters': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH'],
  '/dashboard/my-schedule': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH'],
  '/dashboard/leave': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH'],
  '/dashboard/on-call': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH'],
  '/dashboard/my-patients': ['DOCTOR'],
  '/dashboard/insurers': ['ADMIN', 'RECEPTIONIST'],
  '/dashboard/price-list': ['ADMIN', 'RECEPTIONIST', 'DOCTOR'],
  '/dashboard/queue': ['ADMIN', 'RECEPTIONIST', 'NURSE', 'DOCTOR'],
  '/dashboard/wards': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  '/dashboard/admissions': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST'],
  '/dashboard/mar-round': ['NURSE', 'ADMIN', 'DOCTOR'],
  '/dashboard/emergency': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  '/dashboard/vaccination': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  '/dashboard/antenatal': ['ADMIN', 'DOCTOR', 'NURSE'],
  '/dashboard/templates': ['ADMIN', 'DOCTOR'],
  '/dashboard/imaging/exams': ['ADMIN'],
  '/dashboard/imaging': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECH'],
  '/dashboard/documents': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  '/dashboard/referrals': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
  '/dashboard/family': ['PATIENT'],
  '/dashboard/feedback': ['ADMIN', 'RECEPTIONIST', 'DOCTOR'],
  '/dashboard/pharmacy/pos': ['ADMIN', 'PHARMACIST'],
  '/dashboard/pharmacy/prescriptions': ['ADMIN', 'PHARMACIST'],
  '/dashboard/pharmacy/sales': ['ADMIN', 'PHARMACIST'],
  '/dashboard/pharmacy/stock': ['ADMIN', 'PHARMACIST'],
  '/dashboard/pharmacy/sessions': ['ADMIN', 'PHARMACIST'],
  '/dashboard/purchasing': ['ADMIN', 'PHARMACIST'],
  // Supervision first — the first matching prefix wins
  '/dashboard/cash-desk/supervision': ['ADMIN'],
  '/dashboard/cash-desk': ['ADMIN', 'RECEPTIONIST'],
  // Settings first — the first matching prefix wins
  '/dashboard/statistics/settings': ['ADMIN'],
  '/dashboard/statistics': ['ADMIN', 'DOCTOR'],
  '/dashboard/teleconsultations': ['ADMIN', 'DOCTOR', 'PATIENT'],
  '/dashboard/claims': ['ADMIN', 'RECEPTIONIST'],
  '/dashboard/receivables': ['ADMIN', 'RECEPTIONIST'],
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

  // One patient's record (/dashboard/patients/<id>, not the list or /new): clinical staff who
  // see medical records open it too — doctors reach it from "Mes patients", the queue and stays.
  // The API still checks what each role may read or change.
  if (/^\/dashboard\/patients\/(?!new(\/|$))[^/]+$/.test(pathname) && hasPermission(userRole, 'patients:view_records')) {
    return true;
  }

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
