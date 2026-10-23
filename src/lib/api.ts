import { backendErrorsFr, backendErrorPatternsFr } from '@/locales/backend-errors';
import { extraTranslations } from '@/locales';
import { actingHeaders, readActingProfile, writeActingProfile, ACTING_CHANGE_EVENT } from '@/lib/patient-extras';

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use the browser's current hostname with the backend port
    // This ensures the app works on any machine IP without configuration
    const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || '3000';
    return `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
  }
  // Server-side (SSR): use Docker internal service name, or fallback
  return process.env.INTERNAL_API_URL || 'http://backend:3000';
}

const API_URL = getApiUrl();

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    isEmailVerified: boolean;
    phoneNumber?: string;
    profileImageUrl?: string;
    doctorId?: string;
    patientId?: string;
    mustChangePassword?: boolean;
    mfaEnabled?: boolean;
    mfaSetupRequired?: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

/** Password accepted, but the account has two-factor authentication: a code is needed */
interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

type ConsentType = 'DATA_PROCESSING' | 'SMS_REMINDERS' | 'DATA_SHARING';
type ConsentMethod = 'SIGNED_FORM' | 'VERBAL' | 'PORTAL';

interface ConsentStatus {
  currentVersion: string;
  current: Array<{ type: ConsentType; granted: boolean; version: string | null; method: ConsentMethod | null; decidedAt: string | null }>;
  history: Array<{
    id: string;
    type: ConsentType;
    granted: boolean;
    method: ConsentMethod;
    version: string;
    grantedAt: string;
    withdrawnAt: string | null;
    notes: string | null;
    recordedBy: string | null;
  }>;
}

interface ConsentTexts {
  version: string;
  required: ConsentType[];
  texts: Record<ConsentType, { fr: string; en: string }>;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  user: { id: string; name: string; role: string; email: string } | null;
  ipAddress: string | null;
  userAgent: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: string;
}

/** Admin system status. Every field is optional: the page renders whatever the server reports. */
interface SystemStatus {
  health?: {
    status?: 'ok' | 'degraded' | 'down' | string;
    checks?: {
      database?: { ok?: boolean; latencyMs?: number };
      disk?: { ok?: boolean; freeBytes?: number };
      lastBackup?: { ok?: boolean; ageHours?: number | null; file?: string | null };
    };
    version?: string;
    uptimeSec?: number;
  };
  lastRestoreDrill?: { ok?: boolean; at?: string; checkedTables?: number; mismatches?: number | string[] } | null;
  counts?: {
    users?: number;
    patients?: number;
    auditLast24h?: number;
    failedLoginsLast24h?: number;
    mfaEnrolled?: number;
    mfaRequired?: number;
  };
  recentErrors?: Array<{ time?: string; msg?: string; route?: string; requestId?: string }>;
}

/** /api/system-status as the backend sends it; mapped to SystemStatus by getSystemStatus() */
interface SystemStatusResponse {
  health?: SystemStatus['health'];
  restoreDrill?: SystemStatus['lastRestoreDrill'];
  counts?: { activeUsers?: number; patients?: number; auditEntries24h?: number; failedLogins24h?: number };
  mfa?: { enrolled?: number; required?: number };
  recentErrors?: Array<{ time?: string; msg?: string; route?: string; requestId?: string; error?: { message?: string } }>;
}

type MobileMoneyProvider = 'MTN_MOMO' | 'ORANGE_MONEY';
type MobileMoneyStatus = 'PENDING' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

interface MobileMoneyTransaction {
  id: string;
  invoiceId: string;
  provider: MobileMoneyProvider;
  gateway: string; // SANDBOX, MTN_MOMO, ORANGE_MONEY, NOTCHPAY…
  phoneNumber: string; // masked
  amount: number;
  currency: string;
  status: MobileMoneyStatus;
  externalId: string;
  providerRefId: string | null;
  failureReason: string | null;
  needsReview: boolean;
  paymentId: string | null;
  paymentUrl: string | null;
  isComplete: boolean;
  isSuccessful: boolean;
  initiatedAt: string;
  completedAt: string | null;
  expiresAt: string;
  invoice?: { status: string; paidAmount: number; balance: number };
  invoiceNumber?: string;
  operator?: unknown;
}

interface ReconciliationTotals {
  count: number;
  amount: number;
}

interface MobileMoneyReconciliation {
  date: string;
  mode: string;
  aggregator: string;
  transactions: Record<string, Record<string, ReconciliationTotals>>;
  credited: Record<string, ReconciliationTotals>;
  needsReview: MobileMoneyTransaction[];
  invalidWebhooks: Array<Record<string, unknown>>;
  unprocessedWebhooks: number;
}

type MessageChannel = 'SMS' | 'WHATSAPP' | 'EMAIL';
type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED';

interface OutboundMessage {
  id: string;
  channel: MessageChannel;
  to: string;
  subject: string | null;
  preview?: string;
  body?: string; // full text, or the email HTML (detail only)
  template: string;
  language: string;
  status: MessageStatus;
  provider: string;
  providerMessageId: string | null;
  error: string | null;
  attempts: number;
  patient?: { id: string; hospitalId: string; name: string } | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
  sentAt: string | null;
}

interface MessagesResponse {
  mode: string;
  providers: { sms?: string; email?: string; whatsapp?: string };
  messages: OutboundMessage[];
  counts: Partial<Record<MessageStatus, number>>;
  templates: string[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface AuditLogsResponse {
  logs: AuditLogEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phoneNumber: string;
  isActive: boolean;
  isEmailVerified: boolean;
  profileImageUrl?: string;
  doctorId?: string;  // For doctor users
  patientId?: string; // For patient users
  mustChangePassword?: boolean; // For force password change on first login
  mfaEnabled?: boolean; // Two-factor authentication active
  mfaSetupRequired?: boolean; // Admin/doctor who must enrol before using the system
}

// Patient types
interface Patient {
  id: string;
  patientId: string;
  /** The patient's portal account (when the server includes it) */
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string;
  bloodType: string;
  status: 'Active' | 'Inactive';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  allergies: string[];
  chronicConditions: string[];
  notes?: string;
  createdAt: string;
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
    validFrom: string;
    validUntil: string;
    coverageType: string;
  };
}

interface PatientAppointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: AppointmentType;
  status: AppointmentStatus;
  reason: string;
  confirmedAt?: string | null;
  confirmationChannel?: string | null;
  doctor: {
    id: string;
    name: string;
    department: string;
  } | null;
}

interface PatientPrescription {
  id: string;
  date: string;
  status: string;
  doctor: string | null;
  medications: {
    name: string;
    dosage: string;
    frequency: string;
  }[];
}

interface PatientLabResult {
  id: string;
  date: string;
  status: string;
  tests: {
    name: string;
    result: string;
    isAbnormal: boolean;
    /** Only RELEASED values are final; older servers don't send it */
    status?: LabResultStatus;
    flag?: string | null;
    unit?: string | null;
  }[];
}

interface PatientVital {
  date: string;
  bloodPressure: string | null;
  heartRate: number | null;
  temperature: number | null;
  weight: number | null;
  height: number | null;
}

interface PatientBilling {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  /** Left for the patient to pay (absent from older backends) */
  balance?: number;
}

interface VitalSign {
  id: string;
  patientId: string;
  patientName?: string;
  bloodPressure: string | null;
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate: number | null;
  temperature: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  recordedBy: string;
  recordedAt: string;
  notes: string | null;
}

interface VitalsResponse {
  vitals: VitalSign[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PatientDetail extends Patient {
  anonymizedAt?: string | null; // Set once the patient's identity has been erased
  dataProcessingConsent?: boolean | null; // Latest decision; null when never recorded
  appointments: PatientAppointment[];
  prescriptions: PatientPrescription[];
  labResults: PatientLabResult[];
  vitals: PatientVital[];
  billing: PatientBilling[];
}

interface PatientFilters {
  search?: string;
  status?: 'active' | 'inactive';
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  page?: number;
  limit?: number;
}

interface PatientsResponse {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    total: number;
    active: number;
    newThisMonth: number;
  };
}

// Doctor types
interface Doctor {
  id: string;
  doctorId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  profileImageUrl?: string;
  department: string;
  departmentId: string;
  specializations: string[];
  qualifications: string[];
  licenseNumber: string;
  consultationFee: number;
  bio?: string;
  languages: string[];
  isAvailable: boolean;
  rating: number;
  totalReviews: number;
  status: 'Active' | 'Inactive';
  createdAt: string;
  schedule: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDuration: number;
    isActive: boolean;
  }[];
}

interface DoctorFilters {
  search?: string;
  department?: string;
  specialization?: string;
  available?: boolean;
  page?: number;
  limit?: number;
}

interface DoctorsResponse {
  data: Doctor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    total: number;
    available: number;
    departments: number;
    todayAppointments: number;
  };
  departments: { id: string; name: string }[];
  specializations: string[];
}

// Doctor Availability types
interface TimeSlot {
  time: string;
  endTime: string;
  available: boolean;
}

interface DoctorAvailability {
  doctorId: string;
  date: string;
  dayOfWeek: number;
  isWorkingDay: boolean;
  workingHours: {
    start: string;
    end: string;
  } | null;
  slotDuration: number;
  slots: TimeSlot[];
  bookedSlots: string[];
  doctor: {
    id: string;
    name: string;
    department: string | null;
    consultationFee: number;
  };
}

// Appointment types
type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
type AppointmentType = 'IN_PERSON' | 'VIDEO' | 'PHONE';

interface Appointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  type: AppointmentType;
  status: AppointmentStatus;
  reason: string;
  notes?: string;
  queueNumber?: number;
  rescheduleCount: number;
  checkedInAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  /** Set when the patient (SMS reply, link, portal) or the desk confirmed the appointment */
  confirmedAt?: string | null;
  confirmationChannel?: string | null;
  createdAt: string;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    profileImageUrl?: string;
    gender?: string;
    dateOfBirth?: string;
    bloodType?: string;
    allergies?: string[];
  };
  doctor: {
    id: string;
    doctorId: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    profileImageUrl?: string;
    department: string;
    departmentId: string;
  };
}

interface AppointmentFilters {
  search?: string;
  status?: AppointmentStatus;
  type?: AppointmentType;
  doctorId?: string;
  patientId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

interface AppointmentsResponse {
  data: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalToday: number;
    scheduledToday: number;
    completedToday: number;
    cancelledToday: number;
    totalThisWeek: number;
    upcomingCount: number;
  };
}

// Dashboard types
interface DashboardStats {
  patients: {
    total: number;
    active: number;
    newThisMonth: number;
    growth: number;
  };
  doctors: {
    total: number;
    available: number;
    departments: number;
  };
  appointments: {
    today: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    inProgress: number;
    thisWeek: number;
    upcoming: number;
    weeklyGrowth: number;
  };
}

interface DashboardAppointment {
  id: string;
  time: string;
  endTime: string;
  status: AppointmentStatus;
  type: AppointmentType;
  reason: string;
  patient: {
    id: string;
    name: string;
    profileImageUrl?: string;
  };
  doctor: {
    id: string;
    name: string;
    department: string;
    profileImageUrl?: string;
  };
}

interface DashboardPatient {
  id: string;
  patientId: string;
  name: string;
  email: string;
  profileImageUrl?: string;
  createdAt: string;
}

interface DashboardDepartment {
  id: string;
  name: string;
  totalDoctors: number;
  availableDoctors: number;
  appointmentsToday: number;
}

interface DashboardData {
  stats: DashboardStats;
  todayAppointments: DashboardAppointment[];
  recentPatients: DashboardPatient[];
  departmentStats: DashboardDepartment[];
}

// Department types
interface Department {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  doctorCount: number;
  nurseCount: number;
  staffCount: number;
  totalStaff: number;
  createdAt: string;
  updatedAt: string;
}

interface DepartmentDetail extends Department {
  doctors: Array<{
    id: string;
    doctorId: string;
    firstName: string;
    lastName: string;
    email: string;
    specializations: string[];
    isAvailable: boolean;
  }>;
  nurses: Array<{
    id: string;
    nurseId: string;
    firstName: string;
    lastName: string;
    email: string;
    specialization?: string;
  }>;
  staff: Array<{
    id: string;
    staffId: string;
    firstName: string;
    lastName: string;
    position: string;
  }>;
  stats: {
    totalDoctors: number;
    activeDoctors: number;
    totalNurses: number;
    activeNurses: number;
    totalStaff: number;
    activeStaff: number;
  };
}

interface DepartmentsResponse {
  departments: Department[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Medication types
interface Medication {
  id: string;
  name: string;
  genericName: string;
  category: string;
  dosageForm: string;
  strength: string;
  manufacturer: string;
  unitPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  expiryDate?: string;
  isActive: boolean;
  requiresRx: boolean;
  contraindications: string[];
  sideEffects: string[];
  isLowStock: boolean;
  isExpiringSoon: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MedicationsResponse {
  medications: Medication[];
  categories: string[];
  stats: {
    totalMedications: number;
    totalStock: number;
    lowStockCount: number;
    expiringCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Lab Test types
interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  sampleType: string;
  normalRange?: string;
  unit?: string;
  processingTime: number;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Structured results (lab workflow); absent on older servers
  resultType?: LabResultType;
  options?: string[];
  container?: string | null;
  refLow?: number | string | null;
  refHigh?: number | string | null;
  criticalLow?: number | string | null;
  criticalHigh?: number | string | null;
  decimals?: number;
  referenceRanges?: LabReferenceRange[];
}

type LabResultType = 'NUMERIC' | 'TEXT' | 'OPTION';
type LabResultStatus = 'PENDING' | 'ENTERED' | 'VALIDATED' | 'RELEASED';

interface LabReferenceRange {
  id?: string;
  sex?: 'MALE' | 'FEMALE' | null;
  ageMinYears?: number | null;
  ageMaxYears?: number | null;
  low?: number | string | null;
  high?: number | string | null;
  criticalLow?: number | string | null;
  criticalHigh?: number | string | null;
  label?: string | null;
}

interface LabTestsResponse {
  labTests: LabTest[];
  categories: string[];
  sampleTypes: string[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Lab Order types
type LabOrderStatus = 'ORDERED' | 'SAMPLE_COLLECTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

interface LabOrder {
  id: string;
  patientId: string;
  patientHospitalId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  status: LabOrderStatus;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  notes?: string;
  testCount: number;
  tests: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    result?: string;
    isAbnormal?: boolean;
    status?: LabResultStatus;
    flag?: string | null;
    isCritical?: boolean;
    unit?: string | null;
  }>;
  number?: string | null;
  collectedAt?: string;
  completedAt?: string;
  releasedAt?: string | null;
  createdAt: string;
}

type LabSampleStatus = 'COLLECTED' | 'RECEIVED' | 'REJECTED';

interface LabSample {
  id: string;
  barcode: string;
  container: string;
  sampleType: string;
  status: LabSampleStatus;
  collectedAt: string;
  collectedByName?: string | null;
  receivedAt?: string | null;
  receivedByName?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  rejectionNote?: string | null;
}

/** GET /api/lab-orders/:id (the detail is richer than the list item) */
interface LabOrderDetail {
  id: string;
  number?: string | null;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  doctor: { id: string; firstName: string; lastName: string; department?: string };
  consultation?: { id: string; chiefComplaint?: string; diagnosis?: string[] | string } | null;
  admissionId?: string | null;
  clinicalInfo?: string | null;
  status: LabOrderStatus;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  notes?: string | null;
  collectedAt?: string | null;
  collectedBy?: string | null;
  completedAt?: string | null;
  releasedAt?: string | null;
  createdAt: string;
  invoice?: { id: string; invoiceNumber: string; status: string } | null;
  invoiceId?: string | null;
  chargedToStay?: boolean;
  samples?: LabSample[];
  items: LabOrderDetailItem[];
  totalPrice: number;
}

interface LabOrderDetailItem {
  id: string;
  labTest: LabTest;
  result?: string | null;
  unit?: string | null;
  normalRange?: string | null;
  isAbnormal?: boolean | null;
  notes?: string | null;
  status?: LabResultStatus;
  sampleId?: string | null;
  numericValue?: number | string | null;
  flag?: string | null;
  isCritical?: boolean;
  refLow?: number | string | null;
  refHigh?: number | string | null;
  enteredAt?: string | null;
  enteredByName?: string | null;
  validatedAt?: string | null;
  validatedByName?: string | null;
  criticalCalledAt?: string | null;
  criticalCalledTo?: string | null;
  rerunCount?: number;
}

interface LabWorklistOrder {
  id: string;
  number?: string | null;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  status: LabOrderStatus;
  patient: { name: string; patientId: string; sex?: string | null; age?: number | null };
  doctorName: string;
  createdAt: string;
  collectedAt?: string | null;
  samples: Array<{ barcode: string; container: string; status: LabSampleStatus }>;
  counts: { pending: number; entered: number; validated: number; released: number };
  hasCritical: boolean;
  toCollect?: number | null;
}

interface LabWorklist {
  orders: LabWorklistOrder[];
  counts?: Partial<Record<'toCollect' | 'toReceive' | 'toEnter' | 'toValidate' | 'released', number>>;
}

interface LabStats {
  received: number;
  released: number;
  rejected: number;
  avgTurnaroundHours: number | null;
  criticalToday: number;
  pendingValidation: number;
}

interface LabSampleLookup {
  sample: LabSample;
  order: { id: string; number?: string | null; priority: string; status: LabOrderStatus; patient?: { name?: string; firstName?: string; lastName?: string; patientId?: string } ; patientName?: string };
  items: Array<{ id: string; labTest?: { code: string; name: string }; name?: string; code?: string; status?: LabResultStatus }>;
}

interface LabHistoryEntry {
  date: string;
  value: string;
  flag?: string | null;
}

interface LabOrdersResponse {
  labOrders: LabOrder[];
  statusCounts: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Invoice types
type InvoiceStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'INSURANCE' | 'MOBILE_WALLET' | 'MTN_MOMO' | 'ORANGE_MONEY';

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientHospitalId: string;
  patientName: string;
  patientEmail: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  balance: number;
  itemCount: number;
  paymentCount: number;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Tiers payant split (absent on servers that predate insurer billing)
  payerId?: string | null;
  payer?: { id: string; name: string; code: string } | null;
  coverage?: { id: string; memberNumber: string } | null;
  preAuth?: { id: string; number: string } | null;
  claim?: { id: string; number: string; status: ClaimStatus } | null;
  insurerShare?: number;
  patientShare?: number;
  insurerPaid?: number;
  patientPaid?: number;
  patientBalance?: number;
  insurerBalance?: number;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
  coveredAmount?: number;
  patientAmount?: number;
}

interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  processedBy: string;
  processedAt: string;
  /** Who paid: the patient (desk, mobile money) or the insurer (claim settlement) */
  source?: 'PATIENT' | 'INSURER';
  claimId?: string | null;
}

interface PaymentWithDetails extends Payment {
  invoiceId: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
}

interface PaymentStats {
  summary: {
    totalPayments: number;
    totalAmount: number;
    todayPayments: number;
    todayAmount: number;
    weekPayments: number;
    weekAmount: number;
    monthPayments: number;
    monthAmount: number;
    averagePayment: number;
  };
  paymentsByMethod: Array<{
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  dailyTrend: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    method: string;
    referenceNumber?: string;
    processedBy: string;
    processedAt: string;
    invoiceNumber: string;
    patientName: string;
  }>;
  topPatients: Array<{
    id: string;
    name: string;
    amount: number;
    count: number;
  }>;
}

interface PaymentsResponse {
  payments: PaymentWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface InvoiceDetail extends Invoice {
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    insurance?: {
      provider: string;
      policyNumber: string;
      coverageType: string;
    };
  };
  items: InvoiceItem[];
  payments: Payment[];
}

interface InvoicesResponse {
  invoices: Invoice[];
  statusCounts: Record<string, { count: number; total: number }>;
  totals: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Prescription types
type PrescriptionStatus = 'ACTIVE' | 'DISPENSED' | 'PARTIALLY_DISPENSED' | 'CANCELLED' | 'EXPIRED';

interface Prescription {
  id: string;
  patientId: string;
  patientHospitalId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  status: PrescriptionStatus;
  notes?: string;
  itemCount: number;
  items: Array<{
    id: string;
    medication: string;
    genericName: string;
    dosageForm: string;
    strength: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions?: string;
    isDispensed: boolean;
  }>;
  dispensedAt?: string;
  dispensedBy?: string;
  createdAt: string;
}

interface PrescriptionDetail {
  id: string;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    gender: string;
    allergies: string[];
  };
  doctor: {
    id: string;
    doctorId: string;
    firstName: string;
    lastName: string;
    department: string;
    specializations: string[];
  };
  consultation: {
    id: string;
    chiefComplaint: string;
    diagnosis: string[];
  } | null;
  status: PrescriptionStatus;
  notes: string | null;
  dispensedAt: string | null;
  dispensedBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    medication: {
      id: string;
      name: string;
      genericName: string;
      category: string;
      dosageForm: string;
      strength: string;
      unitPrice: number;
      stockQuantity: number;
      requiresRx: boolean;
      contraindications: string[];
      sideEffects: string[];
    };
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions: string | null;
    isDispensed: boolean;
    itemTotal: number;
  }>;
  totalCost: number;
  dispensedItemCount: number;
  pendingItemCount: number;
}

interface PrescriptionsResponse {
  prescriptions: Prescription[];
  statusCounts: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User management types
interface UserDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  profileImageUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
  hospitalId?: string;
  department?: string;
  position?: string;
}

interface UsersResponse {
  users: UserDetail[];
  roleCounts: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Report types
interface ReportData {
  type: string;
  period: { startDate: string; endDate: string };
  [key: string]: unknown;
}

// Consultation types
interface Consultation {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientHospitalId: string;
  doctorId: string;
  doctorName: string;
  department: string;
  appointmentDate: string;
  appointmentType: AppointmentType;
  chiefComplaint: string;
  symptoms: string[];
  examination?: string;
  diagnosis: string[];
  diagnosisCodes: string[];
  treatmentPlan?: string;
  notes?: string;
  followUpDate?: string;
  prescriptionCount: number;
  labOrderCount: number;
  createdAt: string;
}

interface ConsultationDetail extends Consultation {
  examination?: string;
  notes?: string;
  patient: {
    id: string;
    hospitalId: string;
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    bloodType?: string;
    allergies: string[];
    chronicConditions: string[];
    vitals: Array<{
      id: string;
      bloodPressure?: string;
      heartRate?: number;
      temperature?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
      weight?: number;
      height?: number;
      recordedAt: string;
    }>;
    medicalHistory: Array<{
      id: string;
      condition: string;
      diagnosedAt?: string;
      status: string;
      notes?: string;
    }>;
  };
  doctor: {
    id: string;
    hospitalId: string;
    name: string;
    department: string;
    specializations: string[];
  };
  prescriptions: Array<{
    id: string;
    status: string;
    items: Array<{
      medication: string;
      genericName: string;
      strength: string;
      dosage: string;
      frequency: string;
      duration: string;
      quantity: number;
      instructions?: string;
      isDispensed: boolean;
    }>;
    createdAt: string;
  }>;
  labOrders: Array<{
    id: string;
    status: string;
    priority: string;
    tests: Array<{
      name: string;
      code: string;
      result?: string;
      isAbnormal?: boolean;
    }>;
    createdAt: string;
  }>;
}

interface ConsultationsResponse {
  consultations: Consultation[];
  stats: {
    total: number;
    today: number;
    thisWeek: number;
    uniqueDoctors: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Inventory types
interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  reorderLevel: number;
  location?: string;
  supplier?: {
    id: string;
    name: string;
  };
  expiryDate?: string;
  isLowStock: boolean;
  isExpiringSoon: boolean;
  totalValue: number;
}

interface InventoryItemDetail extends InventoryItem {
  isActive: boolean;
  transactions: Array<{
    id: string;
    type: 'IN' | 'OUT' | 'ADJUSTMENT';
    quantity: number;
    reason?: string;
    referenceId?: string;
    performedBy: string;
    performedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface InventoryResponse {
  items: InventoryItem[];
  categories: string[];
  stats: {
    totalItems: number;
    totalStock: number;
    totalValue: number;
    lowStockCount: number;
    expiringCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Supplier types
interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone: string;
  address?: string;
  isActive: boolean;
  itemCount: number;
  orderCount: number;
  createdAt: string;
}

interface SupplierDetail extends Supplier {
  inventoryItems: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    reorderLevel: number;
    isLowStock: boolean;
  }>;
  purchaseOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  updatedAt: string;
}

interface SuppliersResponse {
  suppliers: Supplier[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Notification types
type NotificationType = 'appointment' | 'lab_result' | 'payment' | 'prescription' | 'system' | 'promotion';
type NotificationTargetRole = 'ALL' | 'PATIENT' | 'DOCTOR' | 'NURSE' | 'ADMIN' | 'STAFF';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

interface NotificationFilters {
  page?: number;
  limit?: number;
  type?: NotificationType;
  unread?: boolean;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreateNotificationInput {
  userId?: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  targetRole?: NotificationTargetRole;
}

// The backend answers in English; show its messages in French when the UI is in French
export function localizeServerMessage(message: string): string {
  if (typeof window === 'undefined' || localStorage.getItem('language') === 'en') return message;
  if (backendErrorsFr[message]) return backendErrorsFr[message];
  const tEnum = (value: string) => extraTranslations.fr[`enum.${value}`] || value;
  for (const [pattern, translate] of backendErrorPatternsFr) {
    const match = message.match(pattern);
    if (match) return translate(match, tEnum);
  }
  const prefix = 'Validation failed: ';
  if (message.startsWith(prefix)) {
    const details = message
      .slice(prefix.length)
      .split(', ')
      .map((part) => backendErrorsFr[part] || part)
      .join(', ');
    return `${backendErrorsFr['Validation failed'] || 'Validation échouée'} : ${details}`;
  }
  return message;
}

/** Error carrying the HTTP status; status 0 means the server could not be reached */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- Insurer billing (tiers payant) ----
type PayerType = 'PRIVATE_INSURER' | 'CSU' | 'MUTUAL' | 'EMPLOYER';
type BillingCategory = 'consultation' | 'medication' | 'lab' | 'procedure' | 'other';
type CoverageRelationship = 'SELF' | 'SPOUSE' | 'CHILD' | 'OTHER';
type PreAuthStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'USED' | 'CANCELLED';
type ClaimStatus = 'DRAFT' | 'SUBMITTED' | 'PARTIALLY_PAID' | 'PAID' | 'CLOSED';
type ClaimLineStatus = 'PENDING' | 'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'REJECTED' | 'PAID';

interface PayerCoverageRule {
  id?: string;
  category: BillingCategory;
  coveragePercent: number;
  excluded: boolean;
  maxAmountPerItem: number | null;
}

interface Payer {
  id: string;
  name: string;
  code: string;
  type: PayerType;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  defaultCoveragePercent: number;
  requiresPreAuth: boolean;
  preAuthThreshold: number | null;
  paymentTermsDays: number;
  isActive: boolean;
  notes?: string | null;
  coverageRules: PayerCoverageRule[];
  counts?: { coverages: number; openClaims: number };
  createdAt: string;
  updatedAt: string;
}

interface PayerInput {
  name: string;
  code: string;
  type: PayerType;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  defaultCoveragePercent: number;
  requiresPreAuth: boolean;
  preAuthThreshold: number | null;
  paymentTermsDays: number;
  notes?: string;
  isActive?: boolean;
  coverageRules: Array<Omit<PayerCoverageRule, 'id'>>;
}

interface PatientCoverage {
  id: string;
  patientId: string;
  payerId: string;
  payer: { id: string; name: string; code: string; type: PayerType; defaultCoveragePercent: number; requiresPreAuth: boolean; preAuthThreshold: number | null };
  memberNumber: string;
  policyNumber?: string | null;
  holderName?: string | null;
  relationship: CoverageRelationship;
  coveragePercent: number | null;
  effectivePercent: number;
  validFrom: string;
  validUntil: string | null;
  isPrimary: boolean;
  isActive: boolean;
  isValidToday: boolean;
  notes?: string | null;
}

interface PatientCoverageInput {
  payerId: string;
  memberNumber: string;
  policyNumber?: string;
  holderName?: string;
  relationship?: CoverageRelationship;
  coveragePercent?: number | null;
  validFrom: string;
  validUntil?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
  notes?: string;
}

interface PreAuthorization {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  patientHospitalId: string;
  coverageId: string;
  payerId: string;
  payer: { id: string; name: string; code: string };
  memberNumber: string;
  payerReference?: string | null;
  status: PreAuthStatus;
  services: string;
  requestedAmount: number;
  approvedAmount: number | null;
  requestedAt: string;
  decidedAt: string | null;
  validUntil: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  invoices: Array<{ id: string; invoiceNumber: string }>;
}

type PreAuthAction =
  | { action: 'approve'; approvedAmount: number; payerReference?: string; validUntil?: string }
  | { action: 'reject'; rejectionReason: string }
  | { action: 'cancel' };

interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  category: string;
}

interface CoveragePreview {
  coverage: PatientCoverage | null;
  lines: Array<{ index: number; total: number; coveredAmount: number; patientAmount: number; percent: number; excluded: boolean }>;
  subtotal: number;
  total: number;
  insurerShare: number;
  patientShare: number;
  preAuthRequired: boolean;
  /** Why a prise en charge is needed: the payer always asks, or the total is above its threshold */
  preAuthReason?: 'ALWAYS' | 'ABOVE_THRESHOLD';
  eligiblePreAuths: PreAuthorization[];
}

interface ClaimSummary {
  id: string;
  number: string;
  payer: { id: string; name: string; code: string };
  periodStart: string;
  periodEnd: string;
  status: ClaimStatus;
  lineCount: number;
  totalClaimed: number;
  totalApproved: number | null;
  totalPaid: number;
  outstanding: number;
  submittedAt: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  createdAt: string;
}

interface ClaimLine {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  patientName: string;
  patientHospitalId: string;
  memberNumber: string | null;
  preAuthNumber: string | null;
  amountClaimed: number;
  amountApproved: number | null;
  amountPaid: number;
  insurerBalance?: number;
  status: ClaimLineStatus;
  rejectionReason: string | null;
}

interface ClaimDetail extends Omit<ClaimSummary, 'payer'> {
  notes?: string | null;
  closedAt?: string | null;
  payer: Payer;
  lines: ClaimLine[];
  payments: Array<{ id: string; invoiceId?: string; amount: number; method: PaymentMethod; referenceNumber?: string | null; processedAt: string; processedBy: string }>;
}

interface EligibleClaimInvoice {
  id: string;
  invoiceNumber: string;
  patientName: string;
  patientHospitalId: string;
  memberNumber: string | null;
  createdAt: string;
  total: number;
  insurerShare: number;
  insurerPaid: number;
  insurerBalance: number;
  preAuthNumber: string | null;
}

type ClaimAction =
  | { action: 'submit' }
  | { action: 'remove-line'; lineId: string }
  | { action: 'add-invoices'; invoiceIds: string[] }
  | { action: 'close' }
  | { action: 'transfer-rejected'; lineId: string }
  | { notes: string };

interface ClaimSettlementInput {
  paidAt?: string;
  method?: 'BANK_TRANSFER' | 'CASH' | 'CARD' | 'MOBILE_WALLET';
  referenceNumber?: string;
  notes?: string;
  lines: Array<{ lineId: string; amountApproved: number; amountPaid: number; rejectionReason?: string }>;
}

interface AgeingBuckets {
  outstanding: number;
  current: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
  unbilled: number;
}

interface Receivables {
  asOf: string;
  totals: AgeingBuckets;
  payers: Array<AgeingBuckets & { payerId: string; name: string; code: string; openClaims: number; oldestClaimDate: string | null }>;
  patient: { outstanding: number; invoiceCount: number };
}

// Queue & triage
type VisitSource = 'APPOINTMENT' | 'WALK_IN' | 'EMERGENCY';
type QueueTicketStatus = 'WAITING_TRIAGE' | 'WAITING' | 'CALLED' | 'IN_SERVICE' | 'DONE' | 'NO_SHOW' | 'CANCELLED';
type TriageLevel = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
type TriageMobility = 'WALKING' | 'WITH_HELP' | 'STRETCHER';
type TriageAvpu = 'ALERT' | 'CONFUSED' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';

interface TriageSummary {
  id: string;
  level: TriageLevel;
  suggestedLevel: TriageLevel;
  tewsScore: number | null;
  chiefComplaint: string;
  discriminators: string[];
  overrideReason: string | null;
  assessedByName?: string | null;
  createdAt: string;
  mobility?: TriageMobility;
  avpu?: TriageAvpu;
  trauma?: boolean;
  notes?: string | null;
}

interface QueueTicket {
  id: string;
  number: string;
  sequence: number;
  serviceDate: string;
  status: QueueTicketStatus;
  source: VisitSource;
  needsTriage: boolean;
  triageLevel: TriageLevel | null;
  priority: number;
  department: { id: string; name: string };
  doctor: { id: string; name: string } | null;
  room: string | null;
  callCount: number;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    gender?: string;
    age?: number | null;
    phoneMasked?: string | null;
    allergies: string[];
  };
  appointment: { id: string; startTime: string; reason: string } | null;
  arrivedAt: string;
  triagedAt: string | null;
  calledAt: string | null;
  serviceStartedAt: string | null;
  completedAt: string | null;
  waitMinutes: number;
  targetMinutes: number | null;
  overdue: boolean;
  position: number | null;
  latestTriage: TriageSummary | null;
  notes: string | null;
  cancelReason?: string | null;
  triages?: TriageSummary[];
}

type QueueStatusCounts = Record<QueueTicketStatus, number>;
type QueueLevelCounts = Record<TriageLevel | 'UNTRIAGED', number>;

interface QueueList {
  date: string;
  tickets: QueueTicket[];
  counts: QueueStatusCounts;
  byLevel: QueueLevelCounts;
}

interface QueueStats {
  date: string;
  waitingNow: number;
  longestWaitMinutes: number | null;
  avgWaitToTriageMinutes: number | null;
  avgWaitToServiceMinutes: number | null;
  avgServiceMinutes: number | null;
  served: number;
  noShows: number;
  overdueNow: number;
  byLevel: Record<TriageLevel, { count: number; avgWaitMinutes: number | null; withinTargetPct: number | null }>;
  perHour: Array<{ hour: number; arrivals: number }>;
}

interface CreateQueueTicketInput {
  patientId: string;
  departmentId?: string;
  doctorId?: string;
  appointmentId?: string;
  source?: 'WALK_IN' | 'EMERGENCY';
  needsTriage?: boolean;
  notes?: string;
}

type QueueTicketAction =
  | { action: 'call'; room: string }
  | { action: 'recall'; room?: string }
  | { action: 'start' }
  | { action: 'complete' }
  | { action: 'no-show' }
  | { action: 'cancel'; reason: string }
  | { action: 'requeue' }
  | { action: 'transfer'; departmentId?: string; doctorId?: string | null; reason?: string };

interface TriageVitalsInput {
  respiratoryRate?: number;
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
  temperature?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
}

interface TriageInput {
  chiefComplaint: string;
  mobility: TriageMobility;
  avpu: TriageAvpu;
  trauma: boolean;
  vitals: TriageVitalsInput;
  discriminators: string[];
}

interface TriageScore {
  tewsScore: number | null;
  suggestedLevel: TriageLevel;
  reasons: string[];
  missing: string[];
}

interface QueueDisplayData {
  departmentName: string | null;
  now: string;
  called: Array<{ number: string; room: string | null; calledAt: string; departmentName?: string | null }>;
  waitingCount: number;
  nextNumbers: string[];
  averageWaitMinutes: number | null;
}

interface MyQueueTicket {
  number: string;
  status: QueueTicketStatus;
  department: { id: string; name: string } | string;
  room: string | null;
  position: number | null;
  estimatedWaitMinutes: number | null;
  calledAt: string | null;
}

// ---- Inpatient care (hospitalisation) ----
type WardType = 'GENERAL' | 'SURGICAL' | 'MATERNITY' | 'PAEDIATRIC' | 'ICU' | 'ISOLATION';
type WardGender = 'ANY' | 'MALE' | 'FEMALE';
type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'RESERVED';
type AdmissionSource = 'EMERGENCY' | 'OUTPATIENT' | 'REFERRAL' | 'ELECTIVE' | 'BIRTH';
type AdmissionStatus = 'ADMITTED' | 'DISCHARGED' | 'CANCELLED';
type DischargeType = 'HOME' | 'TRANSFER' | 'AGAINST_ADVICE' | 'DECEASED';
type ProgressNoteType = 'DOCTOR_ROUND' | 'NURSING' | 'HANDOVER';
type MedicationOrderStatus = 'ACTIVE' | 'STOPPED' | 'COMPLETED';
type AdministrationStatus = 'GIVEN' | 'REFUSED' | 'HELD' | 'MISSED';
/** A scheduled dose on the medication administration record: recorded, or due/overdue/upcoming */
type DoseStatus = 'DUE' | 'OVERDUE' | 'UPCOMING' | AdministrationStatus;
type ChargeCategory = 'BED' | 'PROCEDURE' | 'MEDICATION' | 'LAB' | 'CONSUMABLE' | 'OTHER';
type MedicationRoute = 'PO' | 'IV' | 'IM' | 'SC' | 'INH' | 'TOP' | 'PR' | 'SL' | 'OTHER';

interface BedOccupant {
  admissionId: string;
  number: string;
  patientName: string;
  patientHospitalId: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  age: number | null;
  admittedAt: string;
  days: number;
  attendingDoctorName: string;
}

interface WardBed {
  id: string;
  label: string;
  status: BedStatus;
  dailyRate: number | null;
  isActive: boolean;
  notes: string | null;
  occupant: BedOccupant | null;
}

interface WardCounts {
  total: number;
  available: number;
  occupied: number;
  cleaning: number;
  maintenance: number;
  reserved: number;
}

interface Ward {
  id: string;
  name: string;
  code: string;
  type: WardType;
  gender: WardGender;
  department: { id: string; name: string } | null;
  floor: string | null;
  dailyRate: number;
  isActive: boolean;
  notes: string | null;
  beds: WardBed[];
  counts: WardCounts;
  occupancyPct: number;
}

interface WardBoard {
  wards: Ward[];
  totals: { beds: number; available: number; occupied: number; occupancyPct: number };
}

interface WardInput {
  name: string;
  code: string;
  type: WardType;
  gender?: WardGender;
  departmentId?: string | null;
  floor?: string | null;
  dailyRate: number;
  notes?: string | null;
  beds?: string[];
}

interface InpatientVitals {
  bloodPressureSys?: number | null;
  bloodPressureDia?: number | null;
  heartRate?: number | null;
  temperature?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  weight?: number | null;
  recordedAt?: string;
}

interface AdmissionSummary {
  id: string;
  number: string;
  status: AdmissionStatus;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    age: number | null;
    allergies: string[];
  };
  ward: { id: string; name: string; code: string };
  bed: { id: string; label: string } | null;
  attendingDoctor: { id: string; name: string };
  source: AdmissionSource;
  reason: string;
  admittedAt: string;
  days: number;
  dischargedAt: string | null;
  dischargeType: DischargeType | null;
  dueMedications: number;
}

interface BedAssignmentEntry {
  bed: { label: string; ward: { id?: string; name: string; code?: string } | string };
  startAt: string;
  endAt: string | null;
  reason: string | null;
  movedByName: string | null;
}

interface AdmissionDetail extends AdmissionSummary {
  provisionalDiagnosis: string | null;
  expectedDischargeAt: string | null;
  queueTicket: { id: string; number: string } | null;
  assignments: BedAssignmentEntry[];
  finalDiagnosis: string | null;
  diagnosisCodes: string[];
  hospitalCourse: string | null;
  dischargeMedications: string | null;
  dischargeInstructions: string | null;
  followUpDate: string | null;
  transferDestination: string | null;
  dischargedByName: string | null;
  invoice: { id: string; invoiceNumber: string; status: InvoiceStatus; total: number } | null;
  cancelReason: string | null;
  latestVitals: InpatientVitals | null;
  /** Set on discharge/invoice when the payer needed a prise en charge and none was approved: billed uninsured */
  coverageWarning?: 'PRE_AUTH_REQUIRED' | null;
}

interface AdmissionsResponse {
  admissions: AdmissionSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface CreateAdmissionInput {
  patientId: string;
  bedId: string;
  attendingDoctorId?: string;
  source: AdmissionSource;
  reason: string;
  provisionalDiagnosis?: string;
  expectedDischargeAt?: string;
  queueTicketId?: string;
}

interface DischargeInput {
  dischargeType: DischargeType;
  finalDiagnosis: string;
  diagnosisCodes?: string[];
  hospitalCourse: string;
  dischargeMedications?: string;
  dischargeInstructions?: string;
  followUpDate?: string;
  transferDestination?: string;
  dischargedAt?: string;
}

interface ProgressNote {
  id: string;
  type: ProgressNoteType;
  note: string;
  author: { id: string; name: string; role: string };
  vitals: InpatientVitals | null;
  createdAt: string;
}

interface MedicationOrder {
  id: string;
  medication: { id: string; name: string; strength: string } | null;
  drugName: string;
  dose: string;
  route: MedicationRoute | string;
  times: string[];
  asNeeded: boolean;
  startAt: string;
  endAt: string | null;
  instructions: string | null;
  status: MedicationOrderStatus;
  prescribedByName: string | null;
  stoppedByName: string | null;
  stoppedAt: string | null;
  stopReason: string | null;
  lastGiven: { at: string; status: AdministrationStatus; byName: string } | null;
  allergyWarning: string | null;
}

interface CreateMedicationOrderInput {
  medicationId?: string;
  drugName?: string;
  dose: string;
  route: MedicationRoute;
  times?: string[];
  asNeeded?: boolean;
  startAt?: string;
  endAt?: string;
  instructions?: string;
  overrideAllergy?: boolean;
  allergyOverrideReason?: string;
}

interface MarAdministration {
  id: string;
  recordedAt: string;
  status: AdministrationStatus;
  doseGiven: string | null;
  reason: string | null;
  givenByName: string | null;
}

interface MarDose {
  scheduledAt: string;
  time: string;
  status: DoseStatus;
  administration: MarAdministration | null;
}

interface MarDay {
  date: string;
  rows: Array<{ order: MedicationOrder; doses: MarDose[] }>;
  prn: Array<{ order: MedicationOrder; administrations: MarAdministration[] }>;
}

interface RecordAdministrationInput {
  orderId: string;
  scheduledAt: string | null;
  status: AdministrationStatus;
  doseGiven?: string;
  reason?: string;
}

interface WardMarItem {
  admissionId: string;
  number: string;
  patientName: string;
  bedLabel: string | null;
  orderId: string;
  drugName: string;
  dose: string;
  route: string;
  scheduledAt: string;
  time: string;
  status: DoseStatus;
}

interface WardMar {
  now: string;
  items: WardMarItem[];
}

interface AdmissionCharge {
  id: string;
  category: ChargeCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  chargedAt: string;
  addedByName: string | null;
  invoiced: boolean;
}

interface AdmissionBillLine {
  category: ChargeCategory | string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  source: 'BED' | 'CHARGE';
  chargeId?: string;
}

interface AdmissionBill {
  lines: AdmissionBillLine[];
  subtotal: number;
  /** Coverage split, flat or nested depending on the server: read it with billSplit() */
  insurerShare?: number;
  patientShare?: number;
  coverage?: PatientCoverage | null;
  preview?: Partial<CoveragePreview> | null;
  invoiced: boolean;
}

interface MyAdmissions {
  current: AdmissionSummary | null;
  past: AdmissionSummary[];
}

// ---- Pharmacy counter (vente au comptoir), stock by batch, till sessions ----
type SalePaymentMethod = 'CASH' | 'CARD' | 'MTN_MOMO' | 'ORANGE_MONEY';
type PharmacySaleStatus = 'COMPLETED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'VOIDED';
type StockMovementType = 'RECEIPT' | 'SALE' | 'RETURN' | 'DISPENSE' | 'ADJUSTMENT' | 'BREAKAGE' | 'EXPIRED';
type StockAdjustmentType = 'ADJUSTMENT' | 'BREAKAGE' | 'EXPIRED';
type CashSessionStatus = 'OPEN' | 'CLOSED';
type MethodTotals = Record<SalePaymentMethod, number>;

interface StockBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  costPrice: number | null;
  daysToExpiry: number;
  isExpired: boolean;
}

interface StockMedication {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  category: string;
  unitPrice: number;
  requiresRx: boolean;
  stockQuantity: number;
  sellableQuantity: number;
  reorderLevel: number;
  isLow: boolean;
  nearestExpiry: string | null;
  hasExpiredStock?: boolean;
  batches: StockBatch[];
}

interface StockReceiptInput {
  supplierId?: string;
  reference?: string;
  items: Array<{ medicationId: string; batchNumber: string; expiryDate: string; quantity: number; costPrice?: number }>;
}

interface StockAdjustmentInput {
  batchId: string;
  type: StockAdjustmentType;
  quantity: number;
  reason: string;
}

interface StockMovementEntry {
  id: string;
  type: StockMovementType;
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  batchId?: string;
  medicationId?: string;
  reference: { type: string; id: string; number: string | null } | null;
  batchNumber: string;
  medicationName: string;
  userName: string | null;
  createdAt: string;
}

interface StockMovementsResponse {
  movements: StockMovementEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface ExpiringBatch extends StockBatch {
  medication: { id: string; name: string; strength: string };
  value: number;
}

interface CashSessionTotals {
  salesCount: number;
  salesTotal: number;
  byMethod: MethodTotals;
  refunds: MethodTotals;
  refundsTotal: number;
  net: number;
  expectedCashNow: number;
}

interface CashSessionSummary {
  id: string;
  number: string;
  status: CashSessionStatus;
  openedAt: string;
  openedByName: string | null;
  openingFloat: number;
  closedAt: string | null;
  closedByName: string | null;
  countedCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  closingNotes?: string | null;
  totals: CashSessionTotals;
}

interface PharmacySaleSummary {
  id: string;
  number: string;
  status: PharmacySaleStatus;
  createdAt: string;
  customerLabel?: string | null;
  patient?: { id: string; patientId: string; name: string } | null;
  customerName?: string | null;
  total: number;
  refundedAmount?: number;
  paymentMethod: SalePaymentMethod;
  soldByName?: string | null;
  itemCount?: number;
  returnCount?: number;
  items?: Array<{ description: string; quantity: number; total?: number }>;
}

interface PharmacyReturnSummary {
  id: string;
  number: string;
  createdAt: string;
  reason: string;
  refundAmount: number;
  refundMethod: SalePaymentMethod;
  restock: boolean;
  createdByName?: string | null;
  saleId?: string;
  saleNumber?: string;
}

interface CashSessionDetail extends CashSessionSummary {
  sales: PharmacySaleSummary[];
  returns: PharmacyReturnSummary[];
}

interface PharmacySaleItem {
  id: string;
  medicationId: string;
  description: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  returnedQty: number;
  unitPrice: number;
  total: number;
}

interface PharmacySale {
  id: string;
  number: string;
  status: PharmacySaleStatus;
  createdAt: string;
  soldByName: string | null;
  session: { id: string; number: string };
  patient: { id: string; patientId: string; name: string } | null;
  customerName: string | null;
  customerPhone: string | null;
  prescription: { id: string; doctorName: string; createdAt: string } | null;
  external: { prescriber: string; date: string; ref: string | null } | null;
  items: PharmacySaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: SalePaymentMethod;
  amountTendered: number | null;
  changeGiven: number | null;
  paymentReference: string | null;
  refundedAmount: number;
  returns: PharmacyReturnSummary[];
  voided: { at: string; byName: string | null; reason: string } | null;
}

interface SaleQuoteLine {
  medicationId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  requiresRx: boolean;
  sellable: number;
  batches: Array<{ batchNumber: string; expiryDate: string; quantity: number }>;
  warning: 'NOT_ENOUGH_STOCK' | null;
  /** Recorded allergy this drug matches (directly or by drug family), for the sale's patient */
  allergy?: string | null;
}

interface SaleQuote {
  lines: SaleQuoteLine[];
  subtotal: number;
  rxRequired: boolean;
}

interface CreatePharmacySaleInput {
  items: Array<{ medicationId: string; quantity: number; prescriptionItemId?: string }>;
  patientId?: string;
  customerName?: string;
  customerPhone?: string;
  prescriptionId?: string;
  externalPrescriber?: string;
  externalRxDate?: string;
  externalRxRef?: string;
  discount?: number;
  allergyOverrideReason?: string;
  paymentMethod: SalePaymentMethod;
  amountTendered?: number;
  paymentReference?: string;
  notes?: string;
}

interface PharmacySalesResponse {
  sales: PharmacySaleSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totals: { count: number; total: number; refunded?: number };
}

interface PendingPrescriptionItem {
  id: string;
  medicationId: string;
  name: string;
  strength: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  isDispensed: boolean;
  stockSellable: number;
}

interface PendingPrescription {
  id: string;
  patient: { id: string; patientId: string; name: string };
  doctorName: string;
  createdAt: string;
  items: PendingPrescriptionItem[];
}

interface PharmacyReturnInput {
  items: Array<{ saleItemId: string; quantity: number }>;
  reason: string;
  refundMethod?: SalePaymentMethod;
  restock?: boolean;
}

interface PharmacyDailyReport {
  date: string;
  salesCount: number;
  total: number;
  byMethod: MethodTotals;
  refundsTotal: number;
  net: number;
  topMedications: Array<{ name: string; quantity: number; total: number }>;
  grossMargin: number | null;
}

// Medical documents: certificates, sick leave, referral letters
type MedicalDocumentType = 'SICK_LEAVE' | 'MEDICAL_CERTIFICATE' | 'REFERRAL';
type MedicalDocumentStatus = 'ISSUED' | 'REVOKED';
type ReferralStatus = 'SENT' | 'ACKNOWLEDGED' | 'COMPLETED' | 'CANCELLED';
type ReferralUrgency = 'ROUTINE' | 'URGENT' | 'EMERGENCY';
type CertificateKind = 'GOOD_HEALTH' | 'FITNESS' | 'SPORT' | 'INJURY_REPORT' | 'OTHER';

interface MedicalDocument {
  id: string;
  number: string;
  type: MedicalDocumentType;
  status: MedicalDocumentStatus;
  patient: { id: string; patientId: string; name: string; dateOfBirth?: string | null; gender?: string | null };
  doctor: { id: string; name: string; specialization?: string | null; department?: string | null };
  consultationId: string | null;
  admissionId: string | null;
  verificationCode: string;
  issuedAt: string;
  validFrom: string | null;
  validUntil: string | null;
  leaveDays: number | null;
  leaveKind: 'INITIAL' | 'EXTENSION' | null;
  outingsAllowed: boolean | null;
  certificateKind: CertificateKind | null;
  purpose: string | null;
  findings: string | null;
  conclusion: string | null;
  direction: 'OUTGOING' | 'INCOMING' | null;
  referralStatus: ReferralStatus | null;
  urgency: ReferralUrgency | null;
  toFacility: string | null;
  toSpecialty: string | null;
  toDoctor: string | null;
  fromFacility: string | null;
  fromDoctor: string | null;
  reason?: string | null;
  clinicalSummary: string | null;
  investigations: string | null;
  currentTreatment: string | null;
  question: string | null;
  acknowledgedAt: string | null;
  feedbackAt: string | null;
  feedback: string | null;
  feedbackFrom: string | null;
  revokedAt: string | null;
  revokedByName: string | null;
  revokeReason: string | null;
  /** Why a referral was cancelled (revokeReason is for revoked documents) */
  cancelReason?: string | null;
  createdAt: string;
  /** Present on the pending-referrals list */
  daysWaiting?: number;
}

interface CreateMedicalDocumentInput {
  type: MedicalDocumentType;
  patientId: string;
  doctorId?: string;
  consultationId?: string;
  admissionId?: string;
  // Sick leave
  validFrom?: string;
  leaveDays?: number;
  leaveKind?: 'INITIAL' | 'EXTENSION';
  outingsAllowed?: boolean;
  // Certificate
  certificateKind?: CertificateKind;
  purpose?: string;
  findings?: string;
  conclusion?: string;
  validUntil?: string;
  // Referral
  direction?: 'OUTGOING' | 'INCOMING';
  urgency?: ReferralUrgency;
  toFacility?: string;
  toSpecialty?: string;
  toDoctor?: string;
  fromFacility?: string;
  fromDoctor?: string;
  reason?: string;
  clinicalSummary?: string;
  investigations?: string;
  currentTreatment?: string;
  question?: string;
}

interface MedicalDocumentFilters {
  type?: MedicalDocumentType;
  patientId?: string;
  doctorId?: string;
  status?: MedicalDocumentStatus;
  referralStatus?: ReferralStatus;
  direction?: 'OUTGOING' | 'INCOMING';
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface MedicalDocumentsResponse {
  documents: MedicalDocument[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface PendingReferrals {
  referrals: MedicalDocument[];
  counts: { sent: number; acknowledged: number; overdue: number };
}

interface DocumentVerification {
  valid: boolean;
  status: MedicalDocumentStatus;
  type: MedicalDocumentType;
  number: string;
  issuedAt: string;
  validFrom: string | null;
  validUntil: string | null;
  doctorName: string;
  facility: string;
  patientInitials: string;
  patientBirthYear: number | null;
  certificateKind?: CertificateKind | null;
  direction?: 'OUTGOING' | 'INCOMING' | null;
  /** Genuine but past its validity date (valid stays true) */
  expired?: boolean;
  revokedAt?: string | null;
}

// ---- Imaging (radiology) ----
type ImagingModality = 'XRAY' | 'ULTRASOUND' | 'CT' | 'MRI' | 'MAMMOGRAPHY' | 'FLUOROSCOPY';
type ImagingOrderStatus = 'ORDERED' | 'SCHEDULED' | 'ARRIVED' | 'PERFORMED' | 'REPORTED' | 'CANCELLED';
type ImagingPriority = 'ROUTINE' | 'URGENT' | 'STAT';
type PregnancyStatus = 'NOT_APPLICABLE' | 'NOT_PREGNANT' | 'POSSIBLE' | 'PREGNANT';

interface ImagingExam {
  id: string;
  code: string;
  name: string;
  modality: ImagingModality;
  bodyPart: string;
  price: number;
  durationMinutes: number;
  preparation: string | null;
  usesContrast: boolean;
  isActive: boolean;
}

interface ImagingExamInput {
  code: string;
  name: string;
  modality: ImagingModality;
  bodyPart: string;
  price: number;
  durationMinutes?: number;
  preparation?: string | null;
  usesContrast?: boolean;
  isActive?: boolean;
}

interface ImagingAddendum {
  text: string;
  at: string;
  byName: string;
}

interface ImagingAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  uploadedByName?: string | null;
  createdAt: string;
}

interface ImagingOrder {
  id: string;
  number: string;
  status: ImagingOrderStatus;
  priority: ImagingPriority;
  patient: { id: string; patientId: string; name: string; gender?: string | null; age?: number | null; allergies?: string[]; phoneMasked?: string | null };
  exam: ImagingExam;
  orderedBy: { id: string; name: string };
  consultationId: string | null;
  admissionId: string | null;
  clinicalInfo: string;
  question: string | null;
  scheduledAt: string | null;
  room: string | null;
  arrivedAt: string | null;
  pregnancyStatus?: PregnancyStatus | null;
  contrastChecked?: boolean;
  creatinine?: number | null;
  safetyNotes?: string | null;
  performedAt: string | null;
  performedByName?: string | null;
  technique: string | null;
  findings: string | null;
  conclusion: string | null;
  isCritical: boolean;
  reportedBy: { id: string; name: string } | null;
  reportedAt: string | null;
  addenda: ImagingAddendum[];
  cancelledAt: string | null;
  cancelReason: string | null;
  invoice: { id: string; invoiceNumber: string; status: string } | null;
  chargedToStay: boolean;
  attachments: ImagingAttachment[];
  warnings: string[];
  createdAt: string;
}

/** Worklist rows: the server may send fewer fields than the full order */
type ImagingOrderSummary = Pick<ImagingOrder, 'id' | 'number' | 'status' | 'priority' | 'patient' | 'orderedBy' | 'scheduledAt' | 'room' | 'createdAt'> &
  Partial<Omit<ImagingOrder, 'id' | 'number' | 'status' | 'priority' | 'patient' | 'orderedBy' | 'scheduledAt' | 'room' | 'createdAt' | 'exam'>> & {
    exam: Pick<ImagingExam, 'id' | 'name' | 'modality'> & Partial<ImagingExam>;
  };

interface ImagingOrdersResponse {
  orders: ImagingOrderSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counts: Partial<Record<ImagingOrderStatus, number>>;
}

interface ImagingOrderFilters {
  status?: ImagingOrderStatus | '';
  modality?: ImagingModality | '';
  priority?: ImagingPriority | '';
  date?: string;
  patientId?: string;
  orderedById?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface CreateImagingOrderInput {
  patientId: string;
  examId: string;
  priority?: ImagingPriority;
  clinicalInfo: string;
  question?: string;
  consultationId?: string;
  admissionId?: string;
  orderedById?: string;
}

type ImagingOrderAction =
  | { action: 'schedule'; scheduledAt: string; room?: string }
  | { action: 'arrive' }
  | { action: 'safety'; pregnancyStatus?: PregnancyStatus; contrastChecked?: boolean; creatinine?: number | null; safetyNotes?: string }
  | { action: 'perform'; radiologistAgreed?: boolean; overrideReason?: string }
  | { action: 'cancel'; reason: string };

interface ImagingStats {
  date: string;
  byStatus: Partial<Record<ImagingOrderStatus, number>>;
  byModality: Partial<Record<ImagingModality, number>>;
  avgOrderToReportHours: number | null;
  pendingReports: number;
  criticalToday: number;
}


// ---------- Patient extras: family access, visit feedback, appointment confirmation ----------

type ProxyRelationship = 'PARENT' | 'GUARDIAN' | 'CHILD' | 'SPOUSE' | 'CAREGIVER' | 'OTHER';
type ProxyAccessLevel = 'FULL' | 'APPOINTMENTS_BILLING';
type ProxyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

interface ProxyPatientSummary {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
}

/** A relative's record the signed-in patient may act for */
interface ActingForLink {
  linkId: string;
  patient: ProxyPatientSummary;
  relationship: ProxyRelationship;
  accessLevel: ProxyAccessLevel;
  validUntil: string | null;
}

/** Someone who may act for the signed-in patient's record */
interface GrantedToLink {
  linkId: string;
  proxyUser: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null };
  relationship: ProxyRelationship;
  accessLevel: ProxyAccessLevel;
  status: ProxyStatus;
  validUntil: string | null;
  grantedBy: string; // STAFF | PATIENT
  createdAt: string;
}

interface MyProxies {
  actingFor: ActingForLink[];
  grantedTo: GrantedToLink[];
}

interface GrantProxyInput {
  email?: string;
  phone?: string;
  relationship: ProxyRelationship;
  accessLevel: ProxyAccessLevel;
}

/** A family-access link as the desk sees it */
interface ProxyLink {
  id: string;
  patientId: string;
  patient?: ProxyPatientSummary | null;
  proxyUser: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; phoneNumber?: string | null };
  relationship: ProxyRelationship;
  accessLevel: ProxyAccessLevel;
  status: ProxyStatus;
  validUntil: string | null;
  grantedBy: string;
  grantedByName?: string | null;
  verificationNote?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
  createdAt: string;
}

interface CreateProxyInput {
  patientId: string;
  /** The account that will act: its user id, or the patient record behind it */
  proxyUserId?: string;
  proxyPatientId?: string;
  relationship: ProxyRelationship;
  accessLevel: ProxyAccessLevel;
  verificationNote: string;
  validUntil?: string | null;
}

type FeedbackStatus = 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
type FeedbackVisitKind = 'CONSULTATION' | 'STAY';

interface FeedbackVisit {
  kind: FeedbackVisitKind;
  date: string | null;
  department: string | null;
  doctorName: string | null;
}

/** Public survey reached from the link sent after a visit */
interface FeedbackSurvey {
  status: 'OPEN' | 'SUBMITTED' | 'EXPIRED';
  visit: FeedbackVisit;
  patientFirstName: string | null;
}

interface FeedbackSurveyInput {
  overall: number;
  waitTime?: number;
  staffCourtesy?: number;
  explanations?: number;
  cleanliness?: number;
  recommend?: number;
  comment?: string;
  isComplaint?: boolean;
  complaintCategory?: string;
  contactBack?: boolean;
}

/** A survey of the acting patient (portal) */
interface MyFeedbackItem {
  id?: string;
  token: string | null;
  visit: FeedbackVisit | null;
  sentAt?: string | null;
  expiresAt?: string | null;
  submittedAt?: string | null;
  overall?: number | null;
}

interface MyFeedback {
  pending: MyFeedbackItem[];
  submitted: MyFeedbackItem[];
}

interface FeedbackEntry {
  id: string;
  patient?: { id: string; patientId?: string; name: string } | null;
  visit?: FeedbackVisit | null;
  department?: { id: string; name: string } | string | null;
  doctor?: { id: string; name: string } | string | null;
  sentAt?: string | null;
  submittedAt: string | null;
  overall: number | null;
  waitTime?: number | null;
  staffCourtesy?: number | null;
  explanations?: number | null;
  cleanliness?: number | null;
  recommend?: number | null;
  comment?: string | null;
  isComplaint: boolean;
  complaintCategory?: string | null;
  contactBack?: boolean;
  status: FeedbackStatus;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string } | null;
  response?: string | null;
  respondedAt?: string | null;
  respondedByName?: string | null;
}

interface FeedbackFilters {
  from?: string;
  to?: string;
  departmentId?: string;
  doctorId?: string;
  complaint?: boolean;
  status?: FeedbackStatus | '';
  minOverall?: number;
  maxOverall?: number;
  /** Include surveys sent but not answered (submitted only by default) */
  includePending?: boolean;
  page?: number;
  limit?: number;
}

interface FeedbackListResponse {
  feedbacks: FeedbackEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface FeedbackAverages {
  overall: number | null;
  waitTime: number | null;
  staffCourtesy: number | null;
  explanations: number | null;
  cleanliness: number | null;
}

interface FeedbackSummary {
  responses: number;
  sent: number;
  responseRate: number | null; // 0..1 or 0..100 (normalised by the page)
  averages: FeedbackAverages;
  nps: { score: number | null; promoters: number; passives: number; detractors: number };
  byDepartment: Array<{ department: string; departmentId?: string; responses: number; overall: number | null; nps: number | null }>;
  byDoctor?: Array<{ doctor: string; doctorId?: string; responses: number; overall: number | null; nps: number | null }>;
  complaints: { open: number; resolved: number; byCategory: Record<string, number> };
  trend: Array<{ week: string; responses: number; overall: number | null }>;
}

interface AppointmentConfirmationInfo {
  appointment: {
    date: string;
    startTime: string;
    doctorName: string | null;
    department: string | null;
    status: string;
    patientFirstName: string | null;
  };
}

interface InboundSmsResult {
  action?: string | null; // CONFIRMED, CANCELLED, UNRECOGNISED, NO_MATCH, ALREADY_DONE
  matchedId?: string | null;
  matchedType?: string | null;
  reply?: string | null;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    // Check localStorage first (remember me), then sessionStorage
    return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    // Check localStorage first (remember me), then sessionStorage
    return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
  }

  private getStorageType(): 'localStorage' | 'sessionStorage' {
    if (typeof window === 'undefined') return 'sessionStorage';
    // If token exists in localStorage, use localStorage; otherwise sessionStorage
    return localStorage.getItem('accessToken') ? 'localStorage' : 'sessionStorage';
  }

  private setTokens(accessToken: string, refreshToken: string, _rememberMe: boolean = true): void {
    // Clear any existing tokens first (the acting profile survives a token refresh)
    this.removeTokens();

    // Always use localStorage for dashboard to persist across refreshes
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('rememberMe', 'true');
  }

  private removeTokens(): void {
    // Clear from both storages
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
  }

  /** End of session: tokens and the relative being acted for are forgotten */
  clearTokens(): void {
    this.removeTokens();
    this.clearActingProfile();
  }

  /** Stop acting for a relative (logout, new login, or the link is gone) */
  clearActingProfile(): void {
    if (typeof window === 'undefined') return;
    writeActingProfile(window.sessionStorage, null);
    window.dispatchEvent(new Event(ACTING_CHANGE_EVENT));
  }

  /** Header naming the relative a patient account acts for (family access), if any */
  private actingHeader(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    return actingHeaders(readActingProfile(window.sessionStorage));
  }

  /** Session token plus family-access header, for requests made outside request() */
  private authHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...this.actingHeader() };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const accessToken = this.getAccessToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...this.actingHeader(),
      ...options.headers,
    };

    if (accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    } catch {
      const isFrench = typeof window !== 'undefined' && localStorage.getItem('language') !== 'en';
      throw new ApiError(
        isFrench ? 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.' : 'Unable to reach the server. Check your connection and try again.',
        0
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && this.getRefreshToken()) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.request<T>(endpoint, options);
        }
      }
      throw new ApiError(localizeServerMessage(data.message || data.error || 'Request failed'), response.status);
    }

    return data;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    // Preserve the remember me setting when refreshing tokens
    const rememberMe = typeof window !== 'undefined' && localStorage.getItem('rememberMe') === 'true';

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json();
      // Tokens are nested inside data.tokens
      if (data.success && data.data?.tokens) {
        this.setTokens(data.data.tokens.accessToken, data.data.tokens.refreshToken, rememberMe);
        return true;
      }
      return false;
    } catch {
      // Network failure: keep the tokens so the session survives a server restart
      return false;
    }
  }

  // Auth methods
  async login(credentials: LoginRequest): Promise<LoginResponse | MfaChallenge> {
    const { rememberMe, ...loginData } = credentials;

    const response = await this.request<LoginResponse | MfaChallenge>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData),
    });

    if (response.success && response.data) {
      if ('mfaRequired' in response.data) return response.data;
      // Tokens are nested inside response.data.tokens
      const { tokens } = response.data;
      this.clearActingProfile();
      this.setTokens(tokens.accessToken, tokens.refreshToken, rememberMe || true);
      return response.data;
    }

    throw new Error(response.message || response.error || 'Login failed');
  }

  /** Second login step: a code from the authenticator app, or a single-use recovery code */
  async verifyMfa(data: { mfaToken: string; code?: string; recoveryCode?: string }): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/api/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      this.clearActingProfile();
      this.setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken, true);
      return response.data;
    }
    throw new Error(response.message || response.error || 'Verification failed');
  }

  async setupMfa(): Promise<{ qrDataUrl: string; otpauthUrl: string; secret: string }> {
    const response = await this.request<{ qrDataUrl: string; otpauthUrl: string; secret: string }>('/api/auth/mfa/setup', { method: 'POST' });
    if (response.success && response.data) return response.data;
    throw new Error(response.message || response.error || 'Two-factor setup failed');
  }

  async enableMfa(code: string): Promise<{ recoveryCodes: string[] }> {
    const response = await this.request<{ recoveryCodes: string[]; tokens?: { accessToken: string; refreshToken: string } }>(
      '/api/auth/mfa/enable',
      { method: 'POST', body: JSON.stringify({ code }) }
    );
    if (response.success && response.data) {
      // Until enrolment the API only accepted the 2FA setup: switch to the full session now
      if (response.data.tokens) this.setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
      return response.data;
    }
    throw new Error(response.message || response.error || 'Two-factor setup failed');
  }

  async disableMfa(code: string): Promise<void> {
    await this.request('/api/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) });
  }

  /** Admin: clear another user's 2FA after a lost phone; they enrol again at next login */
  async resetUserMfa(userId: string): Promise<void> {
    await this.request(`/api/users/${userId}/mfa-reset`, { method: 'POST' });
  }

  async getConsentTexts(): Promise<ConsentTexts> {
    const response = await this.request<ConsentTexts>('/api/consents/texts');
    if (response.success && response.data) return response.data;
    throw new Error('Failed to fetch consent texts');
  }

  async getPatientConsents(patientId: string): Promise<ConsentStatus> {
    const response = await this.request<ConsentStatus>(`/api/patients/${patientId}/consents`);
    if (response.success && response.data) return response.data;
    throw new Error('Failed to fetch consents');
  }

  async recordPatientConsent(
    patientId: string,
    data: { type: ConsentType; granted: boolean; method?: ConsentMethod; notes?: string }
  ): Promise<ConsentStatus> {
    const response = await this.request<ConsentStatus>(`/api/patients/${patientId}/consents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) return response.data;
    throw new Error(response.message || response.error || 'Failed to record consent');
  }

  /** Download everything held about a patient as a JSON file; resolves to the file name */
  async exportPatientData(patientId: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/patients/${patientId}/export`, {
        headers: this.authHeaders(),
      });
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(localizeServerMessage(data.error || data.message || 'Request failed'), response.status);
    }
    const fileName = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || `dossier-${patientId}.json`;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return fileName;
  }

  /** Admin: right to erasure. Identifiers are removed; clinical and billing records are kept. */
  async anonymizePatient(patientId: string, data: { reason: string; confirmPatientId: string }): Promise<void> {
    await this.request(`/api/patients/${patientId}/anonymize`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const response = await this.request<SystemStatusResponse>('/api/system-status');
    if (response.success && response.data) {
      // The API groups figures differently from the page; translate once here
      const { restoreDrill, counts, mfa, recentErrors, ...rest } = response.data;
      return {
        ...rest,
        // Show the first line of the underlying error next to the log message
        recentErrors: recentErrors?.map(({ error, ...entry }) => ({
          ...entry,
          msg: [entry.msg, error?.message?.trim().split('\n')[0]].filter(Boolean).join(' '),
        })),
        lastRestoreDrill: restoreDrill ?? null,
        counts: {
          users: counts?.activeUsers,
          patients: counts?.patients,
          auditLast24h: counts?.auditEntries24h,
          failedLoginsLast24h: counts?.failedLogins24h,
          mfaEnrolled: mfa?.enrolled,
          mfaRequired: mfa?.required,
        },
      };
    }
    throw new Error(response.message || response.error || 'Failed to fetch system status');
  }

  // ---- Mobile money (MTN MoMo, Orange Money) ----

  /** Ask the payer to confirm on their phone; amount defaults to the invoice balance */
  async payWithMobileMoney(data: { invoiceId: string; provider: MobileMoneyProvider; phoneNumber: string; amount?: number }): Promise<MobileMoneyTransaction> {
    const response = await this.request<MobileMoneyTransaction>('/api/payments/mobile-money', { method: 'POST', body: JSON.stringify(data) });
    if (response.success && response.data) return response.data;
    throw new Error(response.message || response.error || 'Payment request failed');
  }

  /** Current state; the backend asks the operator while the request is still open */
  async getMobileMoneyTransaction(id: string): Promise<MobileMoneyTransaction> {
    const response = await this.request<MobileMoneyTransaction>(`/api/payments/mobile-money/${id}`);
    if (response.success && response.data) return response.data;
    throw new Error('Failed to fetch payment status');
  }

  async cancelMobileMoneyTransaction(id: string): Promise<void> {
    await this.request(`/api/payments/mobile-money/${id}`, { method: 'DELETE' });
  }

  async getInvoiceMobileMoneyTransactions(invoiceId: string): Promise<MobileMoneyTransaction[]> {
    const response = await this.request<{ transactions: MobileMoneyTransaction[] }>(`/api/payments/mobile-money?invoiceId=${encodeURIComponent(invoiceId)}`);
    return response.data?.transactions ?? [];
  }

  /** Sandbox only: play the payer's answer (404 in live mode) */
  async simulateMobileMoney(id: string, action: 'approve' | 'decline'): Promise<MobileMoneyTransaction> {
    const response = await this.request<{ transaction: MobileMoneyTransaction }>(`/api/dev/payments/${id}/${action}`, { method: 'POST' });
    if (response.success && response.data) return response.data.transaction;
    throw new Error('Simulation failed');
  }

  async getMobileMoneyReconciliation(date: string): Promise<MobileMoneyReconciliation> {
    const response = await this.request<MobileMoneyReconciliation>(`/api/payments/reconciliation?date=${encodeURIComponent(date)}`);
    if (response.success && response.data) return response.data;
    throw new Error('Failed to fetch reconciliation');
  }

  // ---- Outbound messages (SMS, WhatsApp, email) ----

  async getMessages(filters: {
    page?: number;
    limit?: number;
    channel?: string;
    status?: string;
    template?: string;
    patientId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  } = {}): Promise<MessagesResponse> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const response = await this.request<MessagesResponse>(`/api/messages?${params.toString()}`);
    if (response.success && response.data) return response.data;
    throw new Error('Failed to fetch messages');
  }

  async getMessage(id: string): Promise<OutboundMessage> {
    const response = await this.request<OutboundMessage>(`/api/messages/${id}`);
    if (response.success && response.data) return response.data;
    throw new Error('Failed to fetch message');
  }

  async retryMessage(id: string): Promise<void> {
    await this.request(`/api/messages/${id}/retry`, { method: 'POST' });
  }

  async sendTestMessage(data: { channel: MessageChannel; to: string; message: string }): Promise<void> {
    await this.request('/api/messages/test', { method: 'POST', body: JSON.stringify(data) });
  }

  // ---- Password reset (public) ----

  async forgotPassword(email: string): Promise<void> {
    await this.request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  }

  async resetPassword(data: { token: string; newPassword: string; confirmPassword: string }): Promise<void> {
    await this.request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(data) });
  }

  async getAuditLogs(filters: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<AuditLogsResponse> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const response = await this.request<AuditLogsResponse>(`/api/audit-logs?${params.toString()}`);
    if (response.success && response.data) return response.data;
    throw new Error('Failed to fetch audit logs');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.clearTokens();
    }
  }

  async updateProfile(data: { firstName?: string; lastName?: string; phoneNumber?: string; profileImageUrl?: string }): Promise<void> {
    const response = await this.request('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        user: data,
      }),
    });
    if (!response.success) {
      throw new Error('Failed to update profile');
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.request<{ user: User }>('/api/auth/me');
    if (response.success && response.data) {
      return response.data.user;
    }
    throw new Error('Failed to get user');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // Patient methods
  async getPatients(filters: PatientFilters = {}): Promise<PatientsResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.gender) params.append('gender', filters.gender);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<PatientsResponse>(
      `/api/patients?${params.toString()}`
    );

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch patients');
  }

  async getPatient(id: string): Promise<PatientDetail> {
    const response = await this.request<PatientDetail>(`/api/patients/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch patient');
  }

  async createPatient(data: Partial<Patient>): Promise<Patient> {
    const response = await this.request<Patient>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create patient');
  }

  async updatePatient(id: string, data: Partial<Patient>): Promise<Patient> {
    const response = await this.request<Patient>(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update patient');
  }

  async deletePatient(id: string): Promise<void> {
    const response = await this.request(`/api/patients/${id}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error('Failed to delete patient');
    }
  }

  // Doctor methods
  async getDoctors(filters: DoctorFilters = {}): Promise<DoctorsResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.department) params.append('department', filters.department);
    if (filters.specialization) params.append('specialization', filters.specialization);
    if (filters.available !== undefined) params.append('available', filters.available.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<DoctorsResponse>(
      `/api/doctors?${params.toString()}`
    );

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch doctors');
  }

  async getDoctor(id: string): Promise<Doctor> {
    const response = await this.request<Doctor>(`/api/doctors/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch doctor');
  }

  async getDoctorPatients(
    doctorId: string,
    params?: { search?: string; page?: number; limit?: number }
  ): Promise<PatientsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const url = `/api/doctors/${doctorId}/patients${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<PatientsResponse>(url);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch doctor patients');
  }

  async createDoctor(data: Partial<Doctor>): Promise<Doctor> {
    const response = await this.request<Doctor>('/api/doctors', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create doctor');
  }

  async updateDoctor(id: string, data: Partial<Doctor>): Promise<Doctor> {
    const response = await this.request<Doctor>(`/api/doctors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update doctor');
  }

  async deleteDoctor(id: string): Promise<void> {
    const response = await this.request(`/api/doctors/${id}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error('Failed to delete doctor');
    }
  }

  async getDoctorAvailability(doctorId: string, date: string): Promise<DoctorAvailability> {
    const response = await this.request<DoctorAvailability>(
      `/api/doctors/${doctorId}/availability?date=${date}`
    );

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch doctor availability');
  }

  async updateDoctorSchedule(doctorId: string, schedule: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDuration: number;
    isActive: boolean;
  }[]): Promise<void> {
    const response = await this.request<void>(
      `/api/doctors/${doctorId}/schedule`,
      {
        method: 'PUT',
        body: JSON.stringify({ schedule }),
      }
    );

    if (!response.success) {
      throw new Error('Failed to update schedule');
    }
  }

  // Appointment methods
  async getAppointments(filters: AppointmentFilters = {}): Promise<AppointmentsResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.type) params.append('type', filters.type);
    if (filters.doctorId) params.append('doctorId', filters.doctorId);
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<AppointmentsResponse>(
      `/api/appointments?${params.toString()}`
    );

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch appointments');
  }

  async getAppointment(id: string): Promise<Appointment> {
    const response = await this.request<Appointment>(`/api/appointments/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch appointment');
  }

  async createAppointment(data: {
    patientId: string;
    doctorId: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    type?: AppointmentType;
    reason: string;
    notes?: string;
  }): Promise<Appointment> {
    const response = await this.request<Appointment>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create appointment');
  }

  async updateAppointment(id: string, data: Partial<{
    appointmentDate: string;
    startTime: string;
    endTime: string;
    type: AppointmentType;
    status: AppointmentStatus;
    reason: string;
    notes: string;
    cancellationReason: string;
  }>): Promise<Appointment> {
    const response = await this.request<Appointment>(`/api/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update appointment');
  }

  async deleteAppointment(id: string): Promise<void> {
    const response = await this.request(`/api/appointments/${id}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error('Failed to delete appointment');
    }
  }

  async getRescheduleInfo(id: string): Promise<{
    appointment: {
      id: string;
      appointmentDate: string;
      startTime: string;
      endTime: string;
      status: string;
      rescheduleCount: number;
      maxReschedules: number;
      remainingReschedules: number;
    };
    canReschedule: boolean;
    reason: string | null;
    patient: { id: string; firstName: string; lastName: string };
    doctor: { id: string; firstName: string; lastName: string };
  }> {
    const response = await this.request<{
      appointment: {
        id: string;
        appointmentDate: string;
        startTime: string;
        endTime: string;
        status: string;
        rescheduleCount: number;
        maxReschedules: number;
        remainingReschedules: number;
      };
      canReschedule: boolean;
      reason: string | null;
      patient: { id: string; firstName: string; lastName: string };
      doctor: { id: string; firstName: string; lastName: string };
    }>(`/api/appointments/${id}/reschedule`);

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to get reschedule info');
  }

  async rescheduleAppointment(id: string, data: {
    appointmentDate: string;
    startTime: string;
    endTime?: string;
  }): Promise<{
    id: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
    rescheduleCount: number;
  }> {
    const response = await this.request<{
      id: string;
      appointmentDate: string;
      startTime: string;
      endTime: string;
      status: string;
      rescheduleCount: number;
    }>(`/api/appointments/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || response.error || 'Failed to reschedule appointment');
  }

  // Dashboard methods
  async getDashboardStats(): Promise<DashboardData> {
    const response = await this.request<DashboardData>('/api/dashboard');

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch dashboard data');
  }

  // Department methods
  async getDepartments(filters: { search?: string; isActive?: boolean; page?: number; limit?: number } = {}): Promise<DepartmentsResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<DepartmentsResponse>(`/api/departments?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch departments');
  }

  async getDepartment(id: string): Promise<DepartmentDetail> {
    const response = await this.request<DepartmentDetail>(`/api/departments/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch department');
  }

  async createDepartment(data: { name: string; description?: string; isActive?: boolean }): Promise<Department> {
    const response = await this.request<Department>('/api/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create department');
  }

  async updateDepartment(id: string, data: { name?: string; description?: string; isActive?: boolean }): Promise<Department> {
    const response = await this.request<Department>(`/api/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update department');
  }

  async deleteDepartment(id: string): Promise<void> {
    const response = await this.request(`/api/departments/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to delete department');
    }
  }

  // Medication methods
  async getMedications(filters: { search?: string; category?: string; isActive?: boolean; lowStock?: boolean; page?: number; limit?: number } = {}): Promise<MedicationsResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters.lowStock) params.append('lowStock', 'true');
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<MedicationsResponse>(`/api/medications?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch medications');
  }

  async getMedication(id: string): Promise<Medication> {
    const response = await this.request<Medication>(`/api/medications/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch medication');
  }

  async createMedication(data: Partial<Medication>): Promise<Medication> {
    const response = await this.request<Medication>('/api/medications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create medication');
  }

  async updateMedication(id: string, data: Partial<Medication>): Promise<Medication> {
    const response = await this.request<Medication>(`/api/medications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update medication');
  }

  async adjustMedicationStock(id: string, data: { adjustment: number; reason: string; type: 'ADD' | 'REMOVE' | 'ADJUSTMENT' }): Promise<void> {
    const response = await this.request(`/api/medications/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.success) {
      throw new Error('Failed to adjust stock');
    }
  }

  async deleteMedication(id: string): Promise<void> {
    const response = await this.request(`/api/medications/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to delete medication');
    }
  }

  // Lab Test methods
  async getLabTests(filters: { search?: string; category?: string; isActive?: boolean; page?: number; limit?: number } = {}): Promise<LabTestsResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<LabTestsResponse>(`/api/lab-tests?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch lab tests');
  }

  async getLabTest(id: string): Promise<LabTest> {
    const response = await this.request<LabTest>(`/api/lab-tests/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch lab test');
  }

  async createLabTest(data: Partial<LabTest>): Promise<LabTest> {
    const response = await this.request<LabTest>('/api/lab-tests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create lab test');
  }

  async updateLabTest(id: string, data: Partial<LabTest>): Promise<LabTest> {
    const response = await this.request<LabTest>(`/api/lab-tests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update lab test');
  }

  async deleteLabTest(id: string): Promise<void> {
    const response = await this.request(`/api/lab-tests/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to delete lab test');
    }
  }

  // Lab Order methods
  async getLabOrders(filters: { search?: string; status?: LabOrderStatus; priority?: string; patientId?: string; doctorId?: string; page?: number; limit?: number } = {}): Promise<LabOrdersResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.doctorId) params.append('doctorId', filters.doctorId);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<LabOrdersResponse>(`/api/lab-orders?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch lab orders');
  }

  async getLabOrder(id: string): Promise<LabOrder> {
    const response = await this.request<LabOrder>(`/api/lab-orders/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch lab order');
  }

  async createLabOrder(data: { patientId: string; doctorId: string; consultationId?: string; admissionId?: string; clinicalInfo?: string; priority?: string; notes?: string; tests: { labTestId: string }[] }): Promise<LabOrder> {
    const response = await this.request<LabOrder>('/api/lab-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create lab order');
  }

  async updateLabOrder(id: string, data: { status?: LabOrderStatus; priority?: string; notes?: string; collectedBy?: string; results?: Array<{ itemId: string; result: string; isAbnormal?: boolean; unit?: string; normalRange?: string; notes?: string }> }): Promise<LabOrder> {
    const response = await this.request<LabOrder>(`/api/lab-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update lab order');
  }

  async cancelLabOrder(id: string): Promise<void> {
    const response = await this.request(`/api/lab-orders/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to cancel lab order');
    }
  }

  // ---- Lab workflow: samples, results, validation ----

  async getLabOrderDetail(id: string): Promise<LabOrderDetail> {
    return this.data<LabOrderDetail>(`/api/lab-orders/${id}`);
  }

  async getLabWorklist(filters: { date?: string; priority?: string } = {}): Promise<LabWorklist> {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.priority) params.append('priority', filters.priority);
    return this.data<LabWorklist>(`/api/lab/worklist?${params.toString()}`);
  }

  async getLabStats(date?: string): Promise<LabStats> {
    return this.data<LabStats>(`/api/lab/stats${date ? `?date=${date}` : ''}`);
  }

  async collectLabSamples(orderId: string): Promise<LabSample[]> {
    const data = await this.data<{ samples: LabSample[] } | LabSample[]>(`/api/lab-orders/${orderId}/samples`, { method: 'POST', body: '{}' });
    return Array.isArray(data) ? data : data.samples;
  }

  async lookupLabSample(barcode: string): Promise<LabSampleLookup> {
    return this.data<LabSampleLookup>(`/api/lab-samples/${encodeURIComponent(barcode)}`);
  }

  async receiveLabSample(barcode: string): Promise<LabSample> {
    return this.data<LabSample>(`/api/lab-samples/${encodeURIComponent(barcode)}/receive`, { method: 'POST', body: '{}' });
  }

  async rejectLabSample(barcode: string, reason: string, note?: string): Promise<LabSample> {
    return this.data<LabSample>(`/api/lab-samples/${encodeURIComponent(barcode)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, ...(note ? { note } : {}) }),
    });
  }

  async saveLabResults(orderId: string, results: Array<{ itemId: string; value: string; notes?: string }>): Promise<LabOrderDetail> {
    return this.data<LabOrderDetail>(`/api/lab-orders/${orderId}/results`, { method: 'POST', body: JSON.stringify({ results }) });
  }

  async rerunLabItem(orderId: string, itemId: string, reason: string): Promise<LabOrderDetail> {
    return this.data<LabOrderDetail>(`/api/lab-orders/${orderId}/rerun`, { method: 'POST', body: JSON.stringify({ itemId, reason }) });
  }

  async validateLabResults(orderId: string, body: { itemIds?: string[]; criticalCall?: { calledTo: string } } = {}): Promise<LabOrderDetail> {
    return this.data<LabOrderDetail>(`/api/lab-orders/${orderId}/validate`, { method: 'POST', body: JSON.stringify(body) });
  }

  async documentLabCriticalCall(orderId: string, itemId: string, calledTo: string): Promise<LabOrderDetail> {
    return this.data<LabOrderDetail>(`/api/lab-orders/${orderId}/critical-call`, { method: 'POST', body: JSON.stringify({ itemId, calledTo }) });
  }

  async getLabItemHistory(orderId: string, itemId: string): Promise<LabHistoryEntry[]> {
    const data = await this.data<{ history: LabHistoryEntry[] } | LabHistoryEntry[]>(`/api/lab-orders/${orderId}/history?itemId=${encodeURIComponent(itemId)}`);
    return Array.isArray(data) ? data : data.history ?? [];
  }

  async billLabOrder(orderId: string): Promise<{ invoice: { id: string; invoiceNumber: string } }> {
    return this.data<{ invoice: { id: string; invoiceNumber: string } }>(`/api/lab-orders/${orderId}/bill`, { method: 'POST', body: '{}' });
  }

  async saveLabTestRanges(id: string, data: Partial<LabTest>): Promise<LabTest> {
    return this.data<LabTest>(`/api/lab-tests/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  /** Sample labels (one small page per tube) to print */
  async openLabLabels(orderId: string, sampleIds?: string[]): Promise<void> {
    const query = sampleIds && sampleIds.length ? `?ids=${sampleIds.map(encodeURIComponent).join(',')}` : '';
    await this.openProtectedPdf(`/api/lab-orders/${orderId}/samples/labels.pdf${query}`, `etiquettes-${orderId}.pdf`);
  }

  /** Released results report */
  async openLabReportPdf(orderId: string, lang: 'fr' | 'en' = 'fr'): Promise<void> {
    await this.openProtectedPdf(`/api/lab-orders/${orderId}/pdf?lang=${lang}`, `analyses-${orderId}.pdf`);
  }

  /** Fetch a PDF with the session token and open it in a new tab (download if pop-ups are blocked) */
  private async openProtectedPdf(path: string, fallbackName: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { headers: this.authHeaders() });
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(localizeServerMessage(data.error || data.message || 'Request failed'), response.status);
    }
    const url = URL.createObjectURL(await response.blob());
    const opened = window.open(url, '_blank');
    if (!opened) {
      const fileName = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---- Insurer billing (tiers payant) ----

  private async data<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await this.request<T>(endpoint, options);
    if (response.success && response.data !== undefined) return response.data;
    throw new Error(response.message || response.error || 'Request failed');
  }

  async getPayers(filters: { active?: boolean; search?: string } = {}): Promise<Payer[]> {
    const params = new URLSearchParams();
    if (filters.active !== undefined) params.append('active', String(filters.active));
    if (filters.search) params.append('search', filters.search);
    return (await this.data<{ payers: Payer[] }>(`/api/payers?${params.toString()}`)).payers;
  }

  async getPayer(id: string): Promise<Payer> {
    return this.data<Payer>(`/api/payers/${id}`);
  }

  async createPayer(data: PayerInput): Promise<Payer> {
    return this.data<Payer>('/api/payers', { method: 'POST', body: JSON.stringify(data) });
  }

  async updatePayer(id: string, data: Partial<PayerInput>): Promise<Payer> {
    return this.data<Payer>(`/api/payers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async getPatientCoverages(patientId: string): Promise<PatientCoverage[]> {
    return (await this.data<{ coverages: PatientCoverage[] }>(`/api/patients/${patientId}/coverages`)).coverages;
  }

  async createPatientCoverage(patientId: string, data: PatientCoverageInput): Promise<PatientCoverage> {
    return this.data<PatientCoverage>(`/api/patients/${patientId}/coverages`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updatePatientCoverage(patientId: string, coverageId: string, data: Partial<PatientCoverageInput>): Promise<PatientCoverage> {
    return this.data<PatientCoverage>(`/api/patients/${patientId}/coverages/${coverageId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async previewCoverage(data: { patientId: string; coverageId?: string | null; items: InvoiceItemInput[]; tax?: number; discount?: number }): Promise<CoveragePreview> {
    return this.data<CoveragePreview>('/api/invoices/coverage-preview', { method: 'POST', body: JSON.stringify(data) });
  }

  async getPreAuthorizations(filters: { patientId?: string; payerId?: string; status?: PreAuthStatus } = {}): Promise<PreAuthorization[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.payerId) params.append('payerId', filters.payerId);
    if (filters.status) params.append('status', filters.status);
    return (await this.data<{ preAuthorizations: PreAuthorization[] }>(`/api/pre-authorizations?${params.toString()}`)).preAuthorizations;
  }

  async createPreAuthorization(data: { patientId: string; coverageId: string; services: string; requestedAmount: number; notes?: string }): Promise<PreAuthorization> {
    return this.data<PreAuthorization>('/api/pre-authorizations', { method: 'POST', body: JSON.stringify(data) });
  }

  async updatePreAuthorization(id: string, data: PreAuthAction): Promise<PreAuthorization> {
    return this.data<PreAuthorization>(`/api/pre-authorizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async getClaims(filters: { payerId?: string; status?: ClaimStatus } = {}): Promise<ClaimSummary[]> {
    const params = new URLSearchParams();
    if (filters.payerId) params.append('payerId', filters.payerId);
    if (filters.status) params.append('status', filters.status);
    return (await this.data<{ claims: ClaimSummary[] }>(`/api/claims?${params.toString()}`)).claims;
  }

  async getEligibleClaimInvoices(filters: { payerId: string; periodStart: string; periodEnd: string }): Promise<EligibleClaimInvoice[]> {
    const params = new URLSearchParams(filters);
    return (await this.data<{ invoices: EligibleClaimInvoice[] }>(`/api/claims/eligible?${params.toString()}`)).invoices;
  }

  async createClaim(data: { payerId: string; periodStart: string; periodEnd: string; invoiceIds?: string[]; notes?: string }): Promise<ClaimDetail> {
    return this.data<ClaimDetail>('/api/claims', { method: 'POST', body: JSON.stringify(data) });
  }

  async getClaim(id: string): Promise<ClaimDetail> {
    return this.data<ClaimDetail>(`/api/claims/${id}`);
  }

  async updateClaim(id: string, data: ClaimAction): Promise<ClaimDetail> {
    return this.data<ClaimDetail>(`/api/claims/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteClaim(id: string): Promise<void> {
    await this.request(`/api/claims/${id}`, { method: 'DELETE' });
  }

  async recordClaimSettlement(id: string, data: ClaimSettlementInput): Promise<ClaimDetail> {
    return this.data<ClaimDetail>(`/api/claims/${id}/settlement`, { method: 'POST', body: JSON.stringify(data) });
  }

  /** Download the bordereau as CSV or PDF in the current UI language */
  async downloadClaimExport(id: string, format: 'csv' | 'pdf', lang: 'fr' | 'en'): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/claims/${id}/export?format=${format}&lang=${lang}`, {
        headers: this.authHeaders(),
      });
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(localizeServerMessage(data.error || data.message || 'Request failed'), response.status);
    }
    const fileName = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || `bordereau-${id}.${format}`;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return fileName;
  }

  // Queue & triage
  async getQueue(filters: { departmentId?: string; doctorId?: string; date?: string; status?: QueueTicketStatus[]; includeDone?: boolean } = {}): Promise<QueueList> {
    const params = new URLSearchParams();
    if (filters.departmentId) params.append('departmentId', filters.departmentId);
    if (filters.doctorId) params.append('doctorId', filters.doctorId);
    if (filters.date) params.append('date', filters.date);
    if (filters.status?.length) params.append('status', filters.status.join(','));
    if (filters.includeDone !== undefined) params.append('includeDone', String(filters.includeDone));
    return this.data<QueueList>(`/api/queue?${params.toString()}`);
  }

  async getQueueTicket(id: string): Promise<QueueTicket> {
    return this.data<QueueTicket>(`/api/queue/tickets/${id}`);
  }

  async createQueueTicket(data: CreateQueueTicketInput): Promise<QueueTicket> {
    return this.data<QueueTicket>('/api/queue/tickets', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateQueueTicket(id: string, data: QueueTicketAction): Promise<QueueTicket> {
    return this.data<QueueTicket>(`/api/queue/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async callNextInQueue(data: { departmentId: string; doctorId?: string; room: string }): Promise<QueueTicket> {
    return this.data<QueueTicket>('/api/queue/call-next', { method: 'POST', body: JSON.stringify(data) });
  }

  async getQueueStats(filters: { departmentId?: string; date?: string } = {}): Promise<QueueStats> {
    const params = new URLSearchParams();
    if (filters.departmentId) params.append('departmentId', filters.departmentId);
    if (filters.date) params.append('date', filters.date);
    return this.data<QueueStats>(`/api/queue/stats?${params.toString()}`);
  }

  async scoreTriage(data: TriageInput): Promise<TriageScore> {
    return this.data<TriageScore>('/api/triage/score', { method: 'POST', body: JSON.stringify(data) });
  }

  async triageTicket(id: string, data: TriageInput & { level: TriageLevel; overrideReason?: string; notes?: string }): Promise<{ ticket: QueueTicket; assessment: TriageSummary }> {
    return this.data<{ ticket: QueueTicket; assessment: TriageSummary }>(`/api/queue/tickets/${id}/triage`, { method: 'POST', body: JSON.stringify(data) });
  }

  async createQueueDisplayToken(departmentId?: string): Promise<{ token: string; expiresAt: string; path: string }> {
    return this.data<{ token: string; expiresAt: string; path: string }>('/api/queue/display-token', {
      method: 'POST',
      body: JSON.stringify(departmentId ? { departmentId } : {}),
    });
  }

  /** Waiting-room screen: public, authorised by its display link only (never sends a session token) */
  async getQueueDisplay(token: string): Promise<QueueDisplayData> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/queue/display?token=${encodeURIComponent(token)}`);
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) {
      throw new ApiError(localizeServerMessage(body.error || body.message || 'Request failed'), response.status);
    }
    return body.data as QueueDisplayData;
  }

  async getMyQueueTicket(): Promise<MyQueueTicket | null> {
    return (await this.data<{ ticket: MyQueueTicket | null }>('/api/queue/my-ticket')).ticket;
  }

  // Inpatient care: wards & beds
  async getWards(filters: { active?: boolean } = {}): Promise<WardBoard> {
    const params = new URLSearchParams();
    if (filters.active !== undefined) params.append('active', String(filters.active));
    return this.data<WardBoard>(`/api/wards?${params.toString()}`);
  }

  async createWard(data: WardInput): Promise<Ward> {
    return this.data<Ward>('/api/wards', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateWard(id: string, data: Partial<WardInput> & { isActive?: boolean }): Promise<Ward> {
    return this.data<Ward>(`/api/wards/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async addBeds(wardId: string, data: { labels: string[]; dailyRate?: number }): Promise<unknown> {
    return this.data<unknown>(`/api/wards/${wardId}/beds`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateBed(id: string, data: { status?: Exclude<BedStatus, 'OCCUPIED'>; notes?: string | null; isActive?: boolean; dailyRate?: number | null }): Promise<unknown> {
    return this.data<unknown>(`/api/beds/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  // Inpatient care: admissions
  async getAdmissions(filters: { status?: AdmissionStatus; wardId?: string; doctorId?: string; patientId?: string; search?: string; page?: number; limit?: number } = {}): Promise<AdmissionsResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params.append(key, String(value));
    }
    return this.data<AdmissionsResponse>(`/api/admissions?${params.toString()}`);
  }

  async getMyAdmissions(): Promise<MyAdmissions> {
    return this.data<MyAdmissions>('/api/admissions/mine');
  }

  async getAdmission(id: string): Promise<AdmissionDetail> {
    return this.data<AdmissionDetail>(`/api/admissions/${id}`);
  }

  async createAdmission(data: CreateAdmissionInput): Promise<AdmissionDetail> {
    return this.data<AdmissionDetail>('/api/admissions', { method: 'POST', body: JSON.stringify(data) });
  }

  async transferAdmission(id: string, data: { bedId: string; reason: string }): Promise<AdmissionDetail> {
    return this.data<AdmissionDetail>(`/api/admissions/${id}/transfer`, { method: 'POST', body: JSON.stringify(data) });
  }

  async dischargeAdmission(id: string, data: DischargeInput): Promise<AdmissionDetail> {
    return this.data<AdmissionDetail>(`/api/admissions/${id}/discharge`, { method: 'POST', body: JSON.stringify(data) });
  }

  async cancelAdmission(id: string, reason: string): Promise<AdmissionDetail> {
    return this.data<AdmissionDetail>(`/api/admissions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  /** Download the discharge summary PDF in the current UI language; resolves to the file name */
  async downloadDischargeSummary(id: string, lang: 'fr' | 'en'): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/admissions/${id}/discharge-summary?format=pdf&lang=${lang}`, {
        headers: this.authHeaders(),
      });
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(localizeServerMessage(data.error || data.message || 'Request failed'), response.status);
    }
    const fileName = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || `compte-rendu-sortie-${id}.pdf`;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return fileName;
  }

  async getAdmissionBill(id: string): Promise<AdmissionBill> {
    return this.data<AdmissionBill>(`/api/admissions/${id}/bill`);
  }

  async createAdmissionInvoice(id: string): Promise<AdmissionDetail> {
    return this.data<AdmissionDetail>(`/api/admissions/${id}/invoice`, { method: 'POST', body: JSON.stringify({}) });
  }

  // Inpatient care: charting
  async getAdmissionNotes(id: string, type?: ProgressNoteType): Promise<ProgressNote[]> {
    const query = type ? `?type=${type}` : '';
    return (await this.data<{ notes: ProgressNote[] }>(`/api/admissions/${id}/notes${query}`)).notes;
  }

  async addAdmissionNote(id: string, data: { type: ProgressNoteType; note: string; vitals?: InpatientVitals }): Promise<ProgressNote> {
    return this.data<ProgressNote>(`/api/admissions/${id}/notes`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getMedicationOrders(id: string, status?: MedicationOrderStatus): Promise<MedicationOrder[]> {
    const query = status ? `?status=${status}` : '';
    return (await this.data<{ orders: MedicationOrder[] }>(`/api/admissions/${id}/orders${query}`)).orders;
  }

  async createMedicationOrder(id: string, data: CreateMedicationOrderInput): Promise<MedicationOrder> {
    return this.data<MedicationOrder>(`/api/admissions/${id}/orders`, { method: 'POST', body: JSON.stringify(data) });
  }

  async stopMedicationOrder(id: string, orderId: string, reason: string): Promise<MedicationOrder> {
    return this.data<MedicationOrder>(`/api/admissions/${id}/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify({ action: 'stop', reason }) });
  }

  async getMar(id: string, date?: string): Promise<MarDay> {
    const query = date ? `?date=${date}` : '';
    return this.data<MarDay>(`/api/admissions/${id}/mar${query}`);
  }

  async recordAdministration(id: string, data: RecordAdministrationInput): Promise<MarAdministration> {
    return this.data<MarAdministration>(`/api/admissions/${id}/administrations`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getWardMar(wardId: string, date?: string): Promise<WardMar> {
    const params = new URLSearchParams({ wardId });
    if (date) params.append('date', date);
    return this.data<WardMar>(`/api/mar/ward?${params.toString()}`);
  }

  async getAdmissionCharges(id: string): Promise<{ charges: AdmissionCharge[]; total: number }> {
    return this.data<{ charges: AdmissionCharge[]; total: number }>(`/api/admissions/${id}/charges`);
  }

  async addAdmissionCharge(id: string, data: { category: Exclude<ChargeCategory, 'BED'>; description: string; quantity: number; unitPrice: number }): Promise<AdmissionCharge> {
    return this.data<AdmissionCharge>(`/api/admissions/${id}/charges`, { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteAdmissionCharge(id: string, chargeId: string): Promise<unknown> {
    return this.data<unknown>(`/api/admissions/${id}/charges/${chargeId}`, { method: 'DELETE' });
  }

  async getReceivables(): Promise<Receivables> {
    return this.data<Receivables>('/api/receivables');
  }

  // Pharmacy counter: stock by batch
  async getPharmacyStock(filters: { search?: string; lowStock?: boolean; expiringWithinDays?: number } = {}): Promise<StockMedication[]> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.lowStock) params.append('lowStock', 'true');
    if (filters.expiringWithinDays) params.append('expiringWithinDays', String(filters.expiringWithinDays));
    return (await this.data<{ medications: StockMedication[] }>(`/api/pharmacy/stock?${params.toString()}`)).medications;
  }

  async receivePharmacyStock(data: StockReceiptInput): Promise<unknown> {
    return this.data<unknown>('/api/pharmacy/stock/receipts', { method: 'POST', body: JSON.stringify(data) });
  }

  async adjustPharmacyStock(data: StockAdjustmentInput): Promise<unknown> {
    return this.data<unknown>('/api/pharmacy/stock/adjustments', { method: 'POST', body: JSON.stringify(data) });
  }

  async getStockMovements(filters: { medicationId?: string; batchId?: string; type?: StockMovementType; from?: string; to?: string; page?: number } = {}): Promise<StockMovementsResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.append(key, String(value));
    return this.data<StockMovementsResponse>(`/api/pharmacy/stock/movements?${params.toString()}`);
  }

  async getExpiringBatches(days = 90): Promise<ExpiringBatch[]> {
    return (await this.data<{ batches: ExpiringBatch[] }>(`/api/pharmacy/stock/expiring?days=${days}`)).batches;
  }

  // Pharmacy counter: till sessions
  async openCashSession(openingFloat: number): Promise<CashSessionSummary> {
    return this.data<CashSessionSummary>('/api/pharmacy/sessions', { method: 'POST', body: JSON.stringify({ openingFloat }) });
  }

  async getCurrentCashSession(): Promise<CashSessionSummary | null> {
    return (await this.data<{ session: CashSessionSummary | null }>('/api/pharmacy/sessions/current')).session;
  }

  async getCashSessions(page = 1): Promise<CashSessionSummary[]> {
    return (await this.data<{ sessions: CashSessionSummary[] }>(`/api/pharmacy/sessions?page=${page}`)).sessions;
  }

  async getCashSession(id: string): Promise<CashSessionDetail> {
    return this.data<CashSessionDetail>(`/api/pharmacy/sessions/${id}`);
  }

  async closeCashSession(id: string, data: { countedCash: number; notes?: string }): Promise<CashSessionSummary> {
    return this.data<CashSessionSummary>(`/api/pharmacy/sessions/${id}/close`, { method: 'POST', body: JSON.stringify(data) });
  }

  // Pharmacy counter: sales
  async quotePharmacySale(data: { items: Array<{ medicationId: string; quantity: number }>; prescriptionId?: string; patientId?: string }): Promise<SaleQuote> {
    return this.data<SaleQuote>('/api/pharmacy/sales/quote', { method: 'POST', body: JSON.stringify(data) });
  }

  async createPharmacySale(data: CreatePharmacySaleInput): Promise<PharmacySale> {
    return this.data<PharmacySale>('/api/pharmacy/sales', { method: 'POST', body: JSON.stringify(data) });
  }

  async getPharmacySales(filters: { from?: string; to?: string; search?: string; sessionId?: string; page?: number } = {}): Promise<PharmacySalesResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.append(key, String(value));
    return this.data<PharmacySalesResponse>(`/api/pharmacy/sales?${params.toString()}`);
  }

  async getPharmacySale(id: string): Promise<PharmacySale> {
    return this.data<PharmacySale>(`/api/pharmacy/sales/${id}`);
  }

  async voidPharmacySale(id: string, reason: string): Promise<PharmacySale> {
    return this.data<PharmacySale>(`/api/pharmacy/sales/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  async returnPharmacySale(id: string, data: PharmacyReturnInput): Promise<PharmacyReturnSummary & { lines?: Array<{ saleItemId: string; quantity: number; restocked: boolean }>; sale?: PharmacySale }> {
    return this.data(`/api/pharmacy/sales/${id}/returns`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getMyPharmacySales(): Promise<PharmacySale[]> {
    const data = await this.data<{ sales: PharmacySale[] } | PharmacySale[]>('/api/pharmacy/sales/mine');
    return Array.isArray(data) ? data : data.sales;
  }

  async getPendingPharmacyPrescriptions(): Promise<PendingPrescription[]> {
    const data = await this.data<{ prescriptions: PendingPrescription[] } | PendingPrescription[]>('/api/pharmacy/prescriptions/pending');
    return Array.isArray(data) ? data : data.prescriptions;
  }

  async getPharmacyDailyReport(date?: string): Promise<PharmacyDailyReport> {
    return this.data<PharmacyDailyReport>(`/api/pharmacy/reports/daily${date ? `?date=${date}` : ''}`);
  }

  /** Fetch a pharmacy PDF (receipt, Z report) with the session token and open it in a new tab */
  async openPharmacyPdf(kind: 'receipt' | 'session-report', id: string, lang: 'fr' | 'en' = 'fr'): Promise<void> {
    const path = kind === 'receipt' ? `/api/pharmacy/sales/${id}/receipt?format=pdf&lang=${lang}` : `/api/pharmacy/sessions/${id}/report?format=pdf&lang=${lang}`;
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { headers: this.authHeaders() });
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(localizeServerMessage(data.error || data.message || 'Request failed'), response.status);
    }
    const url = URL.createObjectURL(await response.blob());
    const opened = window.open(url, '_blank');
    if (!opened) {
      // Pop-up blocked: download instead
      const fileName = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || `${kind}-${id}.pdf`;
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // Medical documents
  async createMedicalDocument(data: CreateMedicalDocumentInput): Promise<MedicalDocument> {
    return this.data<MedicalDocument>('/api/documents', { method: 'POST', body: JSON.stringify(data) });
  }

  async getMedicalDocuments(filters: MedicalDocumentFilters = {}): Promise<MedicalDocumentsResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.append(key, String(value));
    return this.data<MedicalDocumentsResponse>(`/api/documents?${params.toString()}`);
  }

  async getMedicalDocument(id: string): Promise<MedicalDocument> {
    return this.data<MedicalDocument>(`/api/documents/${id}`);
  }

  async getMyMedicalDocuments(): Promise<MedicalDocument[]> {
    return (await this.data<{ documents: MedicalDocument[] }>('/api/documents/mine')).documents;
  }

  async revokeMedicalDocument(id: string, reason: string): Promise<MedicalDocument> {
    return this.data<MedicalDocument>(`/api/documents/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  async acknowledgeReferral(id: string, note?: string): Promise<MedicalDocument> {
    return this.data<MedicalDocument>(`/api/documents/${id}/acknowledge`, { method: 'POST', body: JSON.stringify(note ? { note } : {}) });
  }

  async recordReferralFeedback(id: string, data: { feedback: string; feedbackFrom?: string; receivedAt?: string }): Promise<MedicalDocument> {
    return this.data<MedicalDocument>(`/api/documents/${id}/feedback`, { method: 'POST', body: JSON.stringify(data) });
  }

  async cancelReferral(id: string, reason: string): Promise<MedicalDocument> {
    return this.data<MedicalDocument>(`/api/documents/${id}/referral-status`, { method: 'POST', body: JSON.stringify({ status: 'CANCELLED', reason }) });
  }

  async getPendingReferrals(): Promise<PendingReferrals> {
    const data = await this.data<PendingReferrals | (MedicalDocument[] & { counts?: PendingReferrals['counts'] })>('/api/documents/referrals/pending');
    // Accept either { referrals, counts } or a bare list
    if (Array.isArray(data)) return { referrals: data, counts: data.counts ?? { sent: 0, acknowledged: 0, overdue: 0 } };
    return { referrals: data.referrals ?? [], counts: data.counts ?? { sent: 0, acknowledged: 0, overdue: 0 } };
  }

  /** Public: check a certificate's verification code (no session token sent) */
  async verifyMedicalDocument(code: string): Promise<DocumentVerification> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/documents/verify/${encodeURIComponent(code)}`);
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) {
      throw new ApiError(localizeServerMessage(body.error || body.message || 'Request failed'), response.status);
    }
    return body.data as DocumentVerification;
  }

  /** Open a document's PDF (sick leave: employer copy without the medical reason, or patient copy) */
  async openMedicalDocumentPdf(id: string, options: { lang?: 'fr' | 'en'; copy?: 'patient' | 'employer' } = {}): Promise<void> {
    const params = new URLSearchParams({ lang: options.lang ?? 'fr' });
    if (options.copy) params.append('copy', options.copy);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/documents/${id}/pdf?${params.toString()}`, { headers: this.authHeaders() });
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(localizeServerMessage(data.error || data.message || 'Request failed'), response.status);
    }
    const url = URL.createObjectURL(await response.blob());
    const opened = window.open(url, '_blank');
    if (!opened) {
      const fileName = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || `document-${id}.pdf`;
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---- Imaging (radiology) ----
  async getImagingExams(filters: { modality?: ImagingModality; active?: boolean } = {}): Promise<ImagingExam[]> {
    const params = new URLSearchParams();
    if (filters.modality) params.append('modality', filters.modality);
    if (filters.active !== undefined) params.append('active', String(filters.active));
    return (await this.data<{ exams: ImagingExam[] }>(`/api/imaging/exams?${params.toString()}`)).exams;
  }

  async createImagingExam(data: ImagingExamInput): Promise<ImagingExam> {
    return this.data<ImagingExam>('/api/imaging/exams', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateImagingExam(id: string, data: Partial<ImagingExamInput>): Promise<ImagingExam> {
    return this.data<ImagingExam>(`/api/imaging/exams/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async createImagingOrder(data: CreateImagingOrderInput): Promise<ImagingOrder> {
    return this.data<ImagingOrder>('/api/imaging/orders', { method: 'POST', body: JSON.stringify(data) });
  }

  async getImagingOrders(filters: ImagingOrderFilters = {}): Promise<ImagingOrdersResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.append(key, String(value));
    const data = await this.data<ImagingOrdersResponse>(`/api/imaging/orders?${params.toString()}`);
    return { orders: data.orders ?? [], pagination: data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 }, counts: data.counts ?? {} };
  }

  async getImagingOrder(id: string): Promise<ImagingOrder> {
    return this.data<ImagingOrder>(`/api/imaging/orders/${id}`);
  }

  async getMyImagingOrders(): Promise<ImagingOrder[]> {
    return (await this.data<{ orders: ImagingOrder[] }>('/api/imaging/orders/mine')).orders;
  }

  async updateImagingOrder(id: string, body: ImagingOrderAction): Promise<ImagingOrder> {
    return this.data<ImagingOrder>(`/api/imaging/orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async reportImagingOrder(id: string, data: { technique?: string; findings: string; conclusion: string; isCritical?: boolean }): Promise<ImagingOrder> {
    return this.data<ImagingOrder>(`/api/imaging/orders/${id}/report`, { method: 'POST', body: JSON.stringify(data) });
  }

  async addImagingAddendum(id: string, text: string): Promise<ImagingOrder> {
    return this.data<ImagingOrder>(`/api/imaging/orders/${id}/addendum`, { method: 'POST', body: JSON.stringify({ text }) });
  }

  async billImagingOrder(id: string): Promise<{ invoice: { id: string; invoiceNumber: string } }> {
    return this.data<{ invoice: { id: string; invoiceNumber: string } }>(`/api/imaging/orders/${id}/bill`, { method: 'POST' });
  }

  async getImagingStats(date?: string): Promise<ImagingStats> {
    return this.data<ImagingStats>(`/api/imaging/stats${date ? `?date=${encodeURIComponent(date)}` : ''}`);
  }

  /** Upload one file (multipart), reporting progress from 0 to 1 */
  uploadImagingAttachment(orderId: string, file: File, caption: string | undefined, onProgress?: (fraction: number) => void): Promise<ImagingAttachment> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', file);
      if (caption) form.append('caption', caption);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseUrl}/api/imaging/orders/${orderId}/attachments`);
      for (const [name, value] of Object.entries(this.authHeaders())) xhr.setRequestHeader(name, value);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        let body: { success?: boolean; data?: ImagingAttachment; error?: string; message?: string } = {};
        try {
          body = JSON.parse(xhr.responseText || '{}');
        } catch {
          body = {};
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.data) resolve(body.data);
        else reject(new ApiError(localizeServerMessage(body.error || body.message || 'Request failed'), xhr.status));
      };
      xhr.onerror = () => reject(new ApiError(localizeServerMessage('Unable to reach the server'), 0));
      xhr.send(form);
    });
  }

  async deleteImagingAttachment(orderId: string, attachmentId: string): Promise<void> {
    // request() throws on any error status; a success may come without data
    await this.request<unknown>(`/api/imaging/orders/${orderId}/attachments/${attachmentId}`, { method: 'DELETE' });
  }

  /** Fetch a protected file (image, PDF) with the session token as an object URL */
  async fetchImagingBlobUrl(path: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { headers: this.authHeaders() });
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(localizeServerMessage(data.error || data.message || 'Request failed'), response.status);
    }
    return URL.createObjectURL(await response.blob());
  }

  imagingAttachmentPath(orderId: string, attachmentId: string): string {
    return `/api/imaging/orders/${orderId}/attachments/${attachmentId}`;
  }

  /** Open the signed report PDF in a new tab (download when pop-ups are blocked) */
  async openImagingReportPdf(id: string, lang: 'fr' | 'en' = 'fr'): Promise<void> {
    const url = await this.fetchImagingBlobUrl(`/api/imaging/orders/${id}/pdf?lang=${lang}`);
    const opened = window.open(url, '_blank');
    if (!opened) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `compte-rendu-imagerie-${id}.pdf`;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // Invoice methods
  async getInvoices(filters: { search?: string; status?: InvoiceStatus; patientId?: string; payerId?: string; insured?: boolean; startDate?: string; endDate?: string; page?: number; limit?: number } = {}): Promise<InvoicesResponse> {
    const params = new URLSearchParams();
    if (filters.payerId) params.append('payerId', filters.payerId);
    if (filters.insured !== undefined) params.append('insured', String(filters.insured));
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<InvoicesResponse>(`/api/invoices?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch invoices');
  }

  async getInvoice(id: string): Promise<InvoiceDetail> {
    const response = await this.request<InvoiceDetail>(`/api/invoices/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch invoice');
  }

  async createInvoice(data: { patientId: string; items: InvoiceItemInput[]; tax?: number; discount?: number; dueDate?: string; notes?: string; coverageId?: string | null; useCoverage?: boolean; preAuthId?: string }): Promise<Invoice> {
    const response = await this.request<Invoice>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create invoice');
  }

  async updateInvoice(id: string, data: { status?: InvoiceStatus; tax?: number; discount?: number; dueDate?: string; notes?: string }): Promise<Invoice> {
    const response = await this.request<Invoice>(`/api/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update invoice');
  }

  async addPayment(invoiceId: string, data: { amount: number; method: PaymentMethod; referenceNumber?: string; notes?: string; processedBy: string }): Promise<void> {
    const response = await this.request(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.success) {
      throw new Error('Failed to add payment');
    }
  }

  async deleteInvoice(id: string): Promise<void> {
    const response = await this.request(`/api/invoices/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to delete invoice');
    }
  }

  // Payment methods
  async getPayments(filters: { search?: string; method?: PaymentMethod; startDate?: string; endDate?: string; page?: number; limit?: number } = {}): Promise<PaymentsResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.method) params.append('method', filters.method);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<PaymentsResponse>(`/api/payments?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch payments');
  }

  async getPaymentStats(filters: { startDate?: string; endDate?: string; period?: 'day' | 'week' | 'month' | 'year' } = {}): Promise<PaymentStats> {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.period) params.append('period', filters.period);

    const response = await this.request<PaymentStats>(`/api/payments/stats?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch payment statistics');
  }

  // Prescription methods
  async getPrescriptions(filters: { search?: string; status?: PrescriptionStatus; patientId?: string; doctorId?: string; page?: number; limit?: number } = {}): Promise<PrescriptionsResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.doctorId) params.append('doctorId', filters.doctorId);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<PrescriptionsResponse>(`/api/prescriptions?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch prescriptions');
  }

  async getPrescription(id: string): Promise<Prescription> {
    const response = await this.request<Prescription>(`/api/prescriptions/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch prescription');
  }

  async getPrescriptionDetail(id: string): Promise<PrescriptionDetail> {
    const response = await this.request<PrescriptionDetail>(`/api/prescriptions/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch prescription details');
  }

  async createPrescription(data: { patientId: string; doctorId: string; consultationId?: string; notes?: string; items: Array<{ medicationId: string; dosage: string; frequency: string; duration: string; quantity: number; instructions?: string }> }): Promise<Prescription> {
    const response = await this.request<Prescription>('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create prescription');
  }

  async dispensePrescription(id: string, data: { itemIds: string[]; dispensedBy: string }): Promise<void> {
    const response = await this.request(`/api/prescriptions/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.success) {
      throw new Error('Failed to dispense prescription');
    }
  }

  async cancelPrescription(id: string): Promise<void> {
    const response = await this.request(`/api/prescriptions/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to cancel prescription');
    }
  }

  // User management methods
  async getUsers(filters: { search?: string; role?: string; isActive?: boolean; page?: number; limit?: number } = {}): Promise<UsersResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.role) params.append('role', filters.role);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<UsersResponse>(`/api/users?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch users');
  }

  async getUser(id: string): Promise<UserDetail> {
    const response = await this.request<UserDetail>(`/api/users/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch user');
  }

  async createUser(data: { email: string; password: string; firstName: string; lastName: string; phoneNumber: string; role: string; isActive?: boolean }): Promise<UserDetail> {
    const response = await this.request<UserDetail>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create user');
  }

  async updateUser(id: string, data: Partial<{ email: string; password: string; firstName: string; lastName: string; phoneNumber: string; role: string; isActive: boolean }>): Promise<UserDetail> {
    const response = await this.request<UserDetail>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update user');
  }

  async deactivateUser(id: string): Promise<void> {
    const response = await this.request(`/api/users/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to deactivate user');
    }
  }

  // Reset user password - generates a new temporary password
  async resetUserPassword(id: string): Promise<{ temporaryPassword: string }> {
    const response = await this.request<{ temporaryPassword: string }>(`/api/users/${id}/reset-password`, {
      method: 'POST',
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to reset password');
  }

  // Change password - for first login or user-initiated password change
  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ success: boolean }> {
    const response = await this.request<{ success: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success) {
      return { success: true };
    }
    throw new Error('Failed to change password');
  }

  // Create patient with user account - generates PatientID and temporary password
  async createPatientWithAccount(data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    gender: string;
    bloodType?: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    emergencyName: string;
    emergencyRelation: string;
    emergencyPhone: string;
    allergies?: string[];
    chronicConditions?: string[];
    notes?: string;
    insurance?: {
      provider: string;
      policyNumber: string;
      groupNumber?: string;
      validFrom: string;
      validUntil: string;
      coverageType: string;
    };
    createUserAccount: boolean;
    consents: Array<{ type: ConsentType; granted: boolean; method: 'SIGNED_FORM' | 'VERBAL' }>;
  }): Promise<{
    patient: Patient;
    user?: UserDetail;
    temporaryPassword?: string;
  }> {
    const response = await this.request<{
      patient: Patient;
      user?: UserDetail;
      temporaryPassword?: string;
    }>('/api/patients/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || response.error || 'Failed to register patient');
  }

  // Report methods
  async getReports(type: 'overview' | 'financial' | 'appointments' | 'pharmacy' | 'laboratory', filters: { startDate?: string; endDate?: string } = {}): Promise<ReportData> {
    const params = new URLSearchParams();
    params.append('type', type);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await this.request<ReportData>(`/api/reports?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch reports');
  }

  // Consultation methods
  async getConsultations(filters: { search?: string; patientId?: string; doctorId?: string; startDate?: string; endDate?: string; page?: number; limit?: number } = {}): Promise<ConsultationsResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.doctorId) params.append('doctorId', filters.doctorId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<ConsultationsResponse>(`/api/consultations?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch consultations');
  }

  async getConsultation(id: string): Promise<ConsultationDetail> {
    const response = await this.request<ConsultationDetail>(`/api/consultations/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch consultation');
  }

  async createConsultation(data: { appointmentId: string; chiefComplaint: string; symptoms?: string[]; examination?: string; diagnosis?: string[]; diagnosisCodes?: string[]; treatmentPlan?: string; notes?: string; followUpDate?: string }): Promise<Consultation> {
    const response = await this.request<Consultation>('/api/consultations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create consultation');
  }

  async updateConsultation(id: string, data: Partial<{ chiefComplaint: string; symptoms: string[]; examination: string; diagnosis: string[]; diagnosisCodes: string[]; treatmentPlan: string; notes: string; followUpDate: string | null }>): Promise<Consultation> {
    const response = await this.request<Consultation>(`/api/consultations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update consultation');
  }

  async deleteConsultation(id: string): Promise<void> {
    const response = await this.request(`/api/consultations/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to delete consultation');
    }
  }

  // Vitals methods
  async getVitals(filters: { patientId?: string; startDate?: string; endDate?: string; page?: number; limit?: number } = {}): Promise<VitalsResponse> {
    const params = new URLSearchParams();
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<VitalsResponse>(`/api/vitals?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch vitals');
  }

  async createVitals(data: {
    patientId: string;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
    recordedBy: string;
    notes?: string;
  }): Promise<VitalSign> {
    const response = await this.request<VitalSign>('/api/vitals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create vitals');
  }

  // Inventory methods
  async getInventory(filters: { search?: string; category?: string; lowStock?: boolean; supplierId?: string; page?: number; limit?: number } = {}): Promise<InventoryResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.lowStock) params.append('lowStock', 'true');
    if (filters.supplierId) params.append('supplierId', filters.supplierId);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<InventoryResponse>(`/api/inventory?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch inventory');
  }

  async getInventoryItem(id: string): Promise<InventoryItemDetail> {
    const response = await this.request<InventoryItemDetail>(`/api/inventory/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch inventory item');
  }

  async createInventoryItem(data: { name: string; sku: string; category: string; description?: string; unit: string; unitPrice: number; quantity?: number; reorderLevel?: number; location?: string; supplierId?: string; expiryDate?: string }): Promise<InventoryItem> {
    const response = await this.request<InventoryItem>('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create inventory item');
  }

  async updateInventoryItem(id: string, data: Partial<{ name: string; category: string; description: string; unit: string; unitPrice: number; reorderLevel: number; location: string; supplierId: string | null; expiryDate: string | null; isActive: boolean }>): Promise<InventoryItem> {
    const response = await this.request<InventoryItem>(`/api/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update inventory item');
  }

  async deleteInventoryItem(id: string): Promise<void> {
    const response = await this.request(`/api/inventory/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to delete inventory item');
    }
  }

  async updateInventoryStock(id: string, data: { quantity: number; reason: string; type?: 'ADJUSTMENT' | 'RECEIVED' | 'DISPENSED' | 'DAMAGED' | 'EXPIRED' | 'RETURNED' }): Promise<{ item: { id: string; name: string; quantity: number; previousQuantity: number; isLowStock: boolean }; transaction: { id: string; type: string; quantity: number; reason: string; performedAt: string } }> {
    const response = await this.request<{ item: { id: string; name: string; quantity: number; previousQuantity: number; isLowStock: boolean }; transaction: { id: string; type: string; quantity: number; reason: string; performedAt: string } }>(`/api/inventory/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update inventory stock');
  }

  // Supplier methods
  async getSuppliers(filters: { search?: string; isActive?: boolean; page?: number; limit?: number } = {}): Promise<SuppliersResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.request<SuppliersResponse>(`/api/suppliers?${params.toString()}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch suppliers');
  }

  async getSupplier(id: string): Promise<SupplierDetail> {
    const response = await this.request<SupplierDetail>(`/api/suppliers/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to fetch supplier');
  }

  async createSupplier(data: { name: string; contactName?: string; email?: string; phone: string; address?: string }): Promise<Supplier> {
    const response = await this.request<Supplier>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create supplier');
  }

  async updateSupplier(id: string, data: Partial<{ name: string; contactName: string | null; email: string | null; phone: string; address: string | null; isActive: boolean }>): Promise<Supplier> {
    const response = await this.request<Supplier>(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to update supplier');
  }

  async deleteSupplier(id: string): Promise<void> {
    const response = await this.request(`/api/suppliers/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to delete supplier');
    }
  }

  // Notifications
  async getNotifications(filters?: NotificationFilters): Promise<NotificationsResponse> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.unread) params.append('unread', 'true');

    const query = params.toString();
    const url = `/api/notifications${query ? `?${query}` : ''}`;

    const response = await this.request<NotificationsResponse>(url);
    if (!response.success || !response.data) {
      throw new Error('Failed to fetch notifications');
    }
    return response.data;
  }

  async createNotification(data: CreateNotificationInput): Promise<Notification> {
    const response = await this.request<{ notification?: Notification; count?: number }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.success) {
      throw new Error('Failed to create notification');
    }
    return response.data?.notification || ({} as Notification);
  }

  async markNotificationAsRead(id: string): Promise<void> {
    const response = await this.request(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    });
    if (!response.success) {
      throw new Error('Failed to mark notification as read');
    }
  }

  async markAllNotificationsAsRead(): Promise<{ count: number }> {
    const response = await this.request<{ count: number }>('/api/notifications', {
      method: 'PUT',
    });
    if (!response.success) {
      throw new Error('Failed to mark all notifications as read');
    }
    return response.data || { count: 0 };
  }

  async deleteNotification(id: string): Promise<void> {
    const response = await this.request(`/api/notifications/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error('Failed to delete notification');
    }
  }

  async deleteAllNotifications(all = false): Promise<{ count: number }> {
    const response = await this.request<{ count: number }>(`/api/notifications${all ? '?all=true' : ''}`, {
      method: 'DELETE',
    });
    if (!response.success) {
      throw new Error('Failed to delete notifications');
    }
    return response.data || { count: 0 };
  }

  /** Public request (no session token, no family header) for pages reached from an SMS link */
  private async publicData<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      });
    } catch {
      throw new ApiError(localizeServerMessage('Unable to reach the server'), 0);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      throw new ApiError(localizeServerMessage(body.error || body.message || 'Request failed'), response.status);
    }
    return body.data as T;
  }

  // Family access (proxy)
  async getMyProxies(): Promise<MyProxies> {
    const data = await this.data<Partial<MyProxies>>('/api/proxies/mine');
    return { actingFor: data.actingFor ?? [], grantedTo: data.grantedTo ?? [] };
  }

  async grantMyRecordAccess(data: GrantProxyInput): Promise<GrantedToLink> {
    return this.data<GrantedToLink>('/api/proxies/mine', { method: 'POST', body: JSON.stringify(data) });
  }

  async removeMyProxyLink(linkId: string): Promise<void> {
    await this.request(`/api/proxies/mine/${linkId}`, { method: 'DELETE' });
  }

  async getProxyLinks(filters: { patientId?: string; proxyUserId?: string; status?: ProxyStatus } = {}): Promise<ProxyLink[]> {
    const params = new URLSearchParams();
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.proxyUserId) params.append('proxyUserId', filters.proxyUserId);
    if (filters.status) params.append('status', filters.status);
    const data = await this.data<{ links?: ProxyLink[]; proxies?: ProxyLink[] } | ProxyLink[]>(`/api/proxies?${params.toString()}`);
    if (Array.isArray(data)) return data;
    return data.links ?? data.proxies ?? [];
  }

  async createProxyLink(data: CreateProxyInput): Promise<ProxyLink> {
    return this.data<ProxyLink>('/api/proxies', { method: 'POST', body: JSON.stringify(data) });
  }

  async revokeProxyLink(id: string, reason: string): Promise<ProxyLink> {
    return this.data<ProxyLink>(`/api/proxies/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  // Visit feedback
  async getFeedbackSurvey(token: string): Promise<FeedbackSurvey> {
    return this.publicData<FeedbackSurvey>(`/api/feedback/survey/${encodeURIComponent(token)}`);
  }

  async submitFeedbackSurvey(token: string, data: FeedbackSurveyInput): Promise<void> {
    await this.publicData<unknown>(`/api/feedback/survey/${encodeURIComponent(token)}`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getMyFeedback(): Promise<MyFeedback> {
    const data = await this.data<Partial<MyFeedback> & { feedbacks?: MyFeedbackItem[] } | MyFeedbackItem[]>('/api/feedback/mine');
    // Accept { pending, submitted }, { feedbacks } or a bare list
    const list = Array.isArray(data) ? data : data.feedbacks;
    if (list) {
      return { pending: list.filter((f) => !f.submittedAt), submitted: list.filter((f) => Boolean(f.submittedAt)) };
    }
    const shaped = data as Partial<MyFeedback>;
    return { pending: shaped.pending ?? [], submitted: shaped.submitted ?? [] };
  }

  async getFeedbacks(filters: FeedbackFilters = {}): Promise<FeedbackListResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
    }
    const data = await this.data<Partial<FeedbackListResponse>>(`/api/feedback?${params.toString()}`);
    return {
      feedbacks: data.feedbacks ?? [],
      pagination: data.pagination ?? { page: 1, limit: data.feedbacks?.length ?? 0, total: data.feedbacks?.length ?? 0, totalPages: 1 },
    };
  }

  async getFeedbackSummary(filters: { from?: string; to?: string; departmentId?: string } = {}): Promise<FeedbackSummary> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.append(key, value);
    return this.data<FeedbackSummary>(`/api/feedback/summary?${params.toString()}`);
  }

  async getFeedback(id: string): Promise<FeedbackEntry> {
    return this.data<FeedbackEntry>(`/api/feedback/${id}`);
  }

  async updateFeedback(id: string, data: { status?: FeedbackStatus; assignedToId?: string | null; response?: string }): Promise<FeedbackEntry> {
    return this.data<FeedbackEntry>(`/api/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  // Appointment confirmation
  async getAppointmentConfirmation(token: string): Promise<AppointmentConfirmationInfo> {
    return this.publicData<AppointmentConfirmationInfo>(`/api/appointments/confirm/${encodeURIComponent(token)}`);
  }

  async respondToAppointmentConfirmation(token: string, action: 'confirm' | 'cancel', reason?: string): Promise<AppointmentConfirmationInfo | null> {
    const data = await this.publicData<AppointmentConfirmationInfo | null>(`/api/appointments/confirm/${encodeURIComponent(token)}`, {
      method: 'POST',
      body: JSON.stringify(reason ? { action, reason } : { action }),
    });
    return data ?? null;
  }

  /** Patient (or family) confirms from the portal; the desk records a phone or desk confirmation */
  async confirmAppointment(id: string, channel?: 'PHONE' | 'DESK'): Promise<void> {
    await this.request(`/api/appointments/${id}/confirm`, { method: 'POST', body: JSON.stringify(channel ? { channel } : {}) });
  }

  /** Test tool (not in live messaging mode): play a patient's SMS reply */
  async simulateInboundSms(data: { from: string; text: string }): Promise<InboundSmsResult> {
    return (await this.data<InboundSmsResult | null>('/api/dev/messages/inbound', { method: 'POST', body: JSON.stringify(data) })) ?? {};
  }
}

export const api = new ApiClient(API_URL);
export type {
  LabResultType,
  LabResultStatus,
  LabReferenceRange,
  LabSample,
  LabSampleStatus,
  LabOrderDetail,
  LabOrderDetailItem,
  LabWorklistOrder,
  LabWorklist,
  LabStats,
  LabSampleLookup,
  LabHistoryEntry,
  ProxyRelationship,
  ProxyAccessLevel,
  ProxyStatus,
  ProxyPatientSummary,
  ActingForLink,
  GrantedToLink,
  MyProxies,
  GrantProxyInput,
  ProxyLink,
  CreateProxyInput,
  FeedbackStatus,
  FeedbackVisitKind,
  FeedbackVisit,
  FeedbackSurvey,
  FeedbackSurveyInput,
  MyFeedbackItem,
  MyFeedback,
  FeedbackEntry,
  FeedbackFilters,
  FeedbackListResponse,
  FeedbackAverages,
  FeedbackSummary,
  AppointmentConfirmationInfo,
  InboundSmsResult,
  ImagingModality,
  ImagingOrderStatus,
  ImagingPriority,
  PregnancyStatus,
  ImagingExam,
  ImagingExamInput,
  ImagingAddendum,
  ImagingAttachment,
  ImagingOrder,
  ImagingOrderSummary,
  ImagingOrdersResponse,
  ImagingOrderFilters,
  CreateImagingOrderInput,
  ImagingOrderAction,
  ImagingStats,
  MedicalDocument,
  MedicalDocumentType,
  MedicalDocumentStatus,
  ReferralStatus,
  ReferralUrgency,
  CertificateKind,
  CreateMedicalDocumentInput,
  MedicalDocumentFilters,
  MedicalDocumentsResponse,
  PendingReferrals,
  DocumentVerification,
  SalePaymentMethod,
  PharmacySaleStatus,
  StockMovementType,
  StockAdjustmentType,
  CashSessionStatus,
  MethodTotals,
  StockBatch,
  StockMedication,
  StockReceiptInput,
  StockAdjustmentInput,
  StockMovementEntry,
  StockMovementsResponse,
  ExpiringBatch,
  CashSessionTotals,
  CashSessionSummary,
  CashSessionDetail,
  PharmacySaleSummary,
  PharmacyReturnSummary,
  PharmacySaleItem,
  PharmacySale,
  SaleQuoteLine,
  SaleQuote,
  CreatePharmacySaleInput,
  PharmacySalesResponse,
  PendingPrescriptionItem,
  PendingPrescription,
  PharmacyReturnInput,
  PharmacyDailyReport,
  WardType,
  WardGender,
  BedStatus,
  AdmissionSource,
  AdmissionStatus,
  DischargeType,
  ProgressNoteType,
  MedicationOrderStatus,
  AdministrationStatus,
  DoseStatus,
  ChargeCategory,
  MedicationRoute,
  BedOccupant,
  WardBed,
  WardCounts,
  Ward,
  WardBoard,
  WardInput,
  InpatientVitals,
  AdmissionSummary,
  BedAssignmentEntry,
  AdmissionDetail,
  AdmissionsResponse,
  CreateAdmissionInput,
  DischargeInput,
  ProgressNote,
  MedicationOrder,
  CreateMedicationOrderInput,
  MarAdministration,
  MarDose,
  MarDay,
  RecordAdministrationInput,
  WardMarItem,
  WardMar,
  AdmissionCharge,
  AdmissionBillLine,
  AdmissionBill,
  MyAdmissions,
  VisitSource,
  QueueTicketStatus,
  TriageLevel,
  TriageMobility,
  TriageAvpu,
  TriageSummary,
  QueueTicket,
  QueueList,
  QueueStats,
  CreateQueueTicketInput,
  QueueTicketAction,
  TriageVitalsInput,
  TriageInput,
  TriageScore,
  QueueDisplayData,
  MyQueueTicket,
  PayerType,
  BillingCategory,
  CoverageRelationship,
  PreAuthStatus,
  ClaimStatus,
  ClaimLineStatus,
  PayerCoverageRule,
  Payer,
  PayerInput,
  PatientCoverage,
  PatientCoverageInput,
  PreAuthorization,
  PreAuthAction,
  InvoiceItemInput,
  CoveragePreview,
  ClaimSummary,
  ClaimLine,
  ClaimDetail,
  EligibleClaimInvoice,
  ClaimAction,
  ClaimSettlementInput,
  AgeingBuckets,
  Receivables,
  MobileMoneyProvider,
  MobileMoneyStatus,
  MobileMoneyTransaction,
  MobileMoneyReconciliation,
  MessageChannel,
  MessageStatus,
  OutboundMessage,
  MessagesResponse,
  SystemStatus,
  MfaChallenge,
  ConsentType,
  ConsentMethod,
  ConsentStatus,
  ConsentTexts,
  AuditLogEntry,
  AuditLogsResponse,
  User,
  LoginRequest,
  LoginResponse,
  Patient,
  PatientDetail,
  PatientAppointment,
  PatientPrescription,
  PatientLabResult,
  PatientVital,
  PatientBilling,
  VitalSign,
  VitalsResponse,
  PatientFilters,
  PatientsResponse,
  Doctor,
  DoctorFilters,
  DoctorsResponse,
  DoctorAvailability,
  TimeSlot,
  Appointment,
  AppointmentFilters,
  AppointmentsResponse,
  AppointmentStatus,
  AppointmentType,
  DashboardData,
  DashboardStats,
  DashboardAppointment,
  DashboardPatient,
  DashboardDepartment,
  Department,
  DepartmentDetail,
  DepartmentsResponse,
  Medication,
  MedicationsResponse,
  LabTest,
  LabTestsResponse,
  LabOrder,
  LabOrdersResponse,
  LabOrderStatus,
  Invoice,
  InvoiceDetail,
  InvoiceItem,
  InvoicesResponse,
  InvoiceStatus,
  Payment,
  PaymentWithDetails,
  PaymentStats,
  PaymentsResponse,
  PaymentMethod,
  Prescription,
  PrescriptionDetail,
  PrescriptionsResponse,
  PrescriptionStatus,
  UserDetail,
  UsersResponse,
  ReportData,
  Consultation,
  ConsultationDetail,
  ConsultationsResponse,
  InventoryItem,
  InventoryItemDetail,
  InventoryResponse,
  Supplier,
  SupplierDetail,
  SuppliersResponse,
  Notification,
  NotificationFilters,
  NotificationsResponse,
  NotificationType,
  NotificationTargetRole,
  CreateNotificationInput,
};
