// Tiers payant helpers shared by the billing pages, the patient portal and the claims pages

interface ShareLike {
  balance: number;
  total?: number;
  insurerShare?: number;
  patientShare?: number;
  patientBalance?: number;
  insurerBalance?: number;
  payerId?: string | null;
}

/** What the patient still has to pay: their co-pay balance when the invoice is split, else the overall balance */
export function patientDue(invoice: ShareLike): number {
  return typeof invoice.patientBalance === 'number' ? invoice.patientBalance : invoice.balance;
}

/** What the insurer still owes on this invoice (0 for invoices without a payer) */
export function insurerDue(invoice: ShareLike): number {
  return typeof invoice.insurerBalance === 'number' ? invoice.insurerBalance : 0;
}

/** Whether part of the invoice is billed to an insurer */
export function isInsured(invoice: ShareLike): boolean {
  return Boolean(invoice.payerId) || (invoice.insurerShare ?? 0) > 0;
}

/** Share of the total covered by the insurer, as a whole percentage */
export function coveredPercent(invoice: ShareLike): number {
  const total = invoice.total ?? 0;
  if (!total || !invoice.insurerShare) return 0;
  return Math.round((invoice.insurerShare / total) * 100);
}

export type AgeingBucket = 'current' | 'd31_60' | 'd61_90' | 'd90plus';

/** Ageing bucket for an amount billed on `date`, as seen on `asOf` (calendar days) */
export function ageingBucket(date: string | Date, asOf: Date = new Date()): AgeingBucket {
  const start = new Date(date);
  const days = Math.floor((Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000);
  if (days <= 30) return 'current';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90plus';
}

export interface SettlementLineDraft {
  amountClaimed: number;
  amountApproved: number;
  amountPaid: number;
  alreadyPaid: number;
  rejectionReason: string;
}

export type SettlementLineError = 'approvedTooHigh' | 'paidTooHigh' | 'negative' | 'reasonRequired' | null;

/** Validate one settlement line the way the API does, so the form can flag it before sending */
export function settlementLineError(line: SettlementLineDraft): SettlementLineError {
  if (line.amountApproved < 0 || line.amountPaid < 0) return 'negative';
  if (line.amountApproved > line.amountClaimed) return 'approvedTooHigh';
  // amountPaid is this settlement's payment; with earlier payments it may not exceed the approved amount
  if (line.alreadyPaid + line.amountPaid > line.amountApproved) return 'paidTooHigh';
  if (line.amountApproved < line.amountClaimed && !line.rejectionReason.trim()) return 'reasonRequired';
  return null;
}
