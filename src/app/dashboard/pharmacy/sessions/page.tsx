'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type CashSessionDetail, type CashSessionSummary, type PharmacyDailyReport, type SalePaymentMethod } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  ErrorBox,
  SaleStatusBadge,
  VarianceLine,
  cardClass,
  inputClass,
  labelClass,
  messageOf,
  smallBtn,
  useMethodLabel,
  usePharmacyPdf,
} from '@/components/pharmacy';
import { PAYMENT_METHODS, localDateString } from '@/lib/pharmacy-pos';

export default function PharmacySessionsPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pos.sessions.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('pos.sessions.subtitle')}</p>
        </div>
        <Link href="/dashboard/pharmacy/pos" className={smallBtn}>{t('nav.pharmacyPos')}</Link>
      </div>
      <DailyReport />
      <SessionsList />
    </div>
  );
}

function MethodRows({ values }: { values: Record<SalePaymentMethod, number> }) {
  const { formatCurrency } = useLanguage();
  const methodLabel = useMethodLabel();
  return (
    <>
      {PAYMENT_METHODS.map((m) => (
        <div key={m} className="flex justify-between text-sm">
          <dt className="text-gray-600 dark:text-gray-300">{methodLabel(m)}</dt>
          <dd className="text-gray-900 dark:text-white">{formatCurrency(values?.[m] ?? 0)}</dd>
        </div>
      ))}
    </>
  );
}

function DailyReport() {
  const { t, formatCurrency } = useLanguage();
  const [date, setDate] = useState(localDateString());
  const [report, setReport] = useState<PharmacyDailyReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api
      .getPharmacyDailyReport(date)
      .then((r) => live && (setReport(r), setError('')))
      .catch((err) => live && (setReport(null), setError(messageOf(err, t('pos.loadFailed')))));
    return () => {
      live = false;
    };
  }, [date, t]);

  return (
    <section className={`${cardClass} p-4 space-y-4`} aria-label={t('pos.report.title')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('pos.report.title')}</h2>
        <div>
          <label className={labelClass} htmlFor="report-date">{t('pos.report.date')}</label>
          <input id="report-date" type="date" max={localDateString()} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <ErrorBox message={error} />
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Tile label={t('pos.report.sales')} value={String(report.salesCount)} />
            <Tile label={t('pos.report.total')} value={formatCurrency(report.total)} />
            <Tile label={t('pos.report.refunds')} value={`− ${formatCurrency(report.refundsTotal)}`} />
            <Tile label={t('pos.report.net')} value={formatCurrency(report.net)} strong />
            <Tile label={t('pos.report.margin')} value={report.grossMargin === null ? t('pos.report.marginUnknown') : formatCurrency(report.grossMargin)} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('pos.report.byMethod')}</h3>
            <dl className="space-y-1">
              <MethodRows values={report.byMethod} />
            </dl>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('pos.report.top')}</h3>
            {report.topMedications.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.report.noSales')}</p>
            ) : (
              <ol className="space-y-1 text-sm">
                {report.topMedications.map((m, i) => (
                  <li key={m.name} className="flex justify-between gap-2">
                    <span className="text-gray-800 dark:text-gray-200">{i + 1}. {m.name} <span className="text-gray-500">× {m.quantity}</span></span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(m.total)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between items-baseline p-2 rounded-lg bg-gray-50 dark:bg-gray-700/40">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <span className={`${strong ? 'text-lg font-bold' : 'font-semibold'} text-gray-900 dark:text-white`}>{value}</span>
    </div>
  );
}

function SessionsList() {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const openPdf = usePharmacyPdf();
  const [page, setPage] = useState(1);
  const [sessions, setSessions] = useState<CashSessionSummary[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getCashSessions(page)
      .then((list) => {
        setSessions(list);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('pos.loadFailed'))));
  }, [page, t]);
  useEffect(() => load(), [load]);

  return (
    <section className="space-y-3" aria-label={t('pos.sessions.list')}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('pos.sessions.list')}</h2>
      <ErrorBox message={error} />
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left">{t('pos.sessions.number')}</th>
              <th className="px-4 py-2 text-left">{t('pos.sessions.opened')}</th>
              <th className="px-4 py-2 text-left">{t('pos.sessions.closed')}</th>
              <th className="px-4 py-2 text-right">{t('pos.report.sales')}</th>
              <th className="px-4 py-2 text-right">{t('pos.report.net')}</th>
              <th className="px-4 py-2 text-right">{t('pos.till.variance')}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sessions === null && !error && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t('pos.loading')}</td></tr>}
            {sessions && sessions.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t('pos.sessions.empty')}</td></tr>}
            {sessions?.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                  {s.number}
                  {s.status === 'OPEN' && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">{t('pos.sessions.openNow')}</span>}
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatDateTime(s.openedAt)}<span className="block text-xs">{s.openedByName ?? ''}</span></td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{s.closedAt ? formatDateTime(s.closedAt) : '—'}<span className="block text-xs">{s.closedByName ?? ''}</span></td>
                <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">{s.totals.salesCount}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(s.totals.net)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${s.variance === null ? 'text-gray-400' : s.variance === 0 ? 'text-green-700 dark:text-green-400' : s.variance > 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  {s.variance === null ? '—' : `${s.variance > 0 ? '+' : ''}${formatCurrency(s.variance)}`}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap space-x-1">
                  <button type="button" className={smallBtn} onClick={() => setOpenId(openId === s.id ? null : s.id)} aria-expanded={openId === s.id}>{t('pos.sessions.details')}</button>
                  <button type="button" className={smallBtn} onClick={() => openPdf('session-report', s.id)}>{t('pos.till.zReport')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm">
          <button type="button" className={smallBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('pos.prev')}</button>
          <span className="text-gray-600 dark:text-gray-300">{t('pos.page', { page })}</span>
          <button type="button" className={smallBtn} disabled={!sessions || sessions.length === 0} onClick={() => setPage((p) => p + 1)}>{t('pos.next')}</button>
        </div>
      </div>
      {openId && <SessionDetail id={openId} />}
    </section>
  );
}

function SessionDetail({ id }: { id: string }) {
  const { t, formatCurrency, formatTime } = useLanguage();
  const methodLabel = useMethodLabel();
  const [detail, setDetail] = useState<CashSessionDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api
      .getCashSession(id)
      .then((d) => live && setDetail(d))
      .catch((err) => live && setError(messageOf(err, t('pos.loadFailed'))));
    return () => {
      live = false;
    };
  }, [id, t]);
  if (error) return <ErrorBox message={error} />;
  if (!detail) return <p className="text-sm text-gray-500">{t('pos.loading')}</p>;
  return (
    <div className={`${cardClass} p-4 grid grid-cols-1 lg:grid-cols-3 gap-4`}>
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">{detail.number}</h3>
        <dl className="space-y-1">
          <div className="flex justify-between text-sm"><dt className="text-gray-600 dark:text-gray-300">{t('pos.till.float')}</dt><dd>{formatCurrency(detail.openingFloat)}</dd></div>
          <MethodRows values={detail.totals.byMethod} />
          <div className="flex justify-between text-sm"><dt className="text-gray-600 dark:text-gray-300">{t('pos.report.refunds')}</dt><dd>− {formatCurrency(detail.totals.refundsTotal)}</dd></div>
          <div className="flex justify-between text-sm font-semibold"><dt>{t('pos.till.expected')}</dt><dd>{formatCurrency(detail.expectedCash ?? detail.totals.expectedCashNow)}</dd></div>
          {detail.countedCash !== null && <div className="flex justify-between text-sm"><dt className="text-gray-600 dark:text-gray-300">{t('pos.till.counted')}</dt><dd>{formatCurrency(detail.countedCash)}</dd></div>}
        </dl>
        {detail.variance !== null && <VarianceLine variance={detail.variance} />}
      </div>
      <div className="lg:col-span-2">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('pos.sessions.salesOf', { count: detail.sales.length })}</h3>
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 text-sm max-h-80 overflow-y-auto">
          {detail.sales.map((s) => (
            <li key={s.id} className="py-1.5 flex items-center justify-between gap-3">
              <Link href={`/dashboard/pharmacy/sales?sale=${s.id}`} className="text-lime-700 dark:text-lime-400 hover:underline">{s.number}</Link>
              <span className="text-gray-500">{formatTime(s.createdAt)} · {methodLabel(s.paymentMethod)}</span>
              <SaleStatusBadge status={s.status} />
              <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(s.total)}</span>
            </li>
          ))}
          {detail.returns.map((r) => (
            <li key={r.id} className="py-1.5 flex items-center justify-between gap-3 text-red-600">
              <span>{r.number}</span>
              <span>{formatTime(r.createdAt)} · {methodLabel(r.refundMethod)}</span>
              <span>− {formatCurrency(r.refundAmount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
