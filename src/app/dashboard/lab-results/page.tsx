'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, LabOrder, LabOrderStatus } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useDebounce } from '@/hooks/use-debounce';

const statusBadge: Record<LabOrderStatus, string> = {
  ORDERED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400',
  SAMPLE_COLLECTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400',
  PROCESSING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400',
};

const STATUSES: LabOrderStatus[] = ['COMPLETED', 'PROCESSING', 'SAMPLE_COLLECTED', 'ORDERED', 'CANCELLED'];

export default function LabResultsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, tEnum, formatDate } = useLanguage();

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<LabOrderStatus | ''>('COMPLETED');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const isDoctor = user?.role === 'DOCTOR';

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getLabOrders({
        search: debouncedSearch || undefined,
        status: status || undefined,
        // The API scopes doctors to the orders they placed
        page,
        limit: 15,
      });
      setOrders(response.labOrders);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lab.error.fetchOrders'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const summarize = (order: LabOrder) => {
    const withResult = order.tests.filter((test) => test.result);
    if (withResult.length === 0) return { text: t('lab.results.awaiting'), className: 'text-gray-500 dark:text-gray-400' };
    // Critical values come first: they are called in to the prescriber
    const critical = withResult.filter((test) => test.isCritical).length;
    if (critical > 0) return { text: t('labw.list.criticalCount', { n: critical }), className: 'text-red-700 dark:text-red-400 font-bold' };
    const abnormal = withResult.filter((test) => test.isAbnormal).length;
    if (abnormal === 0) return { text: t('lab.results.allNormal'), className: 'text-green-700 dark:text-green-400' };
    return {
      text: abnormal === 1 ? t('lab.results.abnormalCountOne') : t('lab.results.abnormalCount', { count: abnormal }),
      className: 'text-red-600 dark:text-red-400 font-medium',
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('lab.results.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('lab.results.subtitle')}</p>
        </div>
        {isDoctor && (
          <Link
            href="/dashboard/laboratory/orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('lab.newOrder')}
          </Link>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('lab.results.search')}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LabOrderStatus | '')}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">{t('lab.results.allOrders')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tEnum(s)}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
            <button onClick={fetchOrders} className="text-lime-600 dark:text-lime-400 hover:underline">
              {t('lab.tryAgain')}
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lime-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">{t('lab.loading')}</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="font-medium text-gray-900 dark:text-white">{t('lab.results.empty')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('lab.results.emptyHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3">{t('lab.results.patient')}</th>
                  <th className="px-4 py-3">{t('lab.results.tests')}</th>
                  <th className="px-4 py-3">{t('lab.detail.flag')}</th>
                  {!isDoctor && <th className="px-4 py-3">{t('lab.results.doctor')}</th>}
                  <th className="px-4 py-3">{t('lab.results.date')}</th>
                  <th className="px-4 py-3">{t('lab.results.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {orders.map((order) => {
                  const summary = summarize(order);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/dashboard/laboratory/orders/${order.id}`)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${order.tests.some((test) => test.isCritical) ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{order.patientName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{order.patientHospitalId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {order.tests.map((test) => (
                            <span
                              key={test.id}
                              className={`px-2 py-0.5 rounded text-xs ${
                                test.result
                                  ? test.isAbnormal
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {test.name}
                              {test.isCritical && <span className="ml-1 font-bold">!!</span>}
                              {test.result && test.status === 'ENTERED' && <span className="ml-1 italic">({t('labw.results.notValidatedShort')})</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm ${summary.className}`}>{summary.text}</td>
                      {!isDoctor && <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{order.doctorName}</td>}
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(order.completedAt || order.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge[order.status]}`}>{tEnum(order.status)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              {t('lab.pagination.previous')}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('lab.pagination.pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              {t('lab.pagination.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
