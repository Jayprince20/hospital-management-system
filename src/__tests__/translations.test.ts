import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { extraTranslations } from '@/locales';
import type { LocaleDictionary } from '@/locales/types';

const SRC = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

// The core dictionary lives inside language-context.tsx: read its keys from the source
function coreKeys(): { en: Set<string>; fr: Set<string> } {
  const text = fs.readFileSync(path.join(SRC, 'context/language-context.tsx'), 'utf8');
  const frStart = text.indexOf('\n  fr: {');
  const keysIn = (chunk: string) => new Set([...chunk.matchAll(/\n\s+'([^']+)':/g)].map((m) => m[1]));
  return { en: keysIn(text.slice(0, frStart)), fr: keysIn(text.slice(frStart, text.indexOf('} as const'))) };
}

// Every literal t('key') call in the app
function usedKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const file of sourceFiles(SRC)) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      if (!keys.has(match[1])) keys.set(match[1], path.relative(SRC, file));
    }
  }
  return keys;
}

describe('translations', () => {
  const core = coreKeys();

  it('finds the core dictionary', () => {
    expect(core.en.size).toBeGreaterThan(100);
    expect(core.fr.size).toBe(core.en.size);
  });

  it('resolves every t() key used in the app in both languages', () => {
    const missing: string[] = [];
    for (const [key, file] of usedKeys()) {
      const inEn = core.en.has(key) || key in extraTranslations.en;
      const inFr = core.fr.has(key) || key in extraTranslations.fr;
      if (!inEn || !inFr) missing.push(`${key} (${file}): ${inEn ? '' : 'en '}${inFr ? '' : 'fr'}`);
    }
    expect(missing).toEqual([]);
  });

  it('has the same keys in English and French in every locale file', async () => {
    const dir = path.join(SRC, 'locales');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts', 'backend-errors.ts'].includes(f));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const dict = (await import(`@/locales/${file.replace(/\.ts$/, '')}`)).default as LocaleDictionary;
      const en = Object.keys(dict.en);
      const fr = new Set(Object.keys(dict.fr));
      expect(en.filter((k) => !fr.has(k)), `${file}: missing in fr`).toEqual([]);
      expect([...fr].filter((k) => !(k in dict.en)), `${file}: missing in en`).toEqual([]);
    }
  });

  it('has no sentence left untranslated in French', () => {
    // Short labels can legitimately match (Consultations, Notifications, Total…); sentences cannot.
    // Proper names that are the same in both languages are listed here.
    const sameInBothLanguages = new Set(['admin.settings.tz.douala']);
    const untranslated = Object.entries(extraTranslations.fr).filter(
      ([key, fr]) =>
        !sameInBothLanguages.has(key) &&
        fr === extraTranslations.en[key] &&
        // a sentence = at least 3 lowercase words once {placeholders} are removed
        // (names, acronyms and units such as "Lagos (WAT, UTC+1)" or "{h} h {m} min" don't count)
        (fr.replace(/\{\w+\}/g, '').match(/(?<![A-Za-zÀ-ÿ])[a-zà-ÿ]{3,}/g) ?? []).length >= 3
    );
    expect(untranslated.map(([key, value]) => `${key}: ${value}`)).toEqual([]);
  });
});
