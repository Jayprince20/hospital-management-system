import type { LocaleDictionary } from './types';
import common from './common';
import lab from './lab';
import patients from './patients';
import appointments from './appointments';
import pharmacy from './pharmacy';
import clinical from './clinical';
import admin from './admin';

// Register feature dictionaries here. Later entries override earlier ones.
const dictionaries: LocaleDictionary[] = [common, lab, patients, appointments, pharmacy, clinical, admin];

export const extraTranslations: LocaleDictionary = dictionaries.reduce<LocaleDictionary>(
  (acc, dict) => ({ en: { ...acc.en, ...dict.en }, fr: { ...acc.fr, ...dict.fr } }),
  { en: {}, fr: {} }
);
