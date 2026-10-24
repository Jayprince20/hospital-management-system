// Pharmacy purchasing: types shared with the API client and pure helpers used by the screens
// (orders, reorder suggestions, goods receipt, supplier invoices, payables).

export type PurchaseOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
export const PO_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

export type SupplierInvoiceStatus = 'RECEIVED' | 'APPROVED' | 'DISPUTED' | 'PARTIALLY_PAID' | 'PAID';
export const INVOICE_STATUSES: SupplierInvoiceStatus[] = ['RECEIVED', 'APPROVED', 'DISPUTED', 'PARTIALLY_PAID', 'PAID'];

export type SupplierPaymentMethod = 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'MOBILE_MONEY';
export const SUPPLIER_PAYMENT_METHODS: SupplierPaymentMethod[] = ['BANK_TRANSFER', 'CHEQUE', 'CASH', 'MOBILE_MONEY'];

/** Used until an order's detail tells the real value (env PURCHASE_APPROVAL_THRESHOLD on the server) */
export const DEFAULT_APPROVAL_THRESHOLD = Number(process.env.NEXT_PUBLIC_PURCHASE_APPROVAL_THRESHOLD) || 500000;

/** A person as the API may send it: a name, { name } or { firstName, lastName } */
export type PersonRef = string | { id?: string; name?: string; firstName?: string; lastName?: string } | null | undefined;

export function personName(p: PersonRef): string {
  if (!p) return '';
  if (typeof p === 'string') return p;
  return p.name || [p.firstName, p.lastName].filter(Boolean).join(' ');
}

export interface PurchaseOrderSummary {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  supplier: { id: string; name: string };
  totalAmount: number;
  itemCount: number;
  expectedAt?: string | null;
  createdAt: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  orderedAt?: string | null;
  receivedAt?: string | null;
  receivedPercent: number;
  createdBy?: PersonRef;
}

export interface PurchaseOrdersResponse {
  data: PurchaseOrderSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counts: Partial<Record<PurchaseOrderStatus, number>>;
}

export interface PurchaseOrderItem {
  id: string;
  medicationId?: string | null;
  inventoryItemId?: string | null;
  itemName: string;
  quantity: number;
  quantityReceived: number;
  unitPrice: number;
  total: number;
  remaining?: number;
  medication?: { name: string; strength?: string } | null;
  inventoryItem?: { name: string; unit?: string } | null;
}

export interface GoodsReceiptLine {
  id: string;
  itemId: string; // the purchase order line
  itemName?: string | null;
  quantityReceived: number;
  quantityRejected: number;
  rejectionReason?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  unitCost: number;
}

export interface GoodsReceipt {
  id: string;
  number: string;
  deliveryNoteRef?: string | null;
  notes?: string | null;
  receivedAt: string;
  receivedBy?: PersonRef;
  lines: GoodsReceiptLine[];
}

export interface SupplierPayment {
  id: string;
  amount: number;
  method: SupplierPaymentMethod;
  reference?: string | null;
  paidAt: string;
  recordedBy?: PersonRef;
}

export interface InvoiceMatch {
  orderedValue: number;
  receivedValue: number;
  previouslyInvoiced: number;
  difference: number;
  ok: boolean;
  notes: string[];
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  purchaseOrderId?: string | null;
  purchaseOrder?: { id: string; orderNumber: string } | null;
  orderNumber?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance?: number;
  daysOverdue?: number;
  status: SupplierInvoiceStatus;
  matchNotes?: string | null;
  match?: InvoiceMatch;
  payments?: SupplierPayment[];
}

export interface PurchaseOrderDetail {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  supplier: { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; contactPerson?: string | null; contactName?: string | null; leadTimeDays?: number };
  totalAmount: number;
  notes?: string | null;
  expectedAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  orderedAt?: string | null;
  sentToEmail?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  createdBy?: PersonRef;
  approvedBy?: PersonRef;
  items: PurchaseOrderItem[];
  receipts: GoodsReceipt[];
  invoices: SupplierInvoice[];
  approvalRequired: boolean;
  threshold: number;
}

export interface PurchaseOrderInput {
  supplierId: string;
  expectedAt?: string;
  notes?: string;
  items: Array<{ medicationId?: string; inventoryItemId?: string; itemName?: string; quantity: number; unitPrice: number }>;
}

export type PurchaseOrderAction = 'submit' | 'approve' | 'reject' | 'send' | 'cancel' | 'close';

export interface ReceiptInput {
  deliveryNoteRef?: string;
  notes?: string;
  lines: Array<{ itemId: string; quantityReceived: number; quantityRejected?: number; rejectionReason?: string; batchNumber?: string; expiryDate?: string; unitCost?: number }>;
}

export interface ReorderSuggestion {
  kind: 'MEDICATION' | 'INVENTORY';
  medicationId?: string;
  inventoryItemId?: string;
  name: string;
  unit?: string;
  stock: number;
  reorderLevel: number;
  onOrder: number;
  avgDailyUse: number;
  daysLeft: number | null;
  suggestedQty: number;
  lastUnitCost: number | null;
  supplierId?: string | null;
  supplierName?: string | null;
}

export interface GoodsReceiptSummary {
  id: string;
  number: string;
  receivedAt: string;
  purchaseOrder?: { id: string; orderNumber: string };
  orderNumber?: string;
  supplier?: { id: string; name: string };
  lineCount: number;
  value: number;
}

export interface PayablesReport {
  totals: { outstanding: number; overdue: number };
  ageing: { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number };
  bySupplier: Array<{ supplierId: string; name: string; outstanding: number; overdue: number; oldestDueDate: string | null }>;
}

export interface SupplierPerformance {
  supplierId: string;
  name: string;
  ordersCount: number;
  orderedValue: number;
  receivedValue: number;
  onTimeRate: number | null;
  avgLeadDays: number | null;
  fillRate: number | null;
  rejectionRate: number | null;
  priceChanges: Array<{ name: string; previous: number; latest: number; changePct: number }>;
}

export interface InvoiceInput {
  supplierId: string;
  purchaseOrderId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number;
  notes?: string;
}

export interface PaymentInput {
  amount: number;
  method: SupplierPaymentMethod;
  reference?: string;
  paidAt: string;
}

// ---- Styles ----

export const PO_STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  SUBMITTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  ORDERED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  PARTIALLY_RECEIVED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  RECEIVED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const INVOICE_STATUS_STYLE: Record<SupplierInvoiceStatus, string> = {
  RECEIVED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  DISPUTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

// ---- Pure helpers ----

/** YYYY-MM-DD of a Date in local time */
export function isoDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysIso(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + n));
}

/** Rounded to the franc: XAF has no cents */
export function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round((Number(quantity) || 0) * (Number(unitPrice) || 0));
}

export function orderTotal(lines: Array<{ quantity: number; unitPrice: number }>): number {
  return lines.reduce((sum, l) => sum + lineTotal(l.quantity, l.unitPrice), 0);
}

export function needsApproval(total: number, threshold: number, role?: string): boolean {
  return role !== 'ADMIN' && total > threshold;
}

export function remainingOf(item: Pick<PurchaseOrderItem, 'quantity' | 'quantityReceived' | 'remaining'>): number {
  return item.remaining ?? Math.max(0, item.quantity - item.quantityReceived);
}

/** Percent of ordered units received, 0-100 */
export function receivedPercentOf(items: Array<Pick<PurchaseOrderItem, 'quantity' | 'quantityReceived'>>): number {
  const ordered = items.reduce((s, i) => s + i.quantity, 0);
  if (!ordered) return 0;
  return Math.min(100, Math.round((items.reduce((s, i) => s + i.quantityReceived, 0) / ordered) * 100));
}

/** Which buttons an order shows, by status and role (the API checks again) */
export function availableActions(status: PurchaseOrderStatus, role: string | undefined, hasReceipts: boolean): PurchaseOrderAction[] {
  const admin = role === 'ADMIN';
  switch (status) {
    case 'DRAFT':
      return ['submit', 'cancel'];
    case 'SUBMITTED':
      return admin ? ['approve', 'reject', 'cancel'] : ['cancel'];
    case 'APPROVED':
      return ['send', 'cancel'];
    case 'ORDERED':
      return hasReceipts ? [] : ['cancel'];
    case 'PARTIALLY_RECEIVED':
      return ['close'];
    default:
      return [];
  }
}

export function canReceive(status: PurchaseOrderStatus): boolean {
  return status === 'ORDERED' || status === 'PARTIALLY_RECEIVED';
}

export function canRecordInvoice(status: PurchaseOrderStatus): boolean {
  return status === 'ORDERED' || status === 'PARTIALLY_RECEIVED' || status === 'RECEIVED';
}

export function invoiceBalance(inv: Pick<SupplierInvoice, 'amount' | 'paidAmount' | 'balance'>): number {
  return inv.balance ?? Math.max(0, inv.amount - inv.paidAmount);
}

/**
 * Selected reorder suggestions, one draft order per supplier. Lines without a supplier are
 * returned apart so the screen can ask for one.
 */
export function groupSuggestionsBySupplier(
  lines: Array<ReorderSuggestion & { quantity: number }>
): { groups: Array<{ supplierId: string; supplierName: string; lines: Array<ReorderSuggestion & { quantity: number }> }>; withoutSupplier: Array<ReorderSuggestion & { quantity: number }> } {
  const map = new Map<string, { supplierId: string; supplierName: string; lines: Array<ReorderSuggestion & { quantity: number }> }>();
  const withoutSupplier: Array<ReorderSuggestion & { quantity: number }> = [];
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    if (!line.supplierId) {
      withoutSupplier.push(line);
      continue;
    }
    const group = map.get(line.supplierId) ?? { supplierId: line.supplierId, supplierName: line.supplierName ?? '', lines: [] };
    group.lines.push(line);
    map.set(line.supplierId, group);
  }
  return { groups: [...map.values()], withoutSupplier };
}

/** Order lines for the API from suggestions */
export function suggestionsToItems(lines: Array<ReorderSuggestion & { quantity: number }>): PurchaseOrderInput['items'] {
  return lines.map((l) => ({
    ...(l.kind === 'MEDICATION' ? { medicationId: l.medicationId } : { inventoryItemId: l.inventoryItemId }),
    quantity: l.quantity,
    unitPrice: l.lastUnitCost ?? 0,
  }));
}

export interface ReceiptDraftLine {
  itemId: string;
  isMedication: boolean;
  remaining: number;
  quantityReceived: string;
  quantityRejected: string;
  rejectionReason: string;
  batchNumber: string;
  expiryDate: string;
  unitCost: string;
}

/** Problems in a receipt form, as translation keys with the line index; empty when it can be sent */
export function receiptProblems(lines: ReceiptDraftLine[], today: string = isoDay()): Array<{ index: number; key: string }> {
  const problems: Array<{ index: number; key: string }> = [];
  let any = false;
  lines.forEach((l, index) => {
    const got = Number(l.quantityReceived) || 0;
    const rejected = Number(l.quantityRejected) || 0;
    if (got < 0 || rejected < 0 || !Number.isInteger(got) || !Number.isInteger(rejected)) {
      problems.push({ index, key: 'pur.rcv.err.quantity' });
      return;
    }
    if (got + rejected === 0) return;
    any = true;
    if (got + rejected > l.remaining) problems.push({ index, key: 'pur.rcv.err.tooMany' });
    if (rejected > 0 && !l.rejectionReason.trim()) problems.push({ index, key: 'pur.rcv.err.reason' });
    if (l.isMedication && got > 0) {
      if (!l.batchNumber.trim() || !l.expiryDate) problems.push({ index, key: 'pur.rcv.err.batch' });
      else if (l.expiryDate <= today) problems.push({ index, key: 'pur.rcv.err.expired' });
    }
  });
  if (!any) problems.push({ index: -1, key: 'pur.rcv.err.nothing' });
  return problems;
}

export function receiptInputFrom(lines: ReceiptDraftLine[], extra: { deliveryNoteRef?: string; notes?: string }): ReceiptInput {
  return {
    ...(extra.deliveryNoteRef?.trim() ? { deliveryNoteRef: extra.deliveryNoteRef.trim() } : {}),
    ...(extra.notes?.trim() ? { notes: extra.notes.trim() } : {}),
    lines: lines
      .filter((l) => (Number(l.quantityReceived) || 0) + (Number(l.quantityRejected) || 0) > 0)
      .map((l) => {
        const got = Number(l.quantityReceived) || 0;
        const rejected = Number(l.quantityRejected) || 0;
        return {
          itemId: l.itemId,
          quantityReceived: got,
          ...(rejected > 0 ? { quantityRejected: rejected, rejectionReason: l.rejectionReason.trim() } : {}),
          ...(l.isMedication && got > 0 ? { batchNumber: l.batchNumber.trim(), expiryDate: l.expiryDate } : {}),
          ...(l.unitCost !== '' ? { unitCost: Number(l.unitCost) } : {}),
        };
      }),
  };
}
