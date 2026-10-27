// Price list (grille tarifaire): types and pure helpers shared by the price-list page,
// the negotiated payer prices and the invoice line editor.

export type TariffKind = 'SERVICE' | 'CONSULTATION' | 'LAB_TEST' | 'IMAGING' | 'MEDICATION' | 'BED_DAY';

export const TARIFF_KINDS: TariffKind[] = ['SERVICE', 'CONSULTATION', 'LAB_TEST', 'IMAGING', 'MEDICATION', 'BED_DAY'];

/** Categories offered when creating an act (invoice line categories) */
// Same five categories the backend accepts on invoice lines (imaging and bed days bill as 'procedure')
export const SERVICE_CATEGORIES = ['consultation', 'procedure', 'lab', 'medication', 'other'] as const;

export interface TariffRef {
  kind: TariffKind;
  ref: string;
}

/** GET /api/tariffs/search */
export interface TariffSearchItem {
  kind: TariffKind;
  ref: string;
  code: string | null;
  label: string;
  category: string;
  listPrice: number;
  price: number;
  payerAdjusted: boolean;
}

/** GET /api/tariffs (catalogue) */
export interface TariffItem {
  kind: TariffKind;
  ref: string;
  code: string | null;
  label: string;
  category: string;
  listPrice: number;
  updatedAt: string;
  active: boolean;
}

export interface TariffListResponse {
  items: TariffItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ServiceTariffInput {
  code: string;
  label: string;
  category: string;
  price: number;
  notes?: string;
}

export interface PriceChange {
  id: string;
  tariffKind: TariffKind;
  tariffRef: string;
  label: string;
  oldPrice: number | null;
  newPrice: number;
  reason: string | null;
  changedBy: { id: string; name: string | null } | null;
  changedAt: string;
}

export interface PriceChangeResponse {
  items: PriceChange[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** GET /api/payers/:id/tariffs */
export interface PayerTariff {
  id: string;
  tariffKind: TariffKind;
  tariffRef: string | null;
  label: string | null;
  listPrice: number | null;
  price: number | null;
  discountPercent: number | null;
  validFrom: string | null;
  validUntil: string | null;
}

export interface PayerTariffInput {
  tariffKind: TariffKind;
  tariffRef: string | null;
  price?: number | null;
  discountPercent?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}

// ---------- invoice lines ----------

/** A line of the invoice being created */
export interface InvoiceLineDraft {
  /** Stable React key */
  uid: string;
  description: string;
  quantity: number;
  unitPrice: number;
  category: string;
  tariff: TariffRef | null;
  code: string | null;
  /** Price from the price list (payer's price when it applies) — what the line costs without a change */
  listPrice: number | null;
  payerAdjusted: boolean;
  overrideReason: string;
}

let lineSeq = 0;
const nextUid = () => `line-${++lineSeq}`;

export const emptyLine = (): InvoiceLineDraft => ({
  uid: nextUid(),
  description: '',
  quantity: 1,
  unitPrice: 0,
  category: 'other',
  tariff: null,
  code: null,
  listPrice: null,
  payerAdjusted: false,
  overrideReason: '',
});

export function lineFromTariff(item: TariffSearchItem, quantity = 1): InvoiceLineDraft {
  return {
    uid: nextUid(),
    description: item.label,
    quantity,
    unitPrice: item.price,
    category: item.category,
    tariff: { kind: item.kind, ref: item.ref },
    code: item.code,
    listPrice: item.price,
    payerAdjusted: item.payerAdjusted,
    overrideReason: '',
  };
}

/** The charged price differs from the price list */
export const isPriceChanged = (line: InvoiceLineDraft): boolean => line.listPrice != null && line.unitPrice !== line.listPrice;

/**
 * Who may charge `newPrice` instead of `listPrice`: an admin any price, a receptionist only a lower one (discount).
 */
export function canSetPrice(role: string | undefined, listPrice: number, newPrice: number): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'RECEPTIONIST') return newPrice <= listPrice;
  return false;
}

export const MIN_OVERRIDE_REASON = 5;

/** Problem with a line before sending, as a translation key (null when fine) */
export function lineProblem(line: InvoiceLineDraft, role: string | undefined): string | null {
  if (!line.tariff) {
    // Free lines (not on the price list) are for administrators only
    if (role !== 'ADMIN') return 'pl.err.pickFromList';
    if (!line.description.trim() || line.unitPrice <= 0) return 'pl.err.freeLine';
    return null;
  }
  if (line.quantity < 1) return 'pl.err.quantity';
  if (isPriceChanged(line)) {
    if (!canSetPrice(role, line.listPrice ?? 0, line.unitPrice)) return 'pl.err.increase';
    if (line.overrideReason.trim().length < MIN_OVERRIDE_REASON) return 'pl.err.reason';
  }
  return null;
}

/**
 * What the API receives for a line. Price-list lines send their ref and a price only when it was changed by hand
 * (with the reason): otherwise the server applies the list price or the payer's negotiated price, which the
 * form may not know yet.
 */
export function lineToInput(line: InvoiceLineDraft) {
  const sendPrice = !line.tariff || isPriceChanged(line);
  return {
    description: line.description,
    quantity: line.quantity,
    ...(sendPrice ? { unitPrice: line.unitPrice } : {}),
    category: line.category,
    ...(line.tariff ? { tariff: line.tariff } : {}),
    ...(line.tariff && isPriceChanged(line) ? { overrideReason: line.overrideReason.trim() } : {}),
  };
}

/**
 * New list prices after the payer changed: keeps lines whose price was changed by hand,
 * moves the others to the new price.
 */
export function repriceLines(lines: InvoiceLineDraft[], prices: Map<string, TariffSearchItem>): InvoiceLineDraft[] {
  return lines.map((line) => {
    if (!line.tariff) return line;
    const item = prices.get(`${line.tariff.kind}:${line.tariff.ref}`);
    if (!item) return line;
    const changed = isPriceChanged(line);
    return { ...line, listPrice: item.price, payerAdjusted: item.payerAdjusted, unitPrice: changed ? line.unitPrice : item.price };
  });
}

// ---------- payer tariffs ----------

/** "−10 %" or the fixed price, for display */
export function payerTariffValue(tariff: Pick<PayerTariff, 'price' | 'discountPercent'>, formatCurrency: (n: number) => string): string {
  if (tariff.price != null) return formatCurrency(tariff.price);
  if (tariff.discountPercent != null) return `−${tariff.discountPercent} %`;
  return '—';
}

/** Problem with a negotiated price before sending (translation key) */
export function payerTariffProblem(input: { tariffRef: string | null; price: string; discountPercent: string; validFrom: string; validUntil: string }): string | null {
  const hasPrice = input.price.trim() !== '';
  const hasPercent = input.discountPercent.trim() !== '';
  if (hasPrice === hasPercent) return 'pl.payer.err.oneOf';
  if (hasPrice && !input.tariffRef) return 'pl.payer.err.priceNeedsAct';
  if (hasPrice && !(Number(input.price) >= 0)) return 'pl.payer.err.price';
  if (hasPercent) {
    const pct = Number(input.discountPercent);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) return 'pl.payer.err.percent';
  }
  if (input.validFrom && input.validUntil && input.validUntil < input.validFrom) return 'pl.payer.err.dates';
  return null;
}

// ---------- export ----------

const csvCell = (value: string | number | null): string => {
  const text = value == null ? '' : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Current grid as CSV (semicolon-separated, opens in French Excel); `kindLabel` gives the column text */
export function tariffsToCsv(items: TariffItem[], kindLabel: (kind: TariffKind) => string, headers: string[]): string {
  const rows = items.map((item) => [kindLabel(item.kind), item.code, item.label, item.category, item.listPrice, item.active ? 'oui' : 'non']);
  return [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\n') + '\n';
}

/** Category label: the billing translation when it exists, else the raw category */
export function categoryLabel(t: (key: string) => string, category: string): string {
  const key = `admin.billing.cat.${category}`;
  const label = t(key);
  return label === key ? category : label;
}
