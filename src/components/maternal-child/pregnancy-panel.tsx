'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { usePolling } from '@/components/inpatient/ui';
import { formatGA, gaFromDays, splitPregnancyAlerts, type PregnancyDetail, type PregnancySummary } from '@/lib/maternal-child';
import { ClosePregnancyDialog, OpenPregnancyDialog, VisitDialog } from './pregnancy-dialogs';
import { AncAlertChip, ErrorBox, Stat, cardClass, messageOf, primaryBtn, smallBtn, useDay } from './ui';
import type { MchPatient } from './vaccination-panel';

/** "Grossesse" tab: the ongoing pregnancy (dating, contacts, prevention, alerts) and past ones */
export function PregnancyPanel({ patient, readOnly = false }: { patient: MchPatient; readOnly?: boolean }) {
  const { t } = useLanguage();
  const toast = useToast();
  const day = useDay();
  const [list, setList] = useState<PregnancySummary[] | null>(null);
  const [current, setCurrent] = useState<PregnancyDetail | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'open' | 'visit' | 'close' | null>(null);

  const load = useCallback(async () => {
    try {
      const pregnancies = await api.getPregnancies(patient.id);
      setList(pregnancies);
      const ongoing = pregnancies.find((p) => p.status === 'ONGOING');
      setCurrent(ongoing ? await api.getPregnancy(ongoing.id) : null);
      setError('');
    } catch (err) {
      setError(messageOf(err, t('mc.preg.loadFailed')));
      setList((l) => l ?? []);
    }
  }, [patient.id, t]);
  usePolling(load, null);

  const past = (list ?? []).filter((p) => p.status !== 'ONGOING');
  const { alerts, risks } = current ? splitPregnancyAlerts(current.alerts, current.riskFactors) : { alerts: [], risks: [] };
  const visits = [...(current?.visits ?? [])].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  const bp = (s: number | null, d: number | null) => (s != null && d != null ? `${s}/${d}` : '—');
  const num = (n: number | null | undefined) => (n == null ? '—' : String(n).replace('.', ','));

  return (
    <div className="space-y-4">
      <section className={`${cardClass} p-5`} aria-labelledby="mc-preg-title">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 id="mc-preg-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('mc.preg.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('mc.preg.subtitle')}</p>
          </div>
          {!readOnly && list && (
            <div className="flex flex-wrap gap-2">
              {current ? (
                <>
                  <button type="button" onClick={() => setDialog('close')} className={smallBtn}>{t('mc.preg.close')}</button>
                  <button type="button" onClick={() => setDialog('visit')} className={primaryBtn}>{t('mc.preg.addVisit')}</button>
                </>
              ) : (
                <button type="button" onClick={() => setDialog('open')} className={primaryBtn}>{t('mc.preg.open')}</button>
              )}
            </div>
          )}
        </div>
        <ErrorBox message={error} />
        {list === null && !error && <p className="text-sm text-gray-500">{t('mc.loading')}</p>}
        {list && !current && <p className="text-sm text-gray-500 dark:text-gray-400">{t('mc.preg.none')}</p>}

        {current && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Stat
                label={t('mc.preg.gaLabel')}
                value={current.gestationalAge ? t('mc.preg.gaValue', { ga: formatGA(current.gestationalAge) }) : '—'}
                sub={current.trimester ? t(`mc.preg.trimester.${current.trimester}`) : undefined}
              />
              <Stat label={t('mc.preg.edd')} value={day(current.edd)} sub={current.eddByUltrasound ? t('mc.preg.field.eddUs') : current.lmp ? `${t('mc.preg.lmpShort')} ${day(current.lmp)}` : undefined} />
              <Stat label={t('mc.preg.obstetric')} value={t('mc.preg.gp', { g: current.gravida, p: current.para })} sub={current.previousCesarean ? t('mc.preg.field.prevCs') : undefined} />
              <Stat
                label={t('mc.preg.nextContact')}
                value={current.nextContact ? `${t('mc.col.contact')} ${current.nextContact.number}` : t('mc.preg.noNextContact')}
                sub={current.nextContact ? `${t('mc.preg.gaValue', { ga: current.nextContact.targetWeek })} · ${day(current.nextContact.targetDate)}` : undefined}
                tone={current.overdue ? 'alert' : undefined}
              />
              <Stat label={t('mc.preg.iptp')} value={t('mc.preg.doses', { n: current.iptpDosesGiven })} sub={current.iptpDue ? t('mc.preg.iptpDue') : undefined} tone={current.iptpDue ? 'alert' : undefined} />
              <Stat label={t('mc.preg.td')} value={t('mc.preg.doses', { n: current.tdDosesGiven })} />
            </div>

            {(current.overdue || alerts.length > 0) && (
              <div className="flex flex-wrap items-center gap-2" role="status">
                <span className="text-sm font-semibold text-red-700 dark:text-red-300">{t('mc.preg.alerts')}</span>
                {current.overdue && <span className="px-2 py-0.5 rounded-full border text-xs font-semibold bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800">{t('mc.preg.overdue')}</span>}
                {alerts.map((a) => <AncAlertChip key={a} code={a} />)}
              </div>
            )}
            {risks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('mc.preg.risks')}</span>
                {risks.map((r) => <AncAlertChip key={r} code={r} kind="risk" />)}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {[
                current.bloodGroup ? `${t('mc.preg.field.bloodGroup')} ${current.bloodGroup}` : null,
                current.hivStatus ? `${t('mc.preg.field.hiv')} : ${t(`mc.screen.${current.hivStatus}`)}` : null,
                current.syphilisStatus ? `${t('mc.preg.field.syphilis')} : ${t(`mc.screen.${current.syphilisStatus}`)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>

            <div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{t('mc.preg.visits')}</h4>
              {visits.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('mc.preg.noVisits')}</p>
              ) : (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm min-w-[680px]">
                    <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="py-2 pr-3">{t('mc.col.contact')}</th>
                        <th className="py-2 pr-3">{t('mc.col.date')}</th>
                        <th className="py-2 pr-3">{t('mc.col.ga')}</th>
                        <th className="py-2 pr-3">{t('mc.col.bp')}</th>
                        <th className="py-2 pr-3 text-right">{t('mc.col.weight')}</th>
                        <th className="py-2 pr-3 text-right">{t('mc.col.fh')}</th>
                        <th className="py-2 pr-3 text-right">{t('mc.col.fhr')}</th>
                        <th className="py-2 pr-3 text-right">{t('mc.col.hb')}</th>
                        <th className="py-2">{t('mc.col.alerts')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                      {visits.map((v) => (
                        <tr key={v.id} className="align-top">
                          <td className="py-2 pr-3 font-semibold">{v.contactNumber}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{day(v.visitDate)}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{formatGA(gaFromDays(v.gestationalAgeDays))}</td>
                          <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{bp(v.bpSystolic, v.bpDiastolic)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{num(v.weightKg)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{num(v.fundalHeightCm)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{num(v.fetalHeartRate)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{num(v.hemoglobin)}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">{v.alerts.map((a) => <AncAlertChip key={a} code={a} />)}</div>
                            {!readOnly && v.plan && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{v.plan}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className={`${cardClass} p-5`} aria-labelledby="mc-preg-history">
          <h3 id="mc-preg-history" className="text-base font-semibold text-gray-900 dark:text-white mb-3">{t('mc.preg.history')}</h3>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {past.map((p) => (
              <li key={p.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-gray-900 dark:text-white">
                  {t('mc.preg.edd')} {day(p.edd)} · {t(`mc.preg.status.${p.status}`)}
                  {p.outcome ? ` · ${t(`mc.preg.outcome.${p.outcome}`)}` : ''}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('mc.preg.visitsCount', { n: p.visitsCount })} · {day(p.openedOn)} → {day(p.closedOn)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog === 'open' && (
        <OpenPregnancyDialog
          patientId={patient.id}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            toast.success(t('mc.preg.opened'));
            void load();
          }}
        />
      )}
      {dialog === 'visit' && current && (
        <VisitDialog
          pregnancy={current}
          onClose={() => setDialog(null)}
          onSaved={(visit) => {
            setDialog(null);
            const severe = visit.alerts.map((a) => t(`mc.anc.alert.${a}`)).join(', ');
            if (severe) toast.warning(t('mc.preg.visitSaved'), severe);
            else toast.success(t('mc.preg.visitSaved'));
            void load();
          }}
        />
      )}
      {dialog === 'close' && current && (
        <ClosePregnancyDialog
          pregnancy={current}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            toast.success(t('mc.preg.closed'));
            void load();
          }}
        />
      )}
    </div>
  );
}
