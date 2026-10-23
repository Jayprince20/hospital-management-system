import { describe, it, expect } from 'vitest';
import { PASSWORD_RULES, passwordMeetsRules } from '@/lib/password-rules';

// Must stay in step with the backend's passwordRegex (backend/src/shared/dto/auth.dto.ts)
const backendRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

describe('password rules', () => {
  const samples = ['short1!A', 'alllowercase1!', 'ALLUPPER1!', 'NoDigits!!', 'NoSpecial12', 'Valid#2026x', 'Ab1!', 'Clinique@237'];

  it('agree with the backend for every sample', () => {
    for (const sample of samples) {
      expect(passwordMeetsRules(sample), sample).toBe(backendRegex.test(sample));
    }
  });

  it('report each missing rule', () => {
    const failing = PASSWORD_RULES.filter((rule) => !rule.test('abcdefgh')).map((rule) => rule.key);
    expect(failing).toEqual(['upper', 'digit', 'special']);
  });
});
