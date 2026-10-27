import { describe, expect, it } from 'vitest';
import {
  canSetPrice,
  categoryLabel,
  emptyLine,
  isPriceChanged,
  lineFromTariff,
  lineProblem,
  lineToInput,
  payerTariffProblem,
  payerTariffValue,
  repriceLines,
  tariffsToCsv,
  type TariffItem,
  type TariffSearchItem,
} from '@/lib/price-list';

const dressing: TariffSearchItem = {
  kind: 'SERVICE',
  ref: 'srv-1',
  code: 'ACT-PANS-S',
  label: 'Pansement simple',
  category: 'procedure',
  listPrice: 2000,
  price: 2000,
  payerAdjusted: false,
};

describe('invoice lines from the price list', () => {
  it('takes label, category and price from the list', () => {
    const line = lineFromTariff(dressing, 2);
    expect(line).toMatchObject({ description: 'Pansement simple', category: 'procedure', unitPrice: 2000, listPrice: 2000, quantity: 2, tariff: { kind: 'SERVICE', ref: 'srv-1' } });
    expect(isPriceChanged(line)).toBe(false);
    // No price sent: the server applies the list or payer price (the form may not know the payer yet)
    expect(lineToInput(line)).toEqual({ description: 'Pansement simple', quantity: 2, category: 'procedure', tariff: { kind: 'SERVICE', ref: 'srv-1' } });
  });

  it('sends the reason only when the price was changed', () => {
    const line = { ...lineFromTariff(dressing), unitPrice: 1500, overrideReason: '  Cas social  ' };
    expect(lineToInput(line)).toMatchObject({ unitPrice: 1500, overrideReason: 'Cas social' });
  });

  it('lets a receptionist lower a price with a reason but not raise it', () => {
    expect(canSetPrice('RECEPTIONIST', 2000, 1500)).toBe(true);
    expect(canSetPrice('RECEPTIONIST', 2000, 2500)).toBe(false);
    expect(canSetPrice('ADMIN', 2000, 2500)).toBe(true);
    expect(canSetPrice('DOCTOR', 2000, 1500)).toBe(false);
    const lower = { ...lineFromTariff(dressing), unitPrice: 1500 };
    expect(lineProblem(lower, 'RECEPTIONIST')).toBe('pl.err.reason');
    expect(lineProblem({ ...lower, overrideReason: 'Remise' }, 'RECEPTIONIST')).toBeNull();
    expect(lineProblem({ ...lower, unitPrice: 3000, overrideReason: 'Urgence' }, 'RECEPTIONIST')).toBe('pl.err.increase');
  });

  it('keeps free lines for administrators', () => {
    const free = { ...emptyLine(), description: 'Photocopie du dossier', unitPrice: 500 };
    expect(lineProblem(free, 'RECEPTIONIST')).toBe('pl.err.pickFromList');
    expect(lineProblem(free, 'ADMIN')).toBeNull();
    expect(lineProblem(emptyLine(), 'ADMIN')).toBe('pl.err.freeLine');
    expect(lineToInput(free)).not.toHaveProperty('tariff');
  });

  it('moves untouched lines to the payer price and keeps changed ones', () => {
    const untouched = lineFromTariff(dressing);
    const changed = { ...lineFromTariff({ ...dressing, ref: 'srv-2', code: 'ACT-INJ' }), unitPrice: 800, overrideReason: 'Remise' };
    const prices = new Map<string, TariffSearchItem>([
      ['SERVICE:srv-1', { ...dressing, price: 1600, payerAdjusted: true }],
      ['SERVICE:srv-2', { ...dressing, ref: 'srv-2', price: 1800, payerAdjusted: true }],
    ]);
    const [a, b] = repriceLines([untouched, changed], prices);
    expect(a).toMatchObject({ unitPrice: 1600, listPrice: 1600, payerAdjusted: true });
    expect(b).toMatchObject({ unitPrice: 800, listPrice: 1800 });
    expect(a.uid).toBe(untouched.uid);
  });
});

describe('negotiated payer prices', () => {
  it('needs exactly one of fixed price or percentage', () => {
    const base = { tariffRef: 'lab-1', price: '', discountPercent: '', validFrom: '', validUntil: '' };
    expect(payerTariffProblem(base)).toBe('pl.payer.err.oneOf');
    expect(payerTariffProblem({ ...base, price: '1000', discountPercent: '10' })).toBe('pl.payer.err.oneOf');
    expect(payerTariffProblem({ ...base, tariffRef: null, price: '1000' })).toBe('pl.payer.err.priceNeedsAct');
    expect(payerTariffProblem({ ...base, tariffRef: null, discountPercent: '110' })).toBe('pl.payer.err.percent');
    expect(payerTariffProblem({ ...base, discountPercent: '10', validFrom: '2026-12-01', validUntil: '2026-11-01' })).toBe('pl.payer.err.dates');
    expect(payerTariffProblem({ ...base, tariffRef: null, discountPercent: '10' })).toBeNull();
  });

  it('shows a fixed price or a discount', () => {
    const fmt = (n: number) => `${n} FCFA`;
    expect(payerTariffValue({ price: 4500, discountPercent: null }, fmt)).toBe('4500 FCFA');
    expect(payerTariffValue({ price: null, discountPercent: 10 }, fmt)).toBe('−10 %');
  });
});

describe('price list export', () => {
  it('writes a semicolon CSV and quotes awkward cells', () => {
    const items: TariffItem[] = [
      { kind: 'SERVICE', ref: '1', code: 'ACT-PANS-S', label: 'Pansement simple', category: 'procedure', listPrice: 2000, updatedAt: '2026-10-25', active: true },
      { kind: 'LAB_TEST', ref: '2', code: null, label: 'NFS; plaquettes "complète"', category: 'lab', listPrice: 6000, updatedAt: '2026-10-25', active: false },
    ];
    const csv = tariffsToCsv(items, (kind) => (kind === 'SERVICE' ? 'Actes' : 'Laboratoire'), ['Type', 'Code', 'Libellé', 'Catégorie', 'Prix', 'Statut']);
    expect(csv.split('\n')).toEqual([
      'Type;Code;Libellé;Catégorie;Prix;Statut',
      'Actes;ACT-PANS-S;Pansement simple;procedure;2000;oui',
      'Laboratoire;;"NFS; plaquettes ""complète""";lab;6000;non',
      '',
    ]);
  });

  it('falls back to the raw category when there is no translation', () => {
    const t = (key: string) => (key === 'admin.billing.cat.lab' ? 'Laboratoire' : key);
    expect(categoryLabel(t, 'lab')).toBe('Laboratoire');
    expect(categoryLabel(t, 'BED')).toBe('BED');
  });
});
