import type { ClaimLineStatus, ClaimStatus, PreAuthStatus } from '@/lib/api';

const GRAY = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
const YELLOW = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
const BLUE = 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
const GREEN = 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
const RED = 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
const ORANGE = 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400';

export function claimStatusColor(status: ClaimStatus): string {
  return { DRAFT: GRAY, SUBMITTED: YELLOW, PARTIALLY_PAID: BLUE, PAID: GREEN, CLOSED: GRAY }[status] ?? GRAY;
}

export function claimLineStatusColor(status: ClaimLineStatus): string {
  return { PENDING: YELLOW, ACCEPTED: BLUE, PARTIALLY_ACCEPTED: ORANGE, REJECTED: RED, PAID: GREEN }[status] ?? GRAY;
}

export function preAuthStatusColor(status: PreAuthStatus): string {
  return { REQUESTED: YELLOW, APPROVED: GREEN, REJECTED: RED, EXPIRED: GRAY, USED: BLUE, CANCELLED: GRAY }[status] ?? GRAY;
}
