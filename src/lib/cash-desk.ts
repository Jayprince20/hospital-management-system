// Main cash desk (caisse principale): one till per cashier, desk payments, cash in/out, refunds, closing count

export type DeskPaymentMethod = 'CASH' | 'CARD' | 'MTN_MOMO' | 'ORANGE_MONEY' | 'BANK_TRANSFER' | 'MOBILE_WALLET';
export const DESK_METHODS: DeskPaymentMethod[] = ['CASH', 'CARD', 'MTN_MOMO', 'ORANGE_MONEY', 'BANK_TRANSFER', 'MOBILE_WALLET'];

export type CashierSessionStatus = 'OPEN' | 'CLOSED';
export type CashMovementType = 'PAY_IN' | 'PAY_OUT';
export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';

export interface PersonRef {
  id: string;
  name: string;
}

export interface CashierSessionTotals {
  byMethod: Record<DeskPaymentMethod, number>;
  paymentsCount: number;
  payIns: number;
  payOuts: number;
  cashRefunds: number;
  otherRefunds: number;
  expectedCash: number;
}

export interface CashierSessionSummary {
  id: string;
  number: string;
  status: CashierSessionStatus;
  cashier: PersonRef;
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  totals: CashierSessionTotals;
  countedCash: number | null;
  variance: number | null;
  denominations: DenominationCounts | null;
  closingNotes: string | null;
  depositAmount: number | null;
  depositReceivedBy: PersonRef | null;
  depositReceivedAt: string | null;
  depositNotes: string | null;
}

export interface CashierSessionPayment {
  id: string;
  receiptNumber: string | null;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  method: DeskPaymentMethod;
  reference: string | null;
  processedAt: string;
}

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  reference: string | null;
  createdAt: string;
}

export interface InvoiceRefund {
  id: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string;
  patientName: string;
  paymentId: string | null;
  amount: number;
  method: DeskPaymentMethod;
  reason: string;
  status: RefundStatus;
  requestedBy: PersonRef | null;
  requestedAt: string;
  decidedBy: PersonRef | null;
  decidedAt: string | null;
  decisionNote: string | null;
  paidBy: PersonRef | null;
  paidAt: string | null;
  reference: string | null;
}

export interface CashierSessionDetail extends CashierSessionSummary {
  payments: CashierSessionPayment[];
  movements: CashMovement[];
  refunds: CashierSessionRefund[];
}

export interface CashDeskDaily {
  date: string;
  sessions: CashierSessionSummary[];
  totals: {
    byMethod: Record<DeskPaymentMethod, number>;
    paymentsCount: number;
    cashRefunds: number;
    otherRefunds: number;
    payIns: number;
    payOuts: number;
    variance: number;
    deposits: number;
  };
  electronic: { MTN_MOMO: number; ORANGE_MONEY: number };
  insurerSettlements: number;
  openTills: number;
  pendingDeposits: number;
  pendingRefunds: number;
}

// ---- Closing count (billets et pièces du franc CFA) ----

export interface Denomination {
  key: string; // as sent to the API
  value: number;
  kind: 'note' | 'coin';
}

/** CFA franc notes and coins; 500 exists as a note and as a coin, the coin is sent as "500c" */
export const DENOMINATIONS: Denomination[] = [
  { key: '10000', value: 10000, kind: 'note' },
  { key: '5000', value: 5000, kind: 'note' },
  { key: '2000', value: 2000, kind: 'note' },
  { key: '1000', value: 1000, kind: 'note' },
  { key: '500', value: 500, kind: 'note' },
  { key: '500c', value: 500, kind: 'coin' },
  { key: '100', value: 100, kind: 'coin' },
  { key: '50', value: 50, kind: 'coin' },
  { key: '25', value: 25, kind: 'coin' },
  { key: '10', value: 10, kind: 'coin' },
  { key: '5', value: 5, kind: 'coin' },
];

export type DenominationCounts = Record<string, number>;

/** Typed counts → whole, non-negative numbers for every denomination (blank or invalid count as 0) */
export function normalizeCounts(raw: Record<string, string | number | undefined>): DenominationCounts {
  const out: DenominationCounts = {};
  for (const d of DENOMINATIONS) {
    const n = Math.floor(Number(String(raw[d.key] ?? '').replace(/\s/g, '')));
    out[d.key] = Number.isFinite(n) && n > 0 ? n : 0;
  }
  return out;
}

/** Cash counted from the notes and coins */
export function denominationTotal(counts: Record<string, string | number | undefined>): number {
  const normalized = normalizeCounts(counts);
  return DENOMINATIONS.reduce((sum, d) => sum + d.value * normalized[d.key], 0);
}

/** Counted minus expected: positive is a surplus, negative a shortage */
export function cashVariance(counted: number, expected: number): number {
  return Math.round(counted - expected);
}

/** Whether a count entry is invalid (negative, decimal or not a number); blank is allowed */
export function invalidCount(raw: string): boolean {
  const s = raw.replace(/\s/g, '');
  if (!s) return false;
  return !/^\d+$/.test(s);
}

export const REFUND_STATUS_STYLE: Record<RefundStatus, string> = {
  REQUESTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  REJECTED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export function todayIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Refund paid from a till, as listed in the till detail */
export type CashierSessionRefund = Pick<InvoiceRefund, 'id' | 'number' | 'status' | 'invoiceId' | 'invoiceNumber' | 'patientName' | 'amount' | 'method' | 'reason' | 'reference' | 'paidAt'>;
