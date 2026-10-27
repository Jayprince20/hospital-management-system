import type { SalePaymentMethod } from '@/lib/api';

/** Pharmacists may give at most this share of the subtotal as a discount; above it needs an admin */
export const PHARMACIST_MAX_DISCOUNT = 0.1;

/** An outside prescription older than this many months is refused at the counter */
export const EXTERNAL_RX_MAX_MONTHS = 3;

export const PAYMENT_METHODS: SalePaymentMethod[] = ['CASH', 'CARD', 'MTN_MOMO', 'ORANGE_MONEY'];

export interface CartLine {
  medicationId: string;
  quantity: number;
  unitPrice: number;
}

/** Whole francs: the counter never deals in fractions */
const franc = (n: number) => Math.round(n);

export function cartTotals(lines: CartLine[], discount = 0): { subtotal: number; discount: number; total: number } {
  const subtotal = franc(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
  const applied = Math.min(Math.max(0, franc(discount || 0)), subtotal);
  return { subtotal, discount: applied, total: subtotal - applied };
}

/** Change to hand back for a cash payment, or null when the customer has not given enough */
export function changeDue(total: number, tendered: number | null | undefined): number | null {
  if (tendered === null || tendered === undefined || !Number.isFinite(tendered)) return null;
  const change = franc(tendered) - franc(total);
  return change >= 0 ? change : null;
}

export function discountShare(discount: number, subtotal: number): number {
  if (subtotal <= 0) return 0;
  return discount / subtotal;
}

/** A pharmacist's discount above 10 % of the subtotal must be given by an administrator */
export function discountNeedsAdmin(discount: number, subtotal: number, role: string | undefined): boolean {
  if (role === 'ADMIN') return false;
  return discountShare(discount, subtotal) > PHARMACIST_MAX_DISCOUNT + 1e-9;
}

export function paymentNeedsReference(method: SalePaymentMethod): boolean {
  return method !== 'CASH';
}

/** Days from today (local) to a YYYY-MM-DD or ISO date; negative once past */
export function daysUntil(date: string, today: Date = new Date()): number {
  const d = new Date(date.length === 10 ? `${date}T00:00:00` : date);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

export type ExpiryStatus = 'EXPIRED' | 'CRITICAL' | 'SOON' | 'OK';

/** EXPIRED: past; CRITICAL: within 30 days; SOON: within 90 days */
export function expiryStatus(date: string | null | undefined, today: Date = new Date()): ExpiryStatus {
  if (!date) return 'OK';
  const days = daysUntil(date, today);
  if (days < 0) return 'EXPIRED';
  if (days <= 30) return 'CRITICAL';
  if (days <= 90) return 'SOON';
  return 'OK';
}

export const EXPIRY_BADGE: Record<ExpiryStatus, string> = {
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  CRITICAL: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  SOON: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  OK: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

export type ExternalRxProblem = 'MISSING' | 'FUTURE' | 'TOO_OLD';

/** Checks the outside prescription details the counter needs for prescription-only drugs */
export function externalRxProblem(prescriber: string, date: string, today: Date = new Date()): ExternalRxProblem | null {
  if (!prescriber.trim() || !date) return 'MISSING';
  const days = daysUntil(date, today);
  if (days > 0) return 'FUTURE';
  const limit = new Date(today.getFullYear(), today.getMonth() - EXTERNAL_RX_MAX_MONTHS, today.getDate());
  if (date.slice(0, 10) < localDateString(limit)) return 'TOO_OLD';
  return null;
}

export function localDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Refund for returned lines: their price minus the matching share of the sale's discount
 * (the server computes the same and is the authority).
 */
export function refundAmount(
  lines: Array<{ quantity: number; unitPrice: number }>,
  sale: { subtotal: number; discount: number }
): number {
  const gross = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  if (gross <= 0) return 0;
  const share = sale.subtotal > 0 ? sale.discount * (gross / sale.subtotal) : 0;
  return Math.max(0, franc(gross - share));
}

export function returnableQty(item: { quantity: number; returnedQty: number }): number {
  return Math.max(0, item.quantity - item.returnedQty);
}

/** Add a medication to the cart, or bump its quantity; never above what can be sold */
export function addToCart<T extends { medicationId: string; quantity: number }>(cart: T[], line: T, max?: number): T[] {
  const existing = cart.find((l) => l.medicationId === line.medicationId);
  const cap = (q: number) => (max !== undefined && max >= 0 ? Math.min(q, Math.max(max, 1)) : q);
  if (existing) {
    return cart.map((l) => (l.medicationId === line.medicationId ? { ...l, quantity: cap(l.quantity + line.quantity) } : l));
  }
  return [...cart, { ...line, quantity: cap(line.quantity) }];
}
