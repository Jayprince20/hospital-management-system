'use client';

import { useState } from 'react';
import { ApiError, api, type ImagingOrder } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { OnCallSuggestion } from '@/components/rosters/on-call';
import { CriticalBadge, DialogShell, ErrorBox, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn, useImagingPdf } from './ui';

/** Radiologist's report, written once the images are acquired; signing makes it final */
export function ReportEditor({ order, onSigned }: { order: ImagingOrder; onSigned: (o: ImagingOrder) => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [technique, setTechnique] = useState(order.technique ?? '');
  const [findings, setFindings] = useState(order.findings ?? '');
  const [conclusion, setConclusion] = useState(order.conclusion ?? '');
  const [critical, setCritical] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState(false);

  const check = () => {
    if (!findings.trim()) return setError(t('img.report.findingsRequired'));
    if (!conclusion.trim()) return setError(t('img.report.conclusionRequired'));
    setError('');
    setConfirming(true);
  };

  const sign = async () => {
    setSaving(true);
    try {
      const updated = await api.reportImagingOrder(order.id, {
        ...(technique.trim() ? { technique: technique.trim() } : {}),
        findings: findings.trim(),
        conclusion: conclusion.trim(),
        isCritical: critical,
      });
      toast.success(t(critical ? 'img.report.signedCritical' : 'img.report.signed', { number: order.number }));
      setConfirming(false);
      onSigned(updated);
    } catch (err) {
      setConfirming(false);
      if (err instanceof ApiError && err.status === 403) setRefused(true);
      setError(messageOf(err, t('img.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  if (refused) {
    return (
      <section className={`${cardClass} p-5`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('img.report.title')}</h2>
        <ErrorBox message={error || t('img.report.notRadiologist')} />
      </section>
    );
  }

  return (
    <section className={`${cardClass} p-5 space-y-4`} aria-labelledby="img-report-title">
      <h2 id="img-report-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('img.report.title')}</h2>
      <ErrorBox message={error} />
      <div>
        <label htmlFor="img-technique" className={labelClass}>{t('img.report.technique')}</label>
        <textarea id="img-technique" rows={2} value={technique} onChange={(e) => setTechnique(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="img-findings" className={labelClass}>{t('img.report.findings')}<span className="text-red-500"> *</span></label>
        <textarea id="img-findings" rows={6} value={findings} onChange={(e) => setFindings(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="img-conclusion" className={labelClass}>{t('img.report.conclusion')}<span className="text-red-500"> *</span></label>
        <textarea id="img-conclusion" rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} className={inputClass} />
      </div>
      <label className={`flex items-start gap-2 p-3 rounded-lg border ${critical ? 'border-red-400 bg-red-50 dark:bg-red-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
        <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} className="mt-0.5" />
        <span className="text-sm">
          <span className="font-semibold text-gray-900 dark:text-white">{t('img.report.critical')}</span>
          <span className="block text-xs text-gray-600 dark:text-gray-300">{t('img.report.criticalHint')}</span>
        </span>
      </label>
      {/* Critical finding: who to call if the prescriber can't be reached */}
      {critical && <OnCallSuggestion doctorId={order.orderedBy?.id} />}
      <div className="flex justify-end">
        <button type="button" onClick={check} disabled={saving} className={critical ? dangerBtn : primaryBtn}>{t('img.report.sign')}</button>
      </div>

      {confirming && (
        <DialogShell
          title={t('img.report.confirmTitle')}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button type="button" onClick={() => setConfirming(false)} className={cancelBtn}>{t('img.cancel')}</button>
              <button type="button" onClick={sign} disabled={saving} className={critical ? dangerBtn : primaryBtn}>{t('img.report.confirmSign')}</button>
            </>
          }
        >
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('img.report.confirmText')}</p>
          {critical && <p className="text-sm font-semibold text-red-700 dark:text-red-300">{t('img.report.confirmCritical')}</p>}
        </DialogShell>
      )}
    </section>
  );
}

/** Signed report, read-only, with its addenda */
export function SignedReport({ order, canAddendum, onChanged }: { order: ImagingOrder; canAddendum: boolean; onChanged: (o: ImagingOrder) => void }) {
  const { t, formatDateTime } = useLanguage();
  const toast = useToast();
  const { open, busy } = useImagingPdf();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!text.trim()) return setError(t('img.addendum.required'));
    setSaving(true);
    setError('');
    try {
      const updated = await api.addImagingAddendum(order.id, text.trim());
      toast.success(t('img.addendum.added'));
      setAdding(false);
      setText('');
      onChanged(updated);
    } catch (err) {
      setError(messageOf(err, t('img.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`${cardClass} p-5 space-y-4`} aria-labelledby="img-signed-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="img-signed-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {t('img.report.signedTitle')} {order.isCritical && <CriticalBadge />}
        </h2>
        <button type="button" onClick={() => open(order.id)} disabled={busy === order.id} className={primaryBtn}>{t('img.report.pdf')}</button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('img.report.signedBy', { name: order.reportedBy?.name ?? '—', date: order.reportedAt ? formatDateTime(order.reportedAt) : '—' })}
      </p>
      {order.technique && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('img.report.technique')}</h3>
          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line">{order.technique}</p>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('img.report.findings')}</h3>
        <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line">{order.findings}</p>
      </div>
      <div className={`p-3 rounded-lg ${order.isCritical ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('img.report.conclusion')}</h3>
        <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-pre-line">{order.conclusion}</p>
      </div>

      {order.addenda.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('img.addendum.title')}</h3>
          <ul className="space-y-2">
            {order.addenda.map((a, i) => (
              <li key={`${a.at}-${i}`} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(a.at)} · {a.byName}</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line">{a.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canAddendum && !adding && (
        <button type="button" onClick={() => setAdding(true)} className={smallBtn}>{t('img.addendum.add')}</button>
      )}
      {adding && (
        <div className="space-y-2">
          <ErrorBox message={error} />
          <label htmlFor="img-addendum" className={labelClass}>{t('img.addendum.text')}</label>
          <textarea id="img-addendum" rows={3} value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className={cancelBtn}>{t('img.cancel')}</button>
            <button type="button" onClick={add} disabled={saving} className={primaryBtn}>{t('img.addendum.save')}</button>
          </div>
        </div>
      )}
    </section>
  );
}
