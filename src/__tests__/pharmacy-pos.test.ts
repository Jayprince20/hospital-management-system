import { describe, it, expect } from 'vitest';
import {
  addToCart,
  cartTotals,
  changeDue,
  daysUntil,
  discountNeedsAdmin,
  expiryStatus,
  externalRxProblem,
  paymentNeedsReference,
  refundAmount,
  returnableQty,
} from '@/lib/pharmacy-pos';

const today = new Date(2026, 9, 24); // 24 Oct 2026

describe('cart totals', () => {
  it('adds lines and caps the discount at the subtotal', () => {
    const lines = [{ medicationId: 'a', quantity: 2, unitPrice: 500 }, { medicationId: 'b', quantity: 1, unitPrice: 1500 }];
    expect(cartTotals(lines)).toEqual({ subtotal: 2500, discount: 0, total: 2500 });
    expect(cartTotals(lines, 300)).toEqual({ subtotal: 2500, discount: 300, total: 2200 });
    expect(cartTotals(lines, 9999).total).toBe(0);
    expect(cartTotals(lines, -50).discount).toBe(0);
  });
});

describe('change', () => {
  it('is the tendered amount minus the total, or null when short', () => {
    expect(changeDue(2200, 5000)).toBe(2800);
    expect(changeDue(2200, 2200)).toBe(0);
    expect(changeDue(2200, 2000)).toBeNull();
    expect(changeDue(2200, undefined)).toBeNull();
  });
});

describe('discount rule', () => {
  it('lets a pharmacist give up to 10 %, an admin any amount', () => {
    expect(discountNeedsAdmin(250, 2500, 'PHARMACIST')).toBe(false);
    expect(discountNeedsAdmin(251, 2500, 'PHARMACIST')).toBe(true);
    expect(discountNeedsAdmin(2000, 2500, 'ADMIN')).toBe(false);
  });
});

describe('payment reference', () => {
  it('is needed for card and mobile money only', () => {
    expect(paymentNeedsReference('CASH')).toBe(false);
    expect(paymentNeedsReference('MTN_MOMO')).toBe(true);
    expect(paymentNeedsReference('CARD')).toBe(true);
  });
});

describe('expiry', () => {
  it('counts days and classifies batches', () => {
    expect(daysUntil('2026-10-25', today)).toBe(1);
    expect(daysUntil('2026-10-23', today)).toBe(-1);
    expect(expiryStatus('2026-10-23', today)).toBe('EXPIRED');
    expect(expiryStatus('2026-11-20', today)).toBe('CRITICAL');
    expect(expiryStatus('2027-01-10', today)).toBe('SOON');
    expect(expiryStatus('2028-01-01', today)).toBe('OK');
    expect(expiryStatus(null, today)).toBe('OK');
  });
});

describe('outside prescription', () => {
  it('needs a prescriber and a date within the last 3 months, not in the future', () => {
    expect(externalRxProblem('', '2026-10-20', today)).toBe('MISSING');
    expect(externalRxProblem('Dr Ewane', '', today)).toBe('MISSING');
    expect(externalRxProblem('Dr Ewane', '2026-10-30', today)).toBe('FUTURE');
    expect(externalRxProblem('Dr Ewane', '2026-07-01', today)).toBe('TOO_OLD');
    expect(externalRxProblem('Dr Ewane', '2026-08-01', today)).toBeNull();
  });
});

describe('returns', () => {
  it('refunds the lines minus their share of the discount', () => {
    expect(refundAmount([{ quantity: 1, unitPrice: 1000 }], { subtotal: 2000, discount: 200 })).toBe(900);
    expect(refundAmount([{ quantity: 2, unitPrice: 1000 }], { subtotal: 2000, discount: 0 })).toBe(2000);
    expect(refundAmount([], { subtotal: 2000, discount: 0 })).toBe(0);
  });
  it('allows returning only what was not returned yet', () => {
    expect(returnableQty({ quantity: 5, returnedQty: 2 })).toBe(3);
    expect(returnableQty({ quantity: 2, returnedQty: 3 })).toBe(0);
  });
});

describe('add to cart', () => {
  it('merges the same medication and respects the stock cap', () => {
    const cart = addToCart([], { medicationId: 'a', quantity: 1 }, 2);
    expect(addToCart(cart, { medicationId: 'a', quantity: 5 }, 2)).toEqual([{ medicationId: 'a', quantity: 2 }]);
    expect(addToCart(cart, { medicationId: 'b', quantity: 1 })).toHaveLength(2);
  });
});
