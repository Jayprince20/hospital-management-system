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
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
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
}

// Patient types
interface Patient {
  id: string;
  patientId: string;
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
  }>;
  collectedAt?: string;
  completedAt?: string;
  createdAt: string;
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
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
}

interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  processedBy: string;
  processedAt: string;
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
    // Clear any existing tokens first
    this.clearTokens();

    // Always use localStorage for dashboard to persist across refreshes
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('rememberMe', 'true');
  }

  clearTokens(): void {
    // Clear from both storages
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const accessToken = this.getAccessToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 && this.getRefreshToken()) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.request<T>(endpoint, options);
        }
      }
      throw new Error(data.message || 'Request failed');
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
      this.clearTokens();
      return false;
    }
  }

  // Auth methods
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { rememberMe, ...loginData } = credentials;

    const response = await this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData),
    });

    if (response.success && response.data) {
      // Tokens are nested inside response.data.tokens
      const { tokens } = response.data;
      this.setTokens(tokens.accessToken, tokens.refreshToken, rememberMe || true);
      return response.data;
    }

    throw new Error(response.message || 'Login failed');
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
    throw new Error(response.message || 'Failed to reschedule appointment');
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

  async createLabOrder(data: { patientId: string; doctorId: string; priority?: string; notes?: string; tests: { labTestId: string }[] }): Promise<LabOrder> {
    const response = await this.request<LabOrder>('/api/lab-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Failed to create lab order');
  }

  async updateLabOrder(id: string, data: { status?: LabOrderStatus; priority?: string; notes?: string; collectedBy?: string; results?: Array<{ itemId: string; result: string; isAbnormal?: boolean }> }): Promise<LabOrder> {
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

  // Invoice methods
  async getInvoices(filters: { search?: string; status?: InvoiceStatus; patientId?: string; startDate?: string; endDate?: string; page?: number; limit?: number } = {}): Promise<InvoicesResponse> {
    const params = new URLSearchParams();
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

  async createInvoice(data: { patientId: string; items: Array<{ description: string; quantity: number; unitPrice: number; category: string }>; tax?: number; discount?: number; dueDate?: string; notes?: string }): Promise<Invoice> {
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
    throw new Error(response.message || 'Failed to register patient');
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
}

export const api = new ApiClient(API_URL);
export type {
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
