'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, type AdmissionDetail } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { AdmissionStatusBadge, DischargeDialog, ReasonDialog, TransferDialog, cardClass, useDaysLabel } from '@/components/inpatient';
import { BillingTab, HistoryTab, MarTab, NotesTab, OrdersTab, OverviewTab } from '@/components/inpatient/admission-tabs';
import { NewDocumentDialog } from '@/components/documents';
import { NewImagingOrderDialog } from '@/components/imaging';

type Tab = 'overview' | 'notes' | 'orders' | 'mar' | 'billing' | 'history';
type Dialog = 'transfer' | 'discharge' | 'cancel' | 'sick-leave' | 'referral' | 'imaging' | null;

export default function AdmissionPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t, language, formatDate, formatDateTime } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const daysLabel = useDaysLabel();
  const role = user?.role;
  const isDoctor = role === 'DOCTOR' || role === 'ADMIN';
  const canTransfer = isDoctor || role === 'NURSE';
  const clinical = isDoctor || role === 'NURSE';
  const canBill = role === 'ADMIN' || role === 'RECEPTIONIST' || role === 'DOCTOR' || role === 'NURSE';

  const [admission, setAdmission] = useState<AdmissionDetail | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(role === 'RECEPTIONIST' ? 'billing' : 'overview');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [downloading, setDownloading] = useState(false);
  // Discharge may report that the stay was billed without the insurer (prise en charge missing)
  const [coverageWarning, setCoverageWarning] = useState<AdmissionDetail['coverageWarning']>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getAdmission(id);
      setAdmission(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('inp.loadFailed'));
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadSummary = async () => {
    if (!admission) return;
    setDownloading(true);
    try {
      await api.downloadDischargeSummary(admission.id, language === 'en' ? 'en' : 'fr');
    } catch (err) {
      toast.error(t('inp.actionFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setDownloading(false);
    }
  };

  if (error && !admission) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/admissions" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('inp.detail.back')}</Link>
        <div className="p-4 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg">{error}</div>
      </div>
    );
  }
  if (!admission) return <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>;

  const admitted = admission.status === 'ADMITTED';
  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'overview', label: t('inp.tab.overview'), show: true },
    { id: 'notes', label: t('inp.tab.notes'), show: clinical },
    { id: 'orders', label: t('inp.tab.orders'), show: clinical || role === 'PHARMACIST' },
    { id: 'mar', label: t('inp.tab.mar'), show: clinical },
    { id: 'billing', label: t('inp.tab.billing'), show: canBill },
    { id: 'history', label: t('inp.tab.history'), show: true },
  ];
  const warning = coverageWarning ?? admission.coverageWarning ?? null;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admissions" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('inp.detail.back')}</Link>

      <div className={`${cardClass} p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{admission.patient.firstName} {admission.patient.lastName}</h1>
              <AdmissionStatusBadge status={admission.status} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <Link href={`/dashboard/patients/${admission.patient.id}`} className="hover:underline">{admission.patient.patientId}</Link>
              {' · '}{admission.number}
              {admission.patient.age !== null ? ` · ${t('inp.age', { age: admission.patient.age })}` : ''}
              {` · ${t(`inp.gender.${admission.patient.gender}`)}`}
            </p>
            <p className={`text-sm mt-1 font-medium ${admission.patient.allergies.length ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {admission.patient.allergies.length ? t('inp.allergiesList', { list: admission.patient.allergies.join(', ') }) : t('inp.noKnownAllergy')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {admitted && canTransfer && (
              <button type="button" onClick={() => setDialog('transfer')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('inp.detail.transfer')}</button>
            )}
            {admitted && isDoctor && (
              <button type="button" onClick={() => setDialog('discharge')} className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm">{t('inp.detail.discharge')}</button>
            )}
            {admitted && isDoctor && (
              <button type="button" onClick={() => setDialog('cancel')} className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm">{t('inp.detail.cancel')}</button>
            )}
            {admission.status !== 'CANCELLED' && isDoctor && (
              <>
                <button type="button" onClick={() => setDialog('sick-leave')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('mdoc.shortcut.sickLeave')}</button>
                <button type="button" onClick={() => setDialog('referral')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('mdoc.shortcut.referral')}</button>
              </>
            )}
            {admitted && isDoctor && (
              <Link
                href={`/dashboard/laboratory/orders/new?patientId=${admission.patient.id}&admissionId=${admission.id}${admission.provisionalDiagnosis ? `&clinicalInfo=${encodeURIComponent(admission.provisionalDiagnosis)}` : ''}`}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                {t('labw.fromStay')}
              </Link>
            )}
            {admitted && isDoctor && (
              <button type="button" onClick={() => setDialog('imaging')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('img.order.fromStay')}</button>
            )}
            {admission.status === 'DISCHARGED' && (
              <button type="button" onClick={downloadSummary} disabled={downloading} className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm disabled:opacity-50">{t('inp.detail.summaryPdf')}</button>
            )}
            {admission.invoice && (role === 'ADMIN' || role === 'RECEPTIONIST') && (
              <Link href={`/dashboard/billing/${admission.invoice.id}`} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                {t('inp.detail.invoice', { number: admission.invoice.invoiceNumber })}
              </Link>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('inp.ward')}</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{admission.ward.name}{admission.bed ? ` · ${t('inp.bedLabel', { label: admission.bed.label })}` : ''}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('inp.attendingDoctor')}</dt>
            <dd className="font-medium text-gray-900 dark:text-white">Dr {admission.attendingDoctor.name.replace(/^Dr\.?\s*/i, '')}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('inp.detail.admittedAt')}</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{formatDateTime(admission.admittedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('inp.list.stay')}</dt>
            <dd className="font-medium text-gray-900 dark:text-white tabular-nums">{daysLabel(admission.days)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{admission.dischargedAt ? t('inp.detail.dischargedAt') : t('inp.expectedDischarge')}</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {admission.dischargedAt
                ? `${formatDateTime(admission.dischargedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${admission.dischargeType ? ` · ${t(`inp.dischargeType.${admission.dischargeType}`)}` : ''}`
                : admission.expectedDischargeAt
                  ? formatDate(admission.expectedDischargeAt, { day: 'numeric', month: 'short' })
                  : '—'}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{t(`inp.source.${admission.source}`)}{admission.transferDestination ? ` · ${t('inp.detail.transferTo', { place: admission.transferDestination })}` : ''}{admission.followUpDate ? ` · ${t('inp.detail.followUp', { date: formatDate(admission.followUpDate, { day: 'numeric', month: 'long' }) })}` : ''}</p>
      </div>

      {warning === 'PRE_AUTH_REQUIRED' && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">{t('inp.bill.preAuthWarning')}</div>
      )}

      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max" role="tablist">
          {tabs.filter((x) => x.show).map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === x.id ? 'border-lime-600 text-lime-700 dark:text-lime-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {x.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'overview' && <OverviewTab admission={admission} onTab={setTab} />}
      {tab === 'notes' && clinical && <NotesTab admission={admission} />}
      {tab === 'orders' && <OrdersTab admission={admission} />}
      {tab === 'mar' && clinical && <MarTab admission={admission} />}
      {tab === 'billing' && canBill && <BillingTab admission={admission} />}
      {tab === 'history' && <HistoryTab admission={admission} />}

      {dialog === 'transfer' && (
        <TransferDialog
          admission={admission}
          onClose={() => setDialog(null)}
          onDone={(a) => {
            setDialog(null);
            setAdmission(a);
            toast.success(t('inp.transfer.done', { ward: a.ward.name, label: a.bed?.label ?? '' }));
            load();
          }}
        />
      )}
      {dialog === 'discharge' && (
        <DischargeDialog
          admission={admission}
          onClose={() => setDialog(null)}
          onDone={(a) => {
            setDialog(null);
            setAdmission(a);
            setCoverageWarning(a.coverageWarning ?? null);
            toast.success(t('inp.discharge.done', { number: a.number }));
            load();
          }}
        />
      )}
      {dialog === 'imaging' && (
        <NewImagingOrderDialog
          patient={{ id: admission.patient.id, patientId: admission.patient.patientId, name: `${admission.patient.firstName} ${admission.patient.lastName}` }}
          admissionId={admission.id}
          prefillClinicalInfo={[
            t('mdoc.prefill.stay', { number: admission.number, ward: admission.ward.name }),
            admission.reason,
            admission.provisionalDiagnosis ? `${t('mdoc.prefill.diagnosis')} : ${admission.provisionalDiagnosis}` : '',
          ]
            .filter(Boolean)
            .join('\n')}
          onClose={() => setDialog(null)}
        />
      )}
      {(dialog === 'sick-leave' || dialog === 'referral') && (
        <NewDocumentDialog
          patient={{ id: admission.patient.id, patientId: admission.patient.patientId, name: `${admission.patient.firstName} ${admission.patient.lastName}` }}
          admissionId={admission.id}
          initialType={dialog === 'sick-leave' ? 'SICK_LEAVE' : 'REFERRAL'}
          prefill={{
            reason: admission.finalDiagnosis ?? admission.provisionalDiagnosis ?? admission.reason,
            clinicalSummary: [
              t('mdoc.prefill.stay', { number: admission.number, ward: admission.ward.name }),
              admission.reason,
              admission.hospitalCourse ?? '',
              admission.finalDiagnosis ? `${t('mdoc.prefill.diagnosis')} : ${admission.finalDiagnosis}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            currentTreatment: admission.dischargeMedications ?? '',
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'cancel' && (
        <ReasonDialog
          title={t('inp.cancelAdmission.title', { number: admission.number })}
          label={t('inp.cancelAdmission.reason')}
          confirmLabel={t('inp.cancelAdmission.confirm')}
          danger
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const a = await api.cancelAdmission(admission.id, reason);
            setDialog(null);
            setAdmission(a);
            toast.success(t('inp.cancelAdmission.done'));
            load();
          }}
        />
      )}
    </div>
  );
}
