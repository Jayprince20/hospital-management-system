import type { LocaleDictionary } from './types';

// Shared vocabulary: enum values coming from the API, generic UI words, units.
// Enum keys follow `enum.<VALUE>` so any page can render an API value with tEnum().
const common: LocaleDictionary = {
  en: {
    // Navigation items not covered by the core dictionary
    'nav.myHealth': 'My Health',
    'nav.mySchedule': 'My Schedule',
    'nav.myPatients': 'My Patients',
    'nav.vitals': 'Vital Signs',
    'nav.consultations': 'Consultations',
    'nav.prescriptions': 'Prescriptions',
    'nav.labResults': 'Lab Results',
    'nav.payments': 'Payments',

    // Header search
    'search.placeholder': 'Search patients, doctors, appointments...',
    'search.patients': 'Patients',
    'search.doctors': 'Doctors',
    'search.noResults': 'No results for "{query}"',
    'search.searching': 'Searching...',
    'search.viewAllPatients': 'See all matching patients',

    'auth.invalidCredentials': 'Invalid email or password',

    // Theme
    'theme.toLight': 'Switch to light mode',
    'theme.toDark': 'Switch to dark mode',

    // Access
    'access.deniedTitle': 'Access Denied',
    'access.deniedMessage': 'You do not have permission to access this page.',
    'access.backToDashboard': 'Back to Dashboard',

    // Units
    'unit.years': '{count} yrs',
    'unit.year': '{count} yr',

    // Gender
    'enum.MALE': 'Male',
    'enum.FEMALE': 'Female',
    'enum.OTHER': 'Other',

    // Blood types
    'enum.A_POSITIVE': 'A+',
    'enum.A_NEGATIVE': 'A-',
    'enum.B_POSITIVE': 'B+',
    'enum.B_NEGATIVE': 'B-',
    'enum.AB_POSITIVE': 'AB+',
    'enum.AB_NEGATIVE': 'AB-',
    'enum.O_POSITIVE': 'O+',
    'enum.O_NEGATIVE': 'O-',

    // Generic statuses
    'enum.ACTIVE': 'Active',
    'enum.INACTIVE': 'Inactive',
    'enum.PENDING': 'Pending',
    'enum.COMPLETED': 'Completed',
    'enum.CANCELLED': 'Cancelled',
    'enum.IN_PROGRESS': 'In Progress',

    // Appointments
    'enum.SCHEDULED': 'Scheduled',
    'enum.CONFIRMED': 'Confirmed',
    'enum.CHECKED_IN': 'Checked In',
    'enum.NO_SHOW': 'No Show',
    'enum.RESCHEDULED': 'Rescheduled',
    'enum.IN_PERSON': 'In Person',
    'enum.VIDEO': 'Video Call',
    'enum.PHONE': 'Phone Call',

    // Prescriptions
    'enum.DISPENSED': 'Dispensed',
    'enum.PARTIALLY_DISPENSED': 'Partially Dispensed',
    'enum.EXPIRED': 'Expired',

    // Invoices / payments
    'enum.DRAFT': 'Draft',
    'enum.PAID': 'Paid',
    'enum.PARTIALLY_PAID': 'Partially Paid',
    'enum.OVERDUE': 'Overdue',
    'enum.REFUNDED': 'Refunded',
    'enum.FAILED': 'Failed',
    'enum.CASH': 'Cash',
    'enum.CARD': 'Card',
    'enum.MOBILE_MONEY': 'Mobile Money',
    'enum.MOBILE_WALLET': 'Mobile Wallet',
    'enum.BANK_TRANSFER': 'Bank Transfer',
    'enum.INSURANCE': 'Insurance',

    // Lab
    'enum.ORDERED': 'Ordered',
    'enum.SAMPLE_COLLECTED': 'Sample Collected',
    'enum.PROCESSING': 'Processing',
    'enum.ROUTINE': 'Routine',
    'enum.URGENT': 'Urgent',
    'enum.STAT': 'STAT',
    'enum.NORMAL': 'Normal',
    'enum.ABNORMAL': 'Abnormal',
    'enum.CRITICAL': 'Critical',

    // Roles
    'enum.ADMIN': 'Administrator',
    'enum.DOCTOR': 'Doctor',
    'enum.NURSE': 'Nurse',
    'enum.RECEPTIONIST': 'Receptionist',
    'enum.PHARMACIST': 'Pharmacist',
    'enum.LAB_TECH': 'Lab Technician',
    'enum.PATIENT': 'Patient',

    // Stock
    'enum.IN_STOCK': 'In Stock',
    'enum.LOW_STOCK': 'Low Stock',
    'enum.OUT_OF_STOCK': 'Out of Stock',
    'enum.EXPIRING_SOON': 'Expiring Soon',
  },
  fr: {
    'nav.myHealth': 'Ma santé',
    'nav.mySchedule': 'Mon planning',
    'nav.myPatients': 'Mes patients',
    'nav.vitals': 'Signes vitaux',
    'nav.consultations': 'Consultations',
    'nav.prescriptions': 'Ordonnances',
    'nav.labResults': 'Résultats de laboratoire',
    'nav.payments': 'Paiements',

    'search.placeholder': 'Rechercher patients, médecins, rendez-vous...',
    'search.patients': 'Patients',
    'search.doctors': 'Médecins',
    'search.noResults': 'Aucun résultat pour « {query} »',
    'search.searching': 'Recherche...',
    'search.viewAllPatients': 'Voir tous les patients correspondants',

    'auth.invalidCredentials': 'E-mail ou mot de passe incorrect',

    'theme.toLight': 'Passer en mode clair',
    'theme.toDark': 'Passer en mode sombre',

    'access.deniedTitle': 'Accès refusé',
    'access.deniedMessage': "Vous n'avez pas l'autorisation d'accéder à cette page.",
    'access.backToDashboard': 'Retour au tableau de bord',

    'unit.years': '{count} ans',
    'unit.year': '{count} an',

    'enum.MALE': 'Homme',
    'enum.FEMALE': 'Femme',
    'enum.OTHER': 'Autre',

    'enum.A_POSITIVE': 'A+',
    'enum.A_NEGATIVE': 'A-',
    'enum.B_POSITIVE': 'B+',
    'enum.B_NEGATIVE': 'B-',
    'enum.AB_POSITIVE': 'AB+',
    'enum.AB_NEGATIVE': 'AB-',
    'enum.O_POSITIVE': 'O+',
    'enum.O_NEGATIVE': 'O-',

    'enum.ACTIVE': 'Actif',
    'enum.INACTIVE': 'Inactif',
    'enum.PENDING': 'En attente',
    'enum.COMPLETED': 'Terminé',
    'enum.CANCELLED': 'Annulé',
    'enum.IN_PROGRESS': 'En cours',

    'enum.SCHEDULED': 'Programmé',
    'enum.CONFIRMED': 'Confirmé',
    'enum.CHECKED_IN': 'Enregistré',
    'enum.NO_SHOW': 'Absent',
    'enum.RESCHEDULED': 'Reprogrammé',
    'enum.IN_PERSON': 'En personne',
    'enum.VIDEO': 'Appel vidéo',
    'enum.PHONE': 'Appel téléphonique',

    'enum.DISPENSED': 'Délivrée',
    'enum.PARTIALLY_DISPENSED': 'Partiellement délivrée',
    'enum.EXPIRED': 'Expirée',

    'enum.DRAFT': 'Brouillon',
    'enum.PAID': 'Payée',
    'enum.PARTIALLY_PAID': 'Partiellement payée',
    'enum.OVERDUE': 'En retard',
    'enum.REFUNDED': 'Remboursée',
    'enum.FAILED': 'Échoué',
    'enum.CASH': 'Espèces',
    'enum.CARD': 'Carte',
    'enum.MOBILE_MONEY': 'Mobile Money',
    'enum.MOBILE_WALLET': 'Portefeuille mobile',
    'enum.BANK_TRANSFER': 'Virement bancaire',
    'enum.INSURANCE': 'Assurance',

    'enum.ORDERED': 'Prescrit',
    'enum.SAMPLE_COLLECTED': 'Échantillon prélevé',
    'enum.PROCESSING': 'En analyse',
    'enum.ROUTINE': 'Routine',
    'enum.URGENT': 'Urgent',
    'enum.STAT': 'Très urgent',
    'enum.NORMAL': 'Normal',
    'enum.ABNORMAL': 'Anormal',
    'enum.CRITICAL': 'Critique',

    'enum.ADMIN': 'Administrateur',
    'enum.DOCTOR': 'Médecin',
    'enum.NURSE': 'Infirmier(ère)',
    'enum.RECEPTIONIST': 'Réceptionniste',
    'enum.PHARMACIST': 'Pharmacien(ne)',
    'enum.LAB_TECH': 'Technicien(ne) de laboratoire',
    'enum.PATIENT': 'Patient',

    'enum.IN_STOCK': 'En stock',
    'enum.LOW_STOCK': 'Stock faible',
    'enum.OUT_OF_STOCK': 'Rupture de stock',
    'enum.EXPIRING_SOON': 'Expire bientôt',
  },
};

export default common;
