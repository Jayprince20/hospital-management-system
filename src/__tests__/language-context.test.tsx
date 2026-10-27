import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEffect } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/context/language-context';

type Helpers = ReturnType<typeof useLanguage>;

function Probe({ onReady }: { onReady: (helpers: Helpers) => void }) {
  const helpers = useLanguage();
  useEffect(() => {
    onReady(helpers);
  }, [helpers, onReady]);
  return <span data-testid="lang">{helpers.language}</span>;
}

// Render the provider and hand back its helpers (effects flush inside render's act())
function renderHelpers(): Helpers {
  let captured: Helpers | null = null;
  render(
    <LanguageProvider>
      <Probe
        onReady={(helpers) => {
          captured = helpers;
        }}
      />
    </LanguageProvider>
  );
  return captured!;
}

describe('language helpers', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    process.env.TZ = 'Africa/Douala';
  });

  it('defaults to French', () => {
    renderHelpers();
    expect(screen.getByTestId('lang').textContent).toBe('fr');
  });

  it('uses English when chosen', () => {
    localStorage.setItem('language', 'en');
    const h = renderHelpers();
    expect(h.language).toBe('en');
    expect(h.tEnum('PAID')).toBe('Paid');
  });

  it('translates known API values and humanises unknown ones', () => {
    const h = renderHelpers();
    expect(h.tEnum('O_POSITIVE')).toBe('O+');
    expect(h.tEnum('IN_PERSON')).toBe('En personne');
    expect(h.tEnum('SOME_NEW_VALUE')).toBe('Some new value');
    expect(h.tEnum(null)).toBe('');
  });

  it('formats money as FCFA with space-grouped thousands', () => {
    const h = renderHelpers();
    expect(h.formatCurrency(15000)).toBe('15 000 FCFA');
    expect(h.formatCurrency(1234567.6)).toBe('1 234 568 FCFA');
    expect(h.formatCurrency('2500')).toBe('2 500 FCFA');
    expect(h.formatCurrency(null)).toBe('0 FCFA');
    expect(h.formatCurrency(0)).toBe('0 FCFA');
  });

  it('keeps a YYYY-MM-DD date on the same calendar day in Douala', () => {
    const h = renderHelpers();
    expect(h.formatDate('2026-10-23', { day: 'numeric', month: 'numeric', year: 'numeric' })).toBe('23/10/2026');
  });

  it('keeps a YYYY-MM-DD date on the same calendar day west of Greenwich', () => {
    process.env.TZ = 'America/New_York';
    const h = renderHelpers();
    // new Date('2026-10-23') would be 22 Oct, 20:00 in New York
    expect(h.formatDate('2026-10-23', { day: 'numeric', month: 'numeric', year: 'numeric' })).toBe('23/10/2026');
  });

  it('substitutes every occurrence of a parameter', () => {
    const h = renderHelpers();
    expect(h.t('search.noResults', { query: 'abc' })).toContain('abc');
  });
});
