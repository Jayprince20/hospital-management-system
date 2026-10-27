/** The backend's password rules (backend/src/shared/dto/auth.dto.ts), shown live as the user types */
export const PASSWORD_RULES = [
  { key: 'length', test: (p: string) => p.length >= 8 },
  { key: 'upper', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', test: (p: string) => /[a-z]/.test(p) },
  { key: 'digit', test: (p: string) => /\d/.test(p) },
  { key: 'special', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
] as const;

export function passwordMeetsRules(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
