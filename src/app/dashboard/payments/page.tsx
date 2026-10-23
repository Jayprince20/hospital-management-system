'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, PaymentStats } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { MobileMoneyReconciliationPanel } from '@/components/payments';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#84cc16', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PaymentsPage() {
  const { t, tEnum, formatCurrency, formatDate, formatDateTime, locale } = useLanguage();
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getPaymentStats({
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      setStats(data);
    } catch (err) {
      console.error('Error fetching payment stats:', err);
      setError(t('admin.payments.failedToLoadPaymentStatistics'));
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatShortDate = (dateStr: string) => formatDate(dateStr, { month: 'short', day: 'numeric' });
  const formatShortDateTime = (dateStr: string) =>
    formatDateTime(dateStr, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const paymentsLabel = (count: number) =>
    t(count === 1 ? 'admin.payments.paymentsOne' : 'admin.payments.paymentsOther', { count });

  // The API labels months in English ("Oct 26"); re-render them in the UI language
  const formatMonthLabel = (label: string) => {
    const [mon, yy] = String(label).split(' ');
    const monthIndex = EN_MONTHS.indexOf(mon);
    if (monthIndex < 0 || !yy) return label;
    return new Date(2000 + Number(yy), monthIndex, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('admin.payments.loadingPaymentStatistics')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">{t('admin.payments.errorLoadingData')}</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {t('admin.payments.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.payments.paymentAnalytics')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('admin.payments.monitorAndAnalyzePaymentTrends')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <fieldset className="flex flex-wrap items-end gap-3">
            <legend className="sr-only">{t('admin.payments.dateRange')}</legend>
            <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
              {t('admin.payments.from')}
              <input
                type="date"
                value={dateRange.startDate}
                max={dateRange.endDate || undefined}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </label>
            <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
              {t('admin.payments.to')}
              <input
                type="date"
                value={dateRange.endDate}
                min={dateRange.startDate || undefined}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </label>
            {(dateRange.startDate || dateRange.endDate) && (
              <button
                type="button"
                onClick={() => setDateRange({ startDate: '', endDate: '' })}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {t('admin.payments.clearDates')}
              </button>
            )}
          </fieldset>
          <Link
            href="/dashboard/billing"
            className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors text-sm"
          >
            {t('admin.payments.viewInvoices')}
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-lime-100 dark:bg-lime-900/50 rounded-lg">
              <svg className="w-6 h-6 text-lime-600 dark:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.payments.today')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.summary.todayAmount)}</p>
              <p className="text-xs text-gray-500">{paymentsLabel(stats.summary.todayPayments)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.payments.thisWeek')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.summary.weekAmount)}</p>
              <p className="text-xs text-gray-500">{paymentsLabel(stats.summary.weekPayments)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.payments.thisMonth')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.summary.monthAmount)}</p>
              <p className="text-xs text-gray-500">{paymentsLabel(stats.summary.monthPayments)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.payments.avgPayment')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.summary.averagePayment)}</p>
              <p className="text-xs text-gray-500">{t('admin.payments.totalCount', { count: stats.summary.totalPayments })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend Line Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.payments.dailyPaymentTrendLast30Days')}</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value as number), t('admin.payments.amount')]}
                  labelFormatter={(label) => formatShortDate(label as string)}
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#84cc16"
                  strokeWidth={2}
                  dot={{ fill: '#84cc16', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.payments.paymentMethodsDistribution')}</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.paymentsByMethod}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="amount"
                  nameKey="method"
                  label={({ name, percent }) => `${tEnum(name as string)} (${((percent || 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: '#9ca3af' }}
                >
                  {stats.paymentsByMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [formatCurrency(value as number), tEnum(name as string)]}
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Trend Bar Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.payments.monthlyRevenueLast12Months')}</h2>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickFormatter={formatMonthLabel} />
              <YAxis
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value, _name, item) => [
                  item?.dataKey === 'amount' ? formatCurrency(value as number) : value,
                  item?.dataKey === 'amount' ? t('admin.payments.revenue') : t('admin.payments.payments'),
                ]}
                labelFormatter={(label) => formatMonthLabel(label as string)}
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend />
              <Bar dataKey="amount" name={t('admin.payments.revenue')} fill="#84cc16" radius={[4, 4, 0, 0]} />
              <Bar dataKey="count" name={t('admin.payments.payments')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.payments.recentPayments')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.payments.patient')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.payments.method')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.payments.amount')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.payments.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {stats.recentPayments.slice(0, 10).map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{payment.patientName}</p>
                      <p className="text-xs text-gray-500">{payment.invoiceNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {tEnum(payment.method)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400 text-right">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatShortDateTime(payment.processedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.recentPayments.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('admin.payments.noRecentPayments')}</p>
            )}
          </div>
        </div>

        {/* Top Paying Patients */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.payments.topPayingPatients')}</h2>
          </div>
          <div className="p-4 space-y-3">
            {stats.topPatients.slice(0, 8).map((patient, index) => (
              <div key={patient.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' :
                  index === 1 ? 'bg-gray-400' :
                  index === 2 ? 'bg-amber-600' :
                  'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{patient.name}</p>
                  <p className="text-xs text-gray-500">{paymentsLabel(patient.count)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(patient.amount)}</p>
                </div>
              </div>
            ))}
            {stats.topPatients.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('admin.payments.noDataAvailable')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment Methods Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.payments.paymentMethodsBreakdown')}</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {stats.paymentsByMethod.map((method, index) => (
              <div
                key={method.method}
                className="p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                style={{ borderLeftColor: COLORS[index % COLORS.length], borderLeftWidth: '4px' }}
              >
                <p className="text-sm text-gray-600 dark:text-gray-400">{tEnum(method.method)}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(method.amount)}</p>
                <p className="text-xs text-gray-500">{t('admin.payments.methodShare', { payments: paymentsLabel(method.count), percent: method.percentage })}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MobileMoneyReconciliationPanel />
    </div>
  );
}
