import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  availableActions,
  groupSuggestionsBySupplier,
  needsApproval,
  orderTotal,
  personName,
  receiptInputFrom,
  receiptProblems,
  receivedPercentOf,
  suggestionsToItems,
  type ReceiptDraftLine,
  type ReorderSuggestion,
} from '@/lib/purchasing';

const line = (patch: Partial<ReceiptDraftLine> = {}): ReceiptDraftLine => ({
  itemId: 'i1',
  isMedication: true,
  remaining: 10,
  quantityReceived: '10',
  quantityRejected: '',
  rejectionReason: '',
  batchNumber: 'L001',
  expiryDate: '2027-06-30',
  unitCost: '150',
  ...patch,
});

const suggestion = (patch: Partial<ReorderSuggestion>): ReorderSuggestion => ({
  kind: 'MEDICATION',
  medicationId: 'm1',
  name: 'Amoxicilline 500 mg',
  stock: 3,
  reorderLevel: 20,
  onOrder: 0,
  avgDailyUse: 2,
  daysLeft: 1,
  suggestedQty: 90,
  lastUnitCost: 120,
  supplierId: 's1',
  supplierName: 'Laborex',
  ...patch,
});

describe('order totals and approval', () => {
  it('totals lines rounded to the franc', () => {
    expect(orderTotal([{ quantity: 3, unitPrice: 333.4 }, { quantity: 2, unitPrice: 1000 }])).toBe(1000 + 2000);
  });

  it('needs an administrator above the threshold, never for an administrator', () => {
    expect(needsApproval(500000, 500000, 'PHARMACIST')).toBe(false);
    expect(needsApproval(500001, 500000, 'PHARMACIST')).toBe(true);
    expect(needsApproval(900000, 500000, 'ADMIN')).toBe(false);
  });
});

describe('order actions by status and role', () => {
  it('lets only administrators approve or reject', () => {
    expect(availableActions('SUBMITTED', 'PHARMACIST', false)).toEqual(['cancel']);
    expect(availableActions('SUBMITTED', 'ADMIN', false)).toEqual(['approve', 'reject', 'cancel']);
  });

  it('cannot cancel once goods arrived; a partial order can be closed', () => {
    expect(availableActions('ORDERED', 'ADMIN', true)).toEqual([]);
    expect(availableActions('PARTIALLY_RECEIVED', 'PHARMACIST', true)).toEqual(['close']);
    expect(availableActions('RECEIVED', 'ADMIN', true)).toEqual([]);
  });
});

describe('receipt form', () => {
  it('accepts a full medication line', () => {
    expect(receiptProblems([line()], '2026-10-24')).toEqual([]);
  });

  it('requires batch and expiry for medications, not for supplies', () => {
    expect(receiptProblems([line({ batchNumber: '' })], '2026-10-24').map((p) => p.key)).toContain('pur.rcv.err.batch');
    expect(receiptProblems([line({ isMedication: false, batchNumber: '', expiryDate: '' })], '2026-10-24')).toEqual([]);
  });

  it('refuses expired batches, too many units and rejections without reason', () => {
    expect(receiptProblems([line({ expiryDate: '2026-10-24' })], '2026-10-24').map((p) => p.key)).toEqual(['pur.rcv.err.expired']);
    expect(receiptProblems([line({ quantityReceived: '8', quantityRejected: '3', rejectionReason: 'abîmé' })], '2026-10-24').map((p) => p.key)).toEqual(['pur.rcv.err.tooMany']);
    expect(receiptProblems([line({ quantityReceived: '8', quantityRejected: '2' })], '2026-10-24').map((p) => p.key)).toEqual(['pur.rcv.err.reason']);
  });

  it('needs something received', () => {
    expect(receiptProblems([line({ quantityReceived: '0' })], '2026-10-24')).toEqual([{ index: -1, key: 'pur.rcv.err.nothing' }]);
  });

  it('sends only filled lines, rejected units with their reason, no batch for rejected-only lines', () => {
    const input = receiptInputFrom(
      [line(), line({ itemId: 'i2', quantityReceived: '0' }), line({ itemId: 'i3', quantityReceived: '0', quantityRejected: '2', rejectionReason: ' cassé ', batchNumber: '' })],
      { deliveryNoteRef: ' BL-42 ' }
    );
    expect(input).toEqual({
      deliveryNoteRef: 'BL-42',
      lines: [
        { itemId: 'i1', quantityReceived: 10, batchNumber: 'L001', expiryDate: '2027-06-30', unitCost: 150 },
        { itemId: 'i3', quantityReceived: 0, quantityRejected: 2, rejectionReason: 'cassé', unitCost: 150 },
      ],
    });
  });
});

describe('reorder suggestions', () => {
  it('groups chosen lines by supplier and keeps lines without supplier apart', () => {
    const { groups, withoutSupplier } = groupSuggestionsBySupplier([
      { ...suggestion({}), quantity: 90 },
      { ...suggestion({ medicationId: 'm2', name: 'Paracétamol' }), quantity: 50 },
      { ...suggestion({ medicationId: 'm3', supplierId: 's2', supplierName: 'UBIPHARM' }), quantity: 10 },
      { ...suggestion({ medicationId: 'm4', supplierId: null, supplierName: null }), quantity: 5 },
      { ...suggestion({ medicationId: 'm5' }), quantity: 0 },
    ]);
    expect(groups.map((g) => [g.supplierId, g.lines.length])).toEqual([['s1', 2], ['s2', 1]]);
    expect(withoutSupplier.map((l) => l.medicationId)).toEqual(['m4']);
  });

  it('builds order lines with the last cost', () => {
    expect(suggestionsToItems([{ ...suggestion({ kind: 'INVENTORY', medicationId: undefined, inventoryItemId: 'g1', lastUnitCost: null }), quantity: 4 }])).toEqual([
      { inventoryItemId: 'g1', quantity: 4, unitPrice: 0 },
    ]);
  });
});

describe('small helpers', () => {
  it('computes received percent, dates and names', () => {
    expect(receivedPercentOf([{ quantity: 10, quantityReceived: 5 }, { quantity: 10, quantityReceived: 0 }])).toBe(25);
    expect(receivedPercentOf([])).toBe(0);
    expect(addDaysIso('2026-10-28', 7)).toBe('2026-11-04');
    expect(personName({ firstName: 'Denis', lastName: 'Mballa' })).toBe('Denis Mballa');
    expect(personName({ name: 'Admin' })).toBe('Admin');
    expect(personName(null)).toBe('');
  });
});
