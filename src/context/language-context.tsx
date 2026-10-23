'use client';

import { createContext, useContext, useEffect, ReactNode, useCallback, useMemo, useSyncExternalStore } from 'react';
import { extraTranslations } from '@/locales';

type Language = 'en' | 'fr';

// Translation keys type
type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Translate an API enum value (e.g. O_POSITIVE, IN_PERSON); falls back to a humanized value */
  tEnum: (value: string | null | undefined) => string;
  /** BCP-47 locale matching the current language, for Intl/toLocale* calls */
  locale: string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: string, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (amount: number | string | null | undefined) => string;
  formatNumber: (value: number) => string;
}

const translations = {
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.all': 'All',
    'common.none': 'None',
    'common.submit': 'Submit',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.warning': 'Warning',
    'common.info': 'Info',

    // Auth
    'auth.login': 'Sign In',
    'auth.logout': 'Sign Out',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.rememberMe': 'Remember me',
    'auth.forgotPassword': 'Forgot password?',
    'auth.signingIn': 'Signing in...',
    'auth.loginSubtitle': 'Sign in to access the dashboard',
    'auth.needHelp': 'Need help? Contact your system administrator',
    'auth.loginFailed': 'Login failed',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.appointments': 'Appointments',
    'nav.patients': 'Patients',
    'nav.doctors': 'Doctors',
    'nav.departments': 'Departments',
    'nav.records': 'Medical Records',
    'nav.pharmacy': 'Pharmacy',
    'nav.laboratory': 'Laboratory',
    'nav.billing': 'Billing',
    'nav.inventory': 'Inventory',
    'nav.reports': 'Reports',
    'nav.users': 'Users',
    'nav.notifications': 'Notifications',
    'nav.settings': 'Settings',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.overview': 'Overview',
    'dashboard.totalPatients': 'Total Patients',
    'dashboard.todayAppointments': "Today's Appointments",
    'dashboard.activeDoctors': 'Active Doctors',
    'dashboard.pendingBills': 'Pending Bills',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.quickActions': 'Quick Actions',

    // Appointments
    'appointments.title': 'Appointments',
    'appointments.subtitle': 'Manage and track patient appointments',
    'appointments.new': 'New Appointment',
    'appointments.todayTotal': "Today's Total",
    'appointments.scheduled': 'Scheduled',
    'appointments.completed': 'Completed',
    'appointments.thisWeek': 'This Week',
    'appointments.patient': 'Patient',
    'appointments.doctor': 'Doctor',
    'appointments.date': 'Date',
    'appointments.time': 'Time',
    'appointments.type': 'Type',
    'appointments.reason': 'Reason',
    'appointments.inPerson': 'In Person',
    'appointments.video': 'Video Call',
    'appointments.phone': 'Phone Call',

    // Patients
    'patients.title': 'Patients',
    'patients.subtitle': 'Manage patient records and information',
    'patients.new': 'Add Patient',
    'patients.total': 'Total Patients',
    'patients.active': 'Active Patients',
    'patients.newThisMonth': 'New This Month',
    'patients.appointmentsToday': 'Appointments Today',
    'patients.name': 'Patient Name',
    'patients.hospitalId': 'Hospital ID',
    'patients.phone': 'Phone',
    'patients.contact': 'Contact',
    'patients.gender': 'Gender',
    'patients.age': 'Age',
    'patients.ageGender': 'Age / Gender',
    'patients.bloodType': 'Blood Type',
    'patients.lastVisit': 'Last Visit',
    'patients.allGender': 'All Gender',
    'patients.male': 'Male',
    'patients.female': 'Female',
    'patients.other': 'Other',
    'patients.selected': '{count} patient(s) selected',
    'patients.export': 'Export',
    'patients.clearSelection': 'Clear selection',
    'patients.loading': 'Loading patients...',

    // Doctors
    'doctors.title': 'Doctors',
    'doctors.subtitle': 'Manage doctor profiles and schedules',
    'doctors.new': 'Add Doctor',
    'doctors.total': 'Total Doctors',
    'doctors.available': 'Available',
    'doctors.unavailable': 'Unavailable',
    'doctors.specialization': 'Specialization',
    'doctors.department': 'Department',
    'doctors.departments': 'Departments',
    'doctors.schedule': 'Schedule',
    'doctors.consultationFee': 'Consultation Fee',
    'doctors.rating': 'Rating',
    'doctors.reviews': 'reviews',
    'doctors.todayAppointments': "Today's Appointments",
    'doctors.searchPlaceholder': 'Search doctors by name, email...',
    'doctors.allDepartments': 'All Departments',
    'doctors.allSpecializations': 'All Specializations',
    'doctors.viewProfile': 'View Profile',
    'doctors.adjustFilters': 'Try adjusting your search or filters',
    'doctors.getStarted': 'Get started by adding your first doctor',

    // Departments
    'departments.title': 'Departments',
    'departments.subtitle': 'Manage hospital departments',
    'departments.new': 'Add Department',
    'departments.name': 'Department Name',
    'departments.description': 'Description',
    'departments.doctorCount': 'Doctors',
    'departments.nurseCount': 'Nurses',
    'departments.staffCount': 'Staff',

    // Users
    'users.title': 'User Management',
    'users.subtitle': 'Manage system users and permissions',
    'users.new': 'Add User',
    'users.allUsers': 'All Users',
    'users.user': 'User',
    'users.firstName': 'First Name',
    'users.lastName': 'Last Name',
    'users.role': 'Role',
    'users.allRoles': 'All Roles',
    'users.department': 'Department',
    'users.hospitalId': 'Hospital ID',
    'users.lastLogin': 'Last Login',
    'users.never': 'Never',
    'users.searchPlaceholder': 'Search by name, email, or phone...',
    'users.pageOf': 'Page {page} of {totalPages}',
    'users.createUser': 'Create User',
    'users.editUser': 'Edit User',
    'users.deactivate': 'Deactivate User',
    'users.deactivating': 'Deactivating...',
    'users.deactivateConfirm': 'Are you sure you want to deactivate {name}? They will no longer be able to access the system.',

    // Records
    'records.title': 'Medical Records',
    'records.subtitle': 'View patient consultations and medical history',
    'records.total': 'Total Records',
    'records.today': 'Today',
    'records.thisWeek': 'This Week',
    'records.activeDoctors': 'Active Doctors',
    'records.chiefComplaint': 'Chief Complaint',
    'records.diagnosis': 'Diagnosis',
    'records.prescriptions': 'Prescriptions',
    'records.labOrders': 'Lab Orders',

    // Billing
    'billing.title': 'Billing',
    'billing.subtitle': 'Manage invoices and payments',
    'billing.totalRevenue': 'Total Revenue',
    'billing.pendingPayments': 'Pending Payments',
    'billing.paidToday': 'Paid Today',
    'billing.invoice': 'Invoice',
    'billing.amount': 'Amount',
    'billing.paid': 'Paid',
    'billing.pending': 'Pending',
    'billing.overdue': 'Overdue',

    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage your account and system preferences',
    'settings.appearance': 'Appearance',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.lightMode': 'Light',
    'settings.darkMode': 'Dark',
    'settings.systemMode': 'System',
    'settings.notifications': 'Notifications',
    'settings.security': 'Security',
    'settings.profile': 'Profile',
    'settings.profileInfo': 'Profile Information',
    'settings.system': 'System',
    'settings.phoneNumber': 'Phone Number',
    'settings.changePhoto': 'Change Photo',
    'settings.changePassword': 'Change Password',
    'settings.changingPassword': 'Changing...',
    'settings.currentPassword': 'Current Password',
    'settings.newPassword': 'New Password',
    'settings.confirmPassword': 'Confirm New Password',
    'settings.passwordRequirement': 'Must be at least 8 characters',
    'settings.twoFactor': 'Two-Factor Authentication',
    'settings.twoFactorDesc': 'Add an extra layer of security to your account by enabling two-factor authentication.',
    'settings.enable2FA': 'Enable 2FA',
    'settings.notificationPrefs': 'Notification Preferences',
    'settings.emailNotifications': 'Email Notifications',
    'settings.emailNotificationsDesc': 'Receive email for important updates',
    'settings.appointmentReminders': 'Appointment Reminders',
    'settings.appointmentRemindersDesc': 'Get notified before appointments',
    'settings.labResults': 'Lab Results',
    'settings.labResultsDesc': 'Notify when lab results are ready',
    'settings.prescriptionAlerts': 'Prescription Alerts',
    'settings.prescriptionAlertsDesc': 'Reminders for prescription refills',
    'settings.systemUpdates': 'System Updates',
    'settings.systemUpdatesDesc': 'News about system updates and features',
    'settings.marketingEmails': 'Marketing Emails',
    'settings.marketingEmailsDesc': 'Promotional content and newsletters',
    'settings.savePreferences': 'Save Preferences',
    'settings.systemSettings': 'System Settings',
    'settings.timezone': 'Timezone',
    'settings.dateFormat': 'Date Format',
    'settings.timeFormat': 'Time Format',
    'settings.currency': 'Currency',
    'settings.saveSettings': 'Save Settings',
    'settings.dangerZone': 'Danger Zone',
    'settings.dangerZoneDesc': 'These actions are irreversible. Please be careful.',
    'settings.exportData': 'Export Data',
    'settings.deleteAccount': 'Delete Account',

    // Roles
    'role.admin': 'Admin',
    'role.doctor': 'Doctor',
    'role.nurse': 'Nurse',
    'role.receptionist': 'Receptionist',
    'role.pharmacist': 'Pharmacist',
    'role.labTech': 'Lab Technician',
    'role.patient': 'Patient',

    // Status
    'status.scheduled': 'Scheduled',
    'status.confirmed': 'Confirmed',
    'status.checkedIn': 'Checked In',
    'status.inProgress': 'In Progress',
    'status.completed': 'Completed',
    'status.cancelled': 'Cancelled',
    'status.noShow': 'No Show',

    // Errors
    'error.generic': 'Something went wrong',
    'error.notFound': 'Not found',
    'error.unauthorized': 'Unauthorized',
    'error.forbidden': 'Access denied',
    'error.networkError': 'Network error',
    'error.tryAgain': 'Try again',
    'error.reloadPage': 'Reload page',

    // Empty states
    'empty.noData': 'No data available',
    'empty.noResults': 'No results found',
    'empty.noAppointments': 'No appointments found',
    'empty.noPatients': 'No patients found',
    'empty.noDoctors': 'No doctors found',
    'empty.noDepartments': 'No departments found',
    'empty.noRecords': 'No records found',

    // Dashboard additional
    'dashboard.viewAll': 'View all',
    'dashboard.appointmentsScheduled': 'appointments scheduled',
    'dashboard.noAppointmentsToday': 'No appointments scheduled for today',
    'dashboard.bookAppointment': 'Book an appointment',
    'dashboard.departmentOverview': 'Department Overview',
    'dashboard.doctorsAvailable': 'doctors available',
    'dashboard.appointmentsSummary': "Today's Appointment Summary",
    'dashboard.totalToday': 'Total Today',
    'dashboard.of': 'of',

    // Table headers
    'table.time': 'Time',
    'table.patient': 'Patient',
    'table.doctor': 'Doctor',
    'table.status': 'Status',
    'table.action': 'Action',
    'table.actions': 'Actions',
    'table.view': 'View',
    'table.dateTime': 'Date & Time',
    'table.type': 'Type',
    'table.reason': 'Reason',
    'table.showing': 'Showing',
    'table.to': 'to',
    'table.ofTotal': 'of',

    // Filters
    'filter.allDates': 'All Dates',
    'filter.today': 'Today',
    'filter.thisWeek': 'This Week',
    'filter.thisMonth': 'This Month',
    'filter.allStatus': 'All Status',
    'filter.allTypes': 'All Types',
    'filter.searchPlaceholder': 'Search by patient, doctor, or reason...',
    'filter.searchDepartments': 'Search departments...',
    'filter.showInactive': 'Show inactive',

    // Appointments additional
    'appointments.deleteTitle': 'Delete Appointment',
    'appointments.deleteConfirm': 'Are you sure you want to delete the appointment for {name}? This action cannot be undone.',
    'appointments.statusUpdated': 'Status updated',
    'appointments.statusChangedTo': 'Appointment status changed to',
    'appointments.deleted': 'Appointment deleted',
    'appointments.hasBeenRemoved': 'has been removed',
    'appointments.updateFailed': 'Update failed',
    'appointments.deleteFailed': 'Delete failed',
    'appointments.noAppointmentsFound': 'No appointments found',
    'appointments.adjustFilters': 'Try adjusting your search or filters',
    'appointments.getStarted': 'Get started by scheduling your first appointment',
    'appointments.retry': 'Retry',

    // Departments additional
    'departments.create': 'Create Department',
    'departments.edit': 'Edit Department',
    'departments.delete': 'Delete Department',
    'departments.deleteConfirm': 'Are you sure you want to delete {name}? This action cannot be undone.',
    'departments.nameRequired': 'Department name is required',
    'departments.created': 'Department created',
    'departments.hasBeenAdded': 'has been added',
    'departments.updated': 'Department updated',
    'departments.hasBeenUpdated': 'has been updated',
    'departments.deleted': 'Department deleted',
    'departments.hasBeenRemoved': 'has been removed',
    'departments.createFailed': 'Failed to create department',
    'departments.updateFailed': 'Failed to update department',
    'departments.deleteFailed': 'Failed to delete department',
    'departments.getStarted': 'Get started by adding your first department',
    'departments.placeholder': 'e.g., Cardiology',
    'departments.descPlaceholder': 'Brief description of the department...',

    // Records additional
    'records.noRecordsFound': 'No records found',
    'records.patient': 'Patient',
    'records.date': 'Date',
    'records.status': 'Status',

    // Form labels
    'form.required': 'Required',
    'form.optional': 'Optional',
    'form.creating': 'Creating...',
    'form.saving': 'Saving...',
    'form.deleting': 'Deleting...',
    'form.saveChanges': 'Save Changes',
  },
  fr: {
    // Common
    'common.loading': 'Chargement...',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.create': 'Créer',
    'common.search': 'Rechercher',
    'common.filter': 'Filtrer',
    'common.actions': 'Actions',
    'common.status': 'Statut',
    'common.active': 'Actif',
    'common.inactive': 'Inactif',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.all': 'Tous',
    'common.none': 'Aucun',
    'common.submit': 'Soumettre',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.previous': 'Précédent',
    'common.close': 'Fermer',
    'common.confirm': 'Confirmer',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.warning': 'Avertissement',
    'common.info': 'Information',

    // Auth
    'auth.login': 'Connexion',
    'auth.logout': 'Déconnexion',
    'auth.email': 'Adresse e-mail',
    'auth.password': 'Mot de passe',
    'auth.rememberMe': 'Se souvenir de moi',
    'auth.forgotPassword': 'Mot de passe oublié ?',
    'auth.signingIn': 'Connexion en cours...',
    'auth.loginSubtitle': 'Connectez-vous pour accéder au tableau de bord',
    'auth.needHelp': "Besoin d'aide ? Contactez votre administrateur système",
    'auth.loginFailed': 'Échec de la connexion',

    // Navigation
    'nav.dashboard': 'Tableau de bord',
    'nav.appointments': 'Rendez-vous',
    'nav.patients': 'Patients',
    'nav.doctors': 'Médecins',
    'nav.departments': 'Départements',
    'nav.records': 'Dossiers médicaux',
    'nav.pharmacy': 'Pharmacie',
    'nav.laboratory': 'Laboratoire',
    'nav.billing': 'Facturation',
    'nav.inventory': 'Inventaire',
    'nav.reports': 'Rapports',
    'nav.users': 'Utilisateurs',
    'nav.notifications': 'Notifications',
    'nav.settings': 'Paramètres',

    // Dashboard
    'dashboard.title': 'Tableau de bord',
    'dashboard.welcome': 'Bienvenue',
    'dashboard.overview': 'Aperçu',
    'dashboard.totalPatients': 'Total des patients',
    'dashboard.todayAppointments': "Rendez-vous d'aujourd'hui",
    'dashboard.activeDoctors': 'Médecins actifs',
    'dashboard.pendingBills': 'Factures en attente',
    'dashboard.recentActivity': 'Activité récente',
    'dashboard.quickActions': 'Actions rapides',

    // Appointments
    'appointments.title': 'Rendez-vous',
    'appointments.subtitle': 'Gérer et suivre les rendez-vous des patients',
    'appointments.new': 'Nouveau rendez-vous',
    'appointments.todayTotal': "Total d'aujourd'hui",
    'appointments.scheduled': 'Programmés',
    'appointments.completed': 'Terminés',
    'appointments.thisWeek': 'Cette semaine',
    'appointments.patient': 'Patient',
    'appointments.doctor': 'Médecin',
    'appointments.date': 'Date',
    'appointments.time': 'Heure',
    'appointments.type': 'Type',
    'appointments.reason': 'Motif',
    'appointments.inPerson': 'En personne',
    'appointments.video': 'Vidéo',
    'appointments.phone': 'Téléphone',

    // Patients
    'patients.title': 'Patients',
    'patients.subtitle': 'Gérer les dossiers et informations des patients',
    'patients.new': 'Ajouter un patient',
    'patients.total': 'Total des patients',
    'patients.active': 'Patients actifs',
    'patients.newThisMonth': 'Nouveaux ce mois',
    'patients.appointmentsToday': "Rendez-vous aujourd'hui",
    'patients.name': 'Nom du patient',
    'patients.hospitalId': 'ID Hôpital',
    'patients.phone': 'Téléphone',
    'patients.contact': 'Contact',
    'patients.gender': 'Genre',
    'patients.age': 'Âge',
    'patients.ageGender': 'Âge / Genre',
    'patients.bloodType': 'Groupe sanguin',
    'patients.lastVisit': 'Dernière visite',
    'patients.allGender': 'Tous les genres',
    'patients.male': 'Homme',
    'patients.female': 'Femme',
    'patients.other': 'Autre',
    'patients.selected': '{count} patient(s) sélectionné(s)',
    'patients.export': 'Exporter',
    'patients.clearSelection': 'Effacer la sélection',
    'patients.loading': 'Chargement des patients...',

    // Doctors
    'doctors.title': 'Médecins',
    'doctors.subtitle': 'Gérer les profils et plannings des médecins',
    'doctors.new': 'Ajouter un médecin',
    'doctors.total': 'Total des médecins',
    'doctors.available': 'Disponible',
    'doctors.unavailable': 'Indisponible',
    'doctors.specialization': 'Spécialisation',
    'doctors.department': 'Département',
    'doctors.departments': 'Départements',
    'doctors.schedule': 'Planning',
    'doctors.consultationFee': 'Frais de consultation',
    'doctors.rating': 'Note',
    'doctors.reviews': 'avis',
    'doctors.todayAppointments': "Rendez-vous aujourd'hui",
    'doctors.searchPlaceholder': 'Rechercher par nom, email...',
    'doctors.allDepartments': 'Tous les départements',
    'doctors.allSpecializations': 'Toutes les spécialisations',
    'doctors.viewProfile': 'Voir le profil',
    'doctors.adjustFilters': 'Essayez de modifier votre recherche ou vos filtres',
    'doctors.getStarted': 'Commencez par ajouter votre premier médecin',

    // Departments
    'departments.title': 'Départements',
    'departments.subtitle': 'Gérer les départements de l\'hôpital',
    'departments.new': 'Ajouter un département',
    'departments.name': 'Nom du département',
    'departments.description': 'Description',
    'departments.doctorCount': 'Médecins',
    'departments.nurseCount': 'Infirmiers',
    'departments.staffCount': 'Personnel',

    // Users
    'users.title': 'Gestion des utilisateurs',
    'users.subtitle': 'Gérer les utilisateurs et les permissions',
    'users.new': 'Ajouter un utilisateur',
    'users.allUsers': 'Tous les utilisateurs',
    'users.user': 'Utilisateur',
    'users.firstName': 'Prénom',
    'users.lastName': 'Nom',
    'users.role': 'Rôle',
    'users.allRoles': 'Tous les rôles',
    'users.department': 'Département',
    'users.hospitalId': 'ID Hôpital',
    'users.lastLogin': 'Dernière connexion',
    'users.never': 'Jamais',
    'users.searchPlaceholder': 'Rechercher par nom, email ou téléphone...',
    'users.pageOf': 'Page {page} sur {totalPages}',
    'users.createUser': 'Créer un utilisateur',
    'users.editUser': 'Modifier l\'utilisateur',
    'users.deactivate': 'Désactiver l\'utilisateur',
    'users.deactivating': 'Désactivation...',
    'users.deactivateConfirm': 'Êtes-vous sûr de vouloir désactiver {name} ? Il/Elle ne pourra plus accéder au système.',

    // Records
    'records.title': 'Dossiers médicaux',
    'records.subtitle': 'Consulter les consultations et l\'historique médical',
    'records.total': 'Total des dossiers',
    'records.today': "Aujourd'hui",
    'records.thisWeek': 'Cette semaine',
    'records.activeDoctors': 'Médecins actifs',
    'records.chiefComplaint': 'Motif principal',
    'records.diagnosis': 'Diagnostic',
    'records.prescriptions': 'Ordonnances',
    'records.labOrders': 'Analyses',

    // Billing
    'billing.title': 'Facturation',
    'billing.subtitle': 'Gérer les factures et les paiements',
    'billing.totalRevenue': 'Revenu total',
    'billing.pendingPayments': 'Paiements en attente',
    'billing.paidToday': "Payé aujourd'hui",
    'billing.invoice': 'Facture',
    'billing.amount': 'Montant',
    'billing.paid': 'Payé',
    'billing.pending': 'En attente',
    'billing.overdue': 'En retard',

    // Settings
    'settings.title': 'Paramètres',
    'settings.subtitle': 'Gérer votre compte et les préférences système',
    'settings.appearance': 'Apparence',
    'settings.language': 'Langue',
    'settings.theme': 'Thème',
    'settings.lightMode': 'Clair',
    'settings.darkMode': 'Sombre',
    'settings.systemMode': 'Système',
    'settings.notifications': 'Notifications',
    'settings.security': 'Sécurité',
    'settings.profile': 'Profil',
    'settings.profileInfo': 'Informations du profil',
    'settings.system': 'Système',
    'settings.phoneNumber': 'Numéro de téléphone',
    'settings.changePhoto': 'Changer la photo',
    'settings.changePassword': 'Changer le mot de passe',
    'settings.changingPassword': 'Modification...',
    'settings.currentPassword': 'Mot de passe actuel',
    'settings.newPassword': 'Nouveau mot de passe',
    'settings.confirmPassword': 'Confirmer le nouveau mot de passe',
    'settings.passwordRequirement': 'Doit contenir au moins 8 caractères',
    'settings.twoFactor': 'Authentification à deux facteurs',
    'settings.twoFactorDesc': 'Ajoutez une couche de sécurité supplémentaire à votre compte.',
    'settings.enable2FA': 'Activer 2FA',
    'settings.notificationPrefs': 'Préférences de notification',
    'settings.emailNotifications': 'Notifications par email',
    'settings.emailNotificationsDesc': 'Recevoir des emails pour les mises à jour importantes',
    'settings.appointmentReminders': 'Rappels de rendez-vous',
    'settings.appointmentRemindersDesc': 'Être notifié avant les rendez-vous',
    'settings.labResults': 'Résultats de laboratoire',
    'settings.labResultsDesc': 'Être notifié lorsque les résultats sont prêts',
    'settings.prescriptionAlerts': 'Alertes de prescription',
    'settings.prescriptionAlertsDesc': 'Rappels pour le renouvellement des ordonnances',
    'settings.systemUpdates': 'Mises à jour système',
    'settings.systemUpdatesDesc': 'Actualités sur les mises à jour et fonctionnalités',
    'settings.marketingEmails': 'Emails marketing',
    'settings.marketingEmailsDesc': 'Contenu promotionnel et newsletters',
    'settings.savePreferences': 'Enregistrer les préférences',
    'settings.systemSettings': 'Paramètres système',
    'settings.timezone': 'Fuseau horaire',
    'settings.dateFormat': 'Format de date',
    'settings.timeFormat': "Format d'heure",
    'settings.currency': 'Devise',
    'settings.saveSettings': 'Enregistrer les paramètres',
    'settings.dangerZone': 'Zone de danger',
    'settings.dangerZoneDesc': 'Ces actions sont irréversibles. Soyez prudent.',
    'settings.exportData': 'Exporter les données',
    'settings.deleteAccount': 'Supprimer le compte',

    // Roles
    'role.admin': 'Administrateur',
    'role.doctor': 'Médecin',
    'role.nurse': 'Infirmier(ère)',
    'role.receptionist': 'Réceptionniste',
    'role.pharmacist': 'Pharmacien(ne)',
    'role.labTech': 'Technicien de laboratoire',
    'role.patient': 'Patient',

    // Status
    'status.scheduled': 'Programmé',
    'status.confirmed': 'Confirmé',
    'status.checkedIn': 'Enregistré',
    'status.inProgress': 'En cours',
    'status.completed': 'Terminé',
    'status.cancelled': 'Annulé',
    'status.noShow': 'Absent',

    // Errors
    'error.generic': 'Une erreur est survenue',
    'error.notFound': 'Non trouvé',
    'error.unauthorized': 'Non autorisé',
    'error.forbidden': 'Accès refusé',
    'error.networkError': 'Erreur réseau',
    'error.tryAgain': 'Réessayer',
    'error.reloadPage': 'Recharger la page',

    // Empty states
    'empty.noData': 'Aucune donnée disponible',
    'empty.noResults': 'Aucun résultat trouvé',
    'empty.noAppointments': 'Aucun rendez-vous trouvé',
    'empty.noPatients': 'Aucun patient trouvé',
    'empty.noDoctors': 'Aucun médecin trouvé',
    'empty.noDepartments': 'Aucun département trouvé',
    'empty.noRecords': 'Aucun dossier trouvé',

    // Dashboard additional
    'dashboard.viewAll': 'Voir tout',
    'dashboard.appointmentsScheduled': 'rendez-vous programmés',
    'dashboard.noAppointmentsToday': "Aucun rendez-vous prévu aujourd'hui",
    'dashboard.bookAppointment': 'Prendre un rendez-vous',
    'dashboard.departmentOverview': 'Aperçu des départements',
    'dashboard.doctorsAvailable': 'médecins disponibles',
    'dashboard.appointmentsSummary': "Résumé des rendez-vous d'aujourd'hui",
    'dashboard.totalToday': "Total aujourd'hui",
    'dashboard.of': 'sur',

    // Table headers
    'table.time': 'Heure',
    'table.patient': 'Patient',
    'table.doctor': 'Médecin',
    'table.status': 'Statut',
    'table.action': 'Action',
    'table.actions': 'Actions',
    'table.view': 'Voir',
    'table.dateTime': 'Date et heure',
    'table.type': 'Type',
    'table.reason': 'Motif',
    'table.showing': 'Affichage',
    'table.to': 'à',
    'table.ofTotal': 'sur',

    // Filters
    'filter.allDates': 'Toutes les dates',
    'filter.today': "Aujourd'hui",
    'filter.thisWeek': 'Cette semaine',
    'filter.thisMonth': 'Ce mois',
    'filter.allStatus': 'Tous les statuts',
    'filter.allTypes': 'Tous les types',
    'filter.searchPlaceholder': 'Rechercher par patient, médecin ou motif...',
    'filter.searchDepartments': 'Rechercher des départements...',
    'filter.showInactive': 'Afficher les inactifs',

    // Appointments additional
    'appointments.deleteTitle': 'Supprimer le rendez-vous',
    'appointments.deleteConfirm': 'Êtes-vous sûr de vouloir supprimer le rendez-vous de {name} ? Cette action est irréversible.',
    'appointments.statusUpdated': 'Statut mis à jour',
    'appointments.statusChangedTo': 'Le statut du rendez-vous a été changé en',
    'appointments.deleted': 'Rendez-vous supprimé',
    'appointments.hasBeenRemoved': 'a été supprimé',
    'appointments.updateFailed': 'Échec de la mise à jour',
    'appointments.deleteFailed': 'Échec de la suppression',
    'appointments.noAppointmentsFound': 'Aucun rendez-vous trouvé',
    'appointments.adjustFilters': 'Essayez de modifier votre recherche ou vos filtres',
    'appointments.getStarted': 'Commencez par programmer votre premier rendez-vous',
    'appointments.retry': 'Réessayer',

    // Departments additional
    'departments.create': 'Créer un département',
    'departments.edit': 'Modifier le département',
    'departments.delete': 'Supprimer le département',
    'departments.deleteConfirm': 'Êtes-vous sûr de vouloir supprimer {name} ? Cette action est irréversible.',
    'departments.nameRequired': 'Le nom du département est requis',
    'departments.created': 'Département créé',
    'departments.hasBeenAdded': 'a été ajouté',
    'departments.updated': 'Département mis à jour',
    'departments.hasBeenUpdated': 'a été mis à jour',
    'departments.deleted': 'Département supprimé',
    'departments.hasBeenRemoved': 'a été supprimé',
    'departments.createFailed': 'Échec de la création du département',
    'departments.updateFailed': 'Échec de la mise à jour du département',
    'departments.deleteFailed': 'Échec de la suppression du département',
    'departments.getStarted': 'Commencez par ajouter votre premier département',
    'departments.placeholder': 'ex., Cardiologie',
    'departments.descPlaceholder': 'Brève description du département...',

    // Records additional
    'records.noRecordsFound': 'Aucun dossier trouvé',
    'records.patient': 'Patient',
    'records.date': 'Date',
    'records.status': 'Statut',

    // Form labels
    'form.required': 'Requis',
    'form.optional': 'Facultatif',
    'form.creating': 'Création...',
    'form.saving': 'Enregistrement...',
    'form.deleting': 'Suppression...',
    'form.saveChanges': 'Enregistrer les modifications',
  },
} as const;

interface LanguageContextTypeInternal extends LanguageContextType {
  mounted: boolean;
}

const LanguageContext = createContext<LanguageContextTypeInternal | undefined>(undefined);

const LANGUAGE_EVENT = 'hms-language-change';

// The chosen language lives in localStorage; useSyncExternalStore reads it without a
// setState-in-effect and keeps other tabs in sync. French is the default.
function subscribeLanguage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(LANGUAGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(LANGUAGE_EVENT, onChange);
  };
}

function readLanguage(): Language {
  return localStorage.getItem('language') === 'en' ? 'en' : 'fr';
}

const subscribeNothing = () => () => {};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeLanguage, readLanguage, () => 'fr' as Language);
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  // Keep <html lang> in sync for screen readers, spellcheck and hyphenation
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    localStorage.setItem('language', lang);
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  };

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const translationKey = key as TranslationKey;
    let text: string = (translations[language][translationKey] as string) ||
                       extraTranslations[language][key] ||
                       (translations.en[translationKey] as string) ||
                       extraTranslations.en[key] ||
                       key;

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.split(`{${paramKey}}`).join(String(value));
      });
    }

    return text;
  }, [language]);

  const helpers = useMemo(() => {
    const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
    // A bare YYYY-MM-DD is a calendar day: parse it as local midnight, not UTC
    const toDate = (value: string | Date) => {
      if (typeof value !== 'string') return value;
      const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
    };

    const tEnum = (value: string | null | undefined): string => {
      if (!value) return '';
      const key = `enum.${value}`;
      const translated = extraTranslations[language][key] || extraTranslations.en[key];
      if (translated) return translated;
      const words = value.toLowerCase().split('_').join(' ');
      return words.charAt(0).toUpperCase() + words.slice(1);
    };

    return {
      locale,
      tEnum,
      formatDate: (value: string | Date, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }) =>
        toDate(value).toLocaleDateString(locale, options),
      formatDateTime: (value: string | Date, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) =>
        toDate(value).toLocaleString(locale, options),
      formatTime: (value: string, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }) =>
        new Date(`1970-01-01T${value.length === 5 ? `${value}:00` : value}`).toLocaleTimeString(locale, options),
      // Cameroon uses XAF; always render as "15 000 FCFA" regardless of UI language
      formatCurrency: (amount: number | string | null | undefined) => {
        const n = Math.round(Number(amount) || 0);
        return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
      },
      formatNumber: (value: number) => new Intl.NumberFormat(locale).format(value),
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, mounted, ...helpers }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Language selector component
export function LanguageSelector({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${className}`}
    >
      <option value="en">English</option>
      <option value="fr">Français</option>
    </select>
  );
}

// Language toggle button
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${className}`}
      title={language === 'en' ? 'Passer en français' : 'Switch to English'}
      aria-label={language === 'en' ? 'Passer en français' : 'Switch to English'}
    >
      {language === 'en' ? 'FR' : 'EN'}
    </button>
  );
}
