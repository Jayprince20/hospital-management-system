/**
 * Shared formatting utilities for consistent data display across the application.
 */

/**
 * Format a date string to a localized date display
 */
export function formatDate(
  dateString: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format a date string to include time
 */
export function formatDateTime(
  dateString: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleString('en-US', options);
}

/**
 * Format a time string (HH:MM or HH:MM:SS) to a localized time display
 */
export function formatTime(
  timeString: string,
  options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  }
): string {
  // Handle time-only strings by prepending a date
  const date = new Date(`1970-01-01T${timeString}`);
  return date.toLocaleTimeString('en-US', options);
}

/**
 * Calculate age from a date of birth
 */
export function calculateAge(dateOfBirth: string | Date): number {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

/**
 * Get the day name from a day of week number (0-6, where 0 is Sunday)
 */
export function getDayName(dayOfWeek: number, format: 'short' | 'long' = 'long'): string {
  const days = {
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  };
  return days[format][dayOfWeek] || '';
}

/**
 * Format a currency amount
 * Default: XAF (Central African CFA franc) for Cameroon
 * Example: 15000 -> "15 000 FCFA"
 */
export function formatCurrency(
  amount: number,
  currency: string = 'XAF',
  locale: string = 'fr-CM'
): string {
  // Special handling for XAF (Cameroon CFA Franc)
  if (currency === 'XAF') {
    const formattedAmount = Math.round(amount)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${formattedAmount} FCFA`;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format a phone number (basic US format)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format a relative time (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;

  return formatDate(date);
}

/**
 * Format appointment status to human-readable text
 */
export function formatAppointmentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    SCHEDULED: 'Scheduled',
    CONFIRMED: 'Confirmed',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No Show',
    RESCHEDULED: 'Rescheduled',
  };
  return statusMap[status] || status;
}

/**
 * Get status color classes for appointment status
 */
export function getStatusColorClasses(status: string): string {
  const colorMap: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400',
    CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400',
    COMPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400',
    NO_SHOW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400',
    RESCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get color classes for user roles
 */
export function getRoleColorClasses(role: string): string {
  const colorMap: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400',
    DOCTOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400',
    NURSE: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400',
    RECEPTIONIST: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400',
    PHARMACIST: 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-400',
    LAB_TECH: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-400',
    PATIENT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
  };
  return colorMap[role] || 'bg-gray-100 text-gray-800';
}

/**
 * Get color classes for active/inactive status
 */
export function getActiveStatusColorClasses(isActive: boolean): string {
  return isActive
    ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
    : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
}

/**
 * Format role to human-readable text
 */
export function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    ADMIN: 'Admin',
    DOCTOR: 'Doctor',
    NURSE: 'Nurse',
    RECEPTIONIST: 'Receptionist',
    PHARMACIST: 'Pharmacist',
    LAB_TECH: 'Lab Tech',
    PATIENT: 'Patient',
  };
  return roleMap[role] || role.replace(/_/g, ' ');
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format a file size in bytes to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format user initials from first and last name
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Format a date as YYYY-MM-DD in local time (for <input type="date"> values and min/max).
 * toISOString() would use UTC and can shift the day by one.
 */
export function toLocalDateString(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
