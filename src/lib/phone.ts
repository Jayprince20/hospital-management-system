/**
 * Cameroon mobile numbers for mobile-money payments. Mirrors the backend rules
 * (backend/src/services/payments/phone.ts) so the form can suggest the operator as the
 * number is typed; the backend still has the final word.
 */
export type MobileMoneyOperator = 'MTN_MOMO' | 'ORANGE_MONEY';

/** 9-digit national number (6XXXXXXXX), or null if it isn't a Cameroon mobile number */
export function normalizeCameroonPhone(input: string): string | null {
  let digits = (input || '').replace(/\D/g, '');
  if (digits.startsWith('00237')) digits = digits.slice(5);
  else if (digits.startsWith('237') && digits.length === 12) digits = digits.slice(3);
  return /^6\d{8}$/.test(digits) ? digits : null;
}

/** MTN: 67, 68, 650–654 · Orange: 69, 655–659 */
export function operatorOf(input: string): MobileMoneyOperator | null {
  const number = normalizeCameroonPhone(input);
  if (!number) return null;
  const two = number.slice(0, 2);
  const three = Number(number.slice(0, 3));
  if (two === '67' || two === '68' || (three >= 650 && three <= 654)) return 'MTN_MOMO';
  if (two === '69' || (three >= 655 && three <= 659)) return 'ORANGE_MONEY';
  return null;
}

/** "+237 677 12 34 56" for display */
export function formatCameroonPhone(input: string): string {
  const n = normalizeCameroonPhone(input);
  if (!n) return input;
  return `+237 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}
