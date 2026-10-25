import type { LocaleDictionary } from './types';
import common from './common';
import lab from './lab';
import patients from './patients';
import appointments from './appointments';
import pharmacy from './pharmacy';
import clinical from './clinical';
import admin from './admin';
import audit from './audit';
import privacy from './privacy';
import security from './security';
import ops from './ops';
import payments from './payments';
import insurance from './insurance';
import queue from './queue';
import inpatient from './inpatient';
import pharmacyPos from './pharmacy-pos';
import documentsMedical from './documents-medical';
import imaging from './imaging';
import patientExtras from './patient-extras';
import labWorkflow from './lab-workflow';
import rosters from './rosters';
import purchasing from './purchasing';
import cashDesk from './cash-desk';
import statistics from './statistics';
import teleconsultation from './teleconsultation';
import clinicalSafety from './clinical-safety';
import priceList from './price-list';

// Register feature dictionaries here. Later entries override earlier ones.
const dictionaries: LocaleDictionary[] = [common, lab, patients, appointments, pharmacy, clinical, admin, audit, privacy, security, ops, payments, insurance, queue, inpatient, pharmacyPos, documentsMedical, imaging, patientExtras, labWorkflow, rosters, purchasing, cashDesk, statistics, teleconsultation, clinicalSafety, priceList];

export const extraTranslations: LocaleDictionary = dictionaries.reduce<LocaleDictionary>(
  (acc, dict) => ({ en: { ...acc.en, ...dict.en }, fr: { ...acc.fr, ...dict.fr } }),
  { en: {}, fr: {} }
);
