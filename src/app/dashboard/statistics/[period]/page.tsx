'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { hasPermission } from '@/lib/rbac';
import { dhis2FileName, monthIsOver, type MonthlyReportDetail, type ReportSection } from '@/lib/statistics';
import {
  ChangesBanner,
  ErrorBox,
  ListTable,
  MdoAlertBanner,
  ReportStatusBadge,
  SectionCard,
  TextDialog,
  cancelBtn,
  cardClass,
  inputClass,
  messageOf,
  primaryBtn,
  tdClass,
  thClass,
} from '@/components/statistics/ui';

type Dialog = 'validate' | 'reopen' | 'submit' | null;

export default function MonthlyReportPage() {
  const { period } = useParams<{ period: string }>();
  const { t, formatDate, formatDateTime, formatNumber } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, 'statistics:manage');
  const [detail, setDetail] = useState<MonthlyReportDetail | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [exporting, setExporting] = useState(false);

  const apply = (d: MonthlyReportDetail) => {
    setDetail(d);
    setNotes(d.notes ?? '');
  };

  const load = useCallback(() => {
    api
      .getMonthlyReport(period)
      .then((d) => {
        apply(d);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('stat.loadFailed'))));
  }, [period, t]);
  useEffect(() => load(), [load]);

  const openPdf = async () => {
    try {
      await api.openMonthlyReportPdf(period);
    } catch (err) {
      toast.error(t('stat.pdfFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const exportDhis2 = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      const { unmapped } = await api.downloadMonthlyReportDhis2(period, format, dhis2FileName(period, format));
      const warnings = [
        detail?.status === 'DRAFT' ? t('stat.exportDraftWarning') : '',
        unmapped.length > 0 ? t('stat.exportUnmapped', { count: unmapped.length }) : '',
      ].filter(Boolean);
      if (warnings.length) toast.warning(t('stat.exported'), warnings.join(' '));
      else toast.success(t('stat.exported'));
    } catch (err) {
      toast.error(t('stat.exportFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      apply(await api.updateMonthlyReportNotes(period, notes));
      toast.success(t('stat.notesSaved'));
    } catch (err) {
      toast.error(t('stat.actionFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setSavingNotes(false);
    }
  };

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/statistics" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('stat.back')}</Link>
        <ErrorBox message={error} />
        {!error && <p className="text-gray-500">{t('stat.loading')}</p>}
      </div>
    );
  }

  const { report, status } = detail;
  const facility = report.facility;
  const alerts = report.sections.find((s) => s.key === 'mdo')?.alerts ?? [];
  const notesEditable = canManage && status !== 'SUBMITTED';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/dashboard/statistics" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('stat.back')}</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white first-letter:uppercase">{report.label}</h1>
              <ReportStatusBadge status={status} />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{facility.facilityName}{facility.category ? ` · ${facility.category}` : ''}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('stat.facilityLine', { district: facility.healthDistrict ?? '—', area: facility.healthArea ?? '—', region: facility.region ?? '—' })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {status === 'DRAFT' ? t('stat.generatedAt', { date: formatDateTime(report.generatedAt) }) : t('stat.frozenAt')}
              {detail.validatedAt && ` · ${t('stat.validatedOn', { date: formatDate(detail.validatedAt), name: detail.validatedBy?.name ?? '—' })}`}
              {detail.submittedAt &&
                ` · ${detail.submissionRef ? t('stat.submittedOnRef', { date: formatDate(detail.submittedAt), ref: detail.submissionRef }) : t('stat.submittedOn', { date: formatDate(detail.submittedAt) })}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cancelBtn} onClick={openPdf}>{t('stat.pdf')}</button>
            {canManage && (
              <>
                <button type="button" className={cancelBtn} onClick={() => exportDhis2('json')} disabled={exporting}>{t('stat.exportJson')}</button>
                <button type="button" className={cancelBtn} onClick={() => exportDhis2('csv')} disabled={exporting}>{t('stat.exportCsv')}</button>
                {status === 'DRAFT' && (monthIsOver(period) ? <button type="button" className={primaryBtn} onClick={() => setDialog('validate')}>{t('stat.validate')}</button> : <span className="self-center text-sm text-gray-500 dark:text-gray-400">{t('stat.validateAfterMonth')}</span>)}
                {status === 'VALIDATED' && <button type="button" className={primaryBtn} onClick={() => setDialog('submit')}>{t('stat.submit')}</button>}
                {status !== 'DRAFT' && <button type="button" className={cancelBtn} onClick={() => setDialog('reopen')}>{t('stat.reopen')}</button>}
              </>
            )}
          </div>
        </div>
      </div>

      <ErrorBox message={error} />
      <MdoAlertBanner alerts={alerts} />
      <ChangesBanner changes={detail.changedSinceValidation} />

      {report.sections.map((section) => (
        <SectionCard key={section.key} section={section}>
          <SectionLists section={section} formatNumber={formatNumber} />
        </SectionCard>
      ))}

      <section className={`${cardClass} p-4 space-y-3`} aria-labelledby="stat-notes">
        <h2 id="stat-notes" className="text-lg font-semibold text-gray-900 dark:text-white">{t('stat.notes')}</h2>
        {notesEditable ? (
          <>
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('stat.notesHint')} aria-label={t('stat.notes')} className={inputClass} />
            <div className="flex justify-end">
              <button type="button" className={primaryBtn} onClick={saveNotes} disabled={savingNotes || notes === (detail.notes ?? '')}>
                {savingNotes ? t('stat.saving') : t('stat.save')}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{detail.notes || t('stat.noNotes')}</p>
        )}
      </section>

      {dialog === 'validate' && (
        <TextDialog
          title={t('stat.validateTitle', { label: report.label })}
          hint={t('stat.validateHint')}
          label={t('stat.notes')}
          initial={notes}
          confirmLabel={t('stat.validate')}
          onClose={() => setDialog(null)}
          onConfirm={async (text) => {
            apply(await api.validateMonthlyReport(period, text));
            setDialog(null);
            toast.success(t('stat.validated'));
          }}
        />
      )}
      {dialog === 'reopen' && (
        <TextDialog
          title={t('stat.reopenTitle', { label: report.label })}
          hint={t('stat.reopenHint')}
          label={t('stat.reason')}
          confirmLabel={t('stat.reopen')}
          minLength={5}
          danger
          onClose={() => setDialog(null)}
          onConfirm={async (text) => {
            apply(await api.reopenMonthlyReport(period, text));
            setDialog(null);
            toast.success(t('stat.reopened'));
          }}
        />
      )}
      {dialog === 'submit' && (
        <TextDialog
          title={t('stat.submitTitle')}
          hint={t('stat.submitHint')}
          label={t('stat.submissionRef')}
          multiline={false}
          confirmLabel={t('stat.submit')}
          onClose={() => setDialog(null)}
          onConfirm={async (text) => {
            apply(await api.submitMonthlyReport(period, text || undefined));
            setDialog(null);
            toast.success(t('stat.submitted'));
          }}
        />
      )}
    </div>
  );
}

/** The lists that come with some sections (by department, by ward, tests, imaging, tracers, staff) */
function SectionLists({ section, formatNumber }: { section: ReportSection; formatNumber: (n: number) => string }) {
  const { t } = useLanguage();
  const num = `${tdClass} text-right tabular-nums`;
  const numHead = `${thClass} text-right`;
  const blocks: ReactNode[] = [];

  if (section.byDepartment) {
    blocks.push(
      <ListTable
        key="dep"
        title={t('stat.byDepartment')}
        head={<tr><th className={thClass}>{t('stat.department')}</th><th className={numHead}>{t('stat.count')}</th></tr>}
        rows={section.byDepartment.map((d) => (
          <tr key={d.department}><td className={tdClass}>{d.department}</td><td className={num}>{formatNumber(d.count)}</td></tr>
        ))}
      />
    );
  }
  if (section.byWard) {
    blocks.push(
      <ListTable
        key="ward"
        title={t('stat.byWard')}
        head={
          <tr>
            <th className={thClass}>{t('stat.ward')}</th>
            <th className={numHead}>{t('stat.admissions')}</th>
            <th className={numHead}>{t('stat.patientDays')}</th>
            <th className={numHead}>{t('stat.beds')}</th>
            <th className={numHead}>{t('stat.occupancy')}</th>
          </tr>
        }
        rows={section.byWard.map((w) => (
          <tr key={w.ward}>
            <td className={tdClass}>{w.ward}</td>
            <td className={num}>{formatNumber(w.admissions)}</td>
            <td className={num}>{formatNumber(w.patientDays)}</td>
            <td className={num}>{formatNumber(w.beds)}</td>
            <td className={num}>{formatNumber(w.occupancyRate)} %</td>
          </tr>
        ))}
      />
    );
  }
  if (section.byTest) {
    blocks.push(
      <ListTable
        key="test"
        title={t('stat.byTest')}
        head={<tr><th className={thClass}>{t('stat.test')}</th><th className={numHead}>{t('stat.count')}</th></tr>}
        rows={section.byTest.map((x) => (
          <tr key={x.test}><td className={tdClass}>{x.test}</td><td className={num}>{formatNumber(x.count)}</td></tr>
        ))}
      />
    );
  }
  if (section.byModality) {
    blocks.push(
      <ListTable
        key="mod"
        title={t('stat.byModality')}
        head={<tr><th className={thClass}>{t('stat.modality')}</th><th className={numHead}>{t('stat.count')}</th></tr>}
        rows={section.byModality.map((x) => (
          <tr key={x.modality}><td className={tdClass}>{x.modality}</td><td className={num}>{formatNumber(x.count)}</td></tr>
        ))}
      />
    );
  }
  if (section.tracers) {
    blocks.push(
      <ListTable
        key="tracers"
        title={t('stat.tracers')}
        head={
          <tr>
            <th className={thClass}>{t('stat.medication')}</th>
            <th className={numHead}>{t('stat.opening')}</th>
            <th className={numHead}>{t('stat.received')}</th>
            <th className={numHead}>{t('stat.consumed')}</th>
            <th className={numHead}>{t('stat.closing')}</th>
            <th className={numHead}>{t('stat.stockOutDays')}</th>
          </tr>
        }
        rows={section.tracers.map((m, i) => (
          <tr key={`${i}-${m.medication}`} className={m.stockOutDays > 0 ? 'bg-red-50 dark:bg-red-900/20' : ''}>
            <td className={tdClass}>{m.medication}</td>
            <td className={num}>{formatNumber(m.opening)}</td>
            <td className={num}>{formatNumber(m.received)}</td>
            <td className={num}>{formatNumber(m.consumed)}</td>
            <td className={num}>{formatNumber(m.closing)}</td>
            <td className={`${num} ${m.stockOutDays > 0 ? 'text-red-700 dark:text-red-400 font-semibold' : ''}`}>{formatNumber(m.stockOutDays)}</td>
          </tr>
        ))}
      />
    );
  }
  if (section.doctorsBySpecialty) {
    blocks.push(
      <ListTable
        key="spec"
        title={t('stat.doctorsBySpecialty')}
        head={<tr><th className={thClass}>{t('stat.specialty')}</th><th className={numHead}>{t('stat.count')}</th></tr>}
        rows={section.doctorsBySpecialty.map((x) => (
          <tr key={x.specialty}><td className={tdClass}>{x.specialty}</td><td className={num}>{formatNumber(x.count)}</td></tr>
        ))}
      />
    );
  }
  if (blocks.length === 0) return null;
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{blocks}</div>;
}
