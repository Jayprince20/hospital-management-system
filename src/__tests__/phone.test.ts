import { describe, it, expect } from 'vitest';
import { normalizeCameroonPhone, operatorOf, formatCameroonPhone } from '@/lib/phone';

describe('Cameroon mobile numbers', () => {
  it('normalises the usual ways of writing a number', () => {
    for (const input of ['+237 677 12 34 56', '677123456', '237677123456', '00237 677-12-34-56']) {
      expect(normalizeCameroonPhone(input)).toBe('677123456');
    }
  });

  it('rejects numbers that are not Cameroon mobiles', () => {
    for (const input of ['', '12345', '222123456', '+33 6 12 34 56 78', '67712345']) {
      expect(normalizeCameroonPhone(input)).toBeNull();
    }
  });

  it('suggests the operator from the prefix', () => {
    expect(operatorOf('677123456')).toBe('MTN_MOMO');
    expect(operatorOf('681234567')).toBe('MTN_MOMO');
    expect(operatorOf('650123456')).toBe('MTN_MOMO');
    expect(operatorOf('654123456')).toBe('MTN_MOMO');
    expect(operatorOf('655123456')).toBe('ORANGE_MONEY');
    expect(operatorOf('659123456')).toBe('ORANGE_MONEY');
    expect(operatorOf('+237 699 12 34 56')).toBe('ORANGE_MONEY');
    expect(operatorOf('622123456')).toBeNull();
    expect(operatorOf('nonsense')).toBeNull();
  });

  it('formats for display', () => {
    expect(formatCameroonPhone('677123456')).toBe('+237 677 12 34 56');
    expect(formatCameroonPhone('abc')).toBe('abc');
  });
});
